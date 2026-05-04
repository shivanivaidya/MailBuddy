import type {
  DeliveryStatus,
  Email,
  MerchantSpendSummary,
  OrderStatus,
  OrderUpdate,
  OrderItem,
  RefundedItem,
  ReplacedItem,
} from '@/types/mail'

export function extractOrderUpdates(emails: Email[]): OrderUpdate[] {
  const orderMap = new Map<string, OrderAccumulator>()

  for (const email of emails) {
    if (!isOrderSignal(email)) {
      continue
    }

    const orderNumber = extractOrderNumber(email.body)

    if (!orderNumber) {
      continue
    }

    const merchantName = extractMerchantName(email)
    const orderKey = `${merchantName.toLowerCase()}::${orderNumber.toLowerCase()}`
    const order = getOrderAccumulator(orderMap, {
      email,
      merchantName,
      orderNumber,
    })

    order.relatedEmailIds.add(email.id)
    order.orderDate = getEarlierTimestamp(order.orderDate, email.date)

    const orderTotalCents = extractOrderTotalCents(email.body)

    if (orderTotalCents !== undefined) {
      order.orderTotalCents = orderTotalCents
    }

    const items = extractOrderItems(email.body)

    if (items.length) {
      order.items = mergeItems(order.items, items)
    }

    const deliveryStatus = extractDeliveryStatus(email)

    if (deliveryStatus) {
      order.deliveryStatus = deliveryStatus
      order.status = deriveStatus(order.status, deliveryStatus)
    }

    const expectedDeliveryTime = extractExpectedDeliveryTime(email.body)

    if (expectedDeliveryTime) {
      order.expectedDeliveryTime = expectedDeliveryTime
    }

    const deliveredTime = extractDeliveredTime(email.body)

    if (deliveredTime) {
      order.deliveredTime = deliveredTime
    }

    const trackingNumber = extractAfterLabel(email.body, 'Tracking number')

    if (trackingNumber) {
      order.trackingNumber = trackingNumber
      order.trackingDetails = email.subject
    }

    const replacedItem = extractReplacedItem(email.body)

    if (replacedItem) {
      order.replacedItems.push(replacedItem)
      order.status = deriveStatus(order.status, 'updated')
    }

    const refundedItem = extractRefundedItem(email.body)

    if (refundedItem) {
      order.refundedItems.push(refundedItem)
      order.refundTotalCents += amountToCents(refundedItem.amount)
      order.status = deriveStatus(order.status, 'partially_refunded')
    }

    orderMap.set(orderKey, order)
  }

  return Array.from(orderMap.values())
    .map(toOrderUpdate)
    .sort(
      (firstOrder, secondOrder) =>
        new Date(secondOrder.orderDate).getTime() -
        new Date(firstOrder.orderDate).getTime(),
    )
}

export function generateMerchantSpendSummaries(
  orderUpdates: OrderUpdate[],
): MerchantSpendSummary[] {
  const merchantMap = new Map<string, MerchantAccumulator>()

  for (const order of orderUpdates) {
    const orderTotalCents = amountToCents(order.orderTotal ?? 0)
    const refundTotalCents = amountToCents(order.refundTotal ?? 0)
    const merchant = getMerchantAccumulator(merchantMap, order.merchantName)
    const month = getMonthKey(order.orderDate)
    const monthlySpend = getMonthlyAccumulator(merchant.monthlySpend, month)

    merchant.orderCount += orderTotalCents > 0 ? 1 : 0
    merchant.totalSpendCents += orderTotalCents
    merchant.refundTotalCents += refundTotalCents
    monthlySpend.totalSpendCents += orderTotalCents
    monthlySpend.refundTotalCents += refundTotalCents
  }

  return Array.from(merchantMap.values())
    .map((merchant) => ({
      merchantName: merchant.merchantName,
      orderCount: merchant.orderCount,
      refundTotal: centsToAmount(merchant.refundTotalCents),
      totalSpend: centsToAmount(merchant.totalSpendCents),
      netSpend: centsToAmount(
        merchant.totalSpendCents - merchant.refundTotalCents,
      ),
      monthlySpend: Array.from(merchant.monthlySpend.values())
        .map((month) => ({
          month: month.month,
          refundTotal: centsToAmount(month.refundTotalCents),
          totalSpend: centsToAmount(month.totalSpendCents),
          netSpend: centsToAmount(
            month.totalSpendCents - month.refundTotalCents,
          ),
        }))
        .sort((firstMonth, secondMonth) =>
          firstMonth.month.localeCompare(secondMonth.month),
        ),
    }))
    .sort((firstMerchant, secondMerchant) =>
      secondMerchant.netSpend - firstMerchant.netSpend,
    )
}

export function formatCurrency(amount = 0) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
  }).format(amount)
}

function getOrderAccumulator(
  orderMap: Map<string, OrderAccumulator>,
  {
    email,
    merchantName,
    orderNumber,
  }: {
    email: Email
    merchantName: string
    orderNumber: string
  },
) {
  const orderKey = `${merchantName.toLowerCase()}::${orderNumber.toLowerCase()}`
  const existingOrder = orderMap.get(orderKey)

  if (existingOrder) {
    return existingOrder
  }

  return {
    merchantName,
    orderNumber,
    orderDate: email.date,
    status: 'confirmed',
    items: [],
    replacedItems: [],
    refundedItems: [],
    refundTotalCents: 0,
    relatedEmailIds: new Set<string>(),
  } satisfies OrderAccumulator
}

function toOrderUpdate(order: OrderAccumulator): OrderUpdate {
  const finalChargedAmount =
    order.orderTotalCents === undefined
      ? undefined
      : centsToAmount(order.orderTotalCents - order.refundTotalCents)

  return {
    id: `order_${slugify(order.merchantName)}_${slugify(order.orderNumber)}`,
    merchantName: order.merchantName,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    expectedDeliveryTime: order.expectedDeliveryTime,
    deliveredTime: order.deliveredTime,
    trackingNumber: order.trackingNumber,
    trackingDetails: order.trackingDetails,
    items: order.items.length ? order.items : undefined,
    replacedItems: order.replacedItems.length ? order.replacedItems : undefined,
    refundedItems: order.refundedItems.length ? order.refundedItems : undefined,
    orderTotal:
      order.orderTotalCents === undefined
        ? undefined
        : centsToAmount(order.orderTotalCents),
    refundTotal: order.refundTotalCents
      ? centsToAmount(order.refundTotalCents)
      : undefined,
    finalChargedAmount,
    relatedEmailIds: Array.from(order.relatedEmailIds),
  }
}

function isOrderSignal(email: Email) {
  const labels = email.labels?.map((label) => label.toLowerCase()) ?? []
  const text = getSearchText(email)

  return (
    labels.includes('transactions') ||
    labels.includes('orders') ||
    text.includes('order total') ||
    text.includes('refund') ||
    text.includes('tracking number') ||
    text.includes('replaced')
  )
}

function extractMerchantName(email: Email) {
  const merchantMatch = email.body.match(/merchant:\s*([^.]+)/i)

  if (merchantMatch) {
    return merchantMatch[1].trim()
  }

  return email.sender.replace(/\s*<[^>]+>\s*$/, '').trim()
}

function extractOrderNumber(body: string) {
  const orderMatch = body.match(/\border\s+([A-Z0-9-]+)/i)
  return orderMatch?.[1]
}

function extractOrderTotalCents(body: string) {
  const totalMatch = body.match(/order total:\s*\$(\d+(?:\.\d{2})?)/i)
  return totalMatch ? parseCurrencyAmountCents(totalMatch[1]) : undefined
}

function extractRefundedItem(body: string): RefundedItem | undefined {
  const refundMatch = body.match(
    /refund of \$(\d+(?:\.\d{2})?) for (.+?) on order/i,
  )

  if (!refundMatch) {
    return undefined
  }

  return {
    amount: centsToAmount(parseCurrencyAmountCents(refundMatch[1])),
    name: refundMatch[2].trim(),
  }
}

function extractReplacedItem(body: string): ReplacedItem | undefined {
  const replacementMatch = body.match(
    /(.+?) were unavailable.*replaced them with (.+?) at no extra charge/i,
  )

  if (!replacementMatch) {
    return undefined
  }

  return {
    originalItem: replacementMatch[1].trim(),
    replacementItem: replacementMatch[2].trim(),
    priceDifference: extractPriceDifference(body),
  }
}

function extractOrderItems(body: string): OrderItem[] {
  const itemText = extractItemText(body)

  if (!itemText) {
    return []
  }

  return itemText
    .split(';')
    .map((itemTextPart) => {
      const itemMatch = itemTextPart
        .trim()
        .match(/^(.+?)\s+\$(\d+(?:\.\d{2})?)$/)

      if (!itemMatch) {
        return undefined
      }

      return {
        name: itemMatch[1].trim(),
        price: centsToAmount(parseCurrencyAmountCents(itemMatch[2])),
      }
    })
    .filter((item): item is OrderItem => Boolean(item))
}

function extractItemText(body: string) {
  const itemTextMatch = body.match(/Items:\s*(.+?)(?:\.\s*Order total:|$)/i)
  return itemTextMatch?.[1].replace(/\.$/, '').trim()
}

function extractPriceDifference(body: string) {
  const priceDifference = body.match(/price difference:\s*\$(\d+(?:\.\d{2})?)/i)
  return priceDifference
    ? centsToAmount(parseCurrencyAmountCents(priceDifference[1]))
    : undefined
}

function mergeItems(currentItems: OrderItem[], nextItems: OrderItem[]) {
  const itemMap = new Map(currentItems.map((item) => [item.name, item]))

  for (const item of nextItems) {
    itemMap.set(item.name, item)
  }

  return Array.from(itemMap.values())
}

function extractDeliveryStatus(email: Email): DeliveryStatus | undefined {
  const text = getSearchText(email)

  if (text.includes('out for delivery')) {
    return 'out_for_delivery'
  }

  if (text.includes('ready for pickup')) {
    return 'out_for_delivery'
  }

  if (text.includes('delivered')) {
    return 'delivered'
  }

  if (text.includes('delayed')) {
    return 'delayed'
  }

  if (text.includes('shipped') || text.includes('tracking number')) {
    return 'shipped'
  }

  return undefined
}

function extractExpectedDeliveryTime(body: string) {
  return (
    extractAfterLabel(body, 'Estimated delivery') ??
    body.match(/ready for pickup today by ([^.]+)/i)?.[1]?.trim() ??
    body.match(/arrive today by ([^.]+)/i)?.[1]?.trim()
  )
}

function extractDeliveredTime(body: string) {
  return body.match(/delivered at ([^.]+)/i)?.[1]?.trim()
}

function extractAfterLabel(body: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = body.match(new RegExp(`${escapedLabel}:\\s*([^\\.]+)`, 'i'))
  return match?.[1].trim()
}

function deriveStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus | DeliveryStatus,
): OrderStatus {
  const rank: Record<OrderStatus, number> = {
    confirmed: 1,
    updated: 2,
    shipped: 3,
    out_for_delivery: 4,
    delivered: 5,
    partially_refunded: 6,
    refunded: 7,
  }
  const normalizedNextStatus =
    nextStatus === 'delayed' ? 'shipped' : nextStatus

  return rank[normalizedNextStatus] > rank[currentStatus]
    ? normalizedNextStatus
    : currentStatus
}

function parseCurrencyAmountCents(value: string) {
  const [dollars, cents = '0'] = value.split('.')
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0').slice(0, 2))
}

function amountToCents(amount: number) {
  return Math.round(amount * 100)
}

function centsToAmount(cents: number) {
  return Math.round(cents) / 100
}

function getEarlierTimestamp(currentTimestamp: string, nextTimestamp: string) {
  return new Date(nextTimestamp).getTime() < new Date(currentTimestamp).getTime()
    ? nextTimestamp
    : currentTimestamp
}

function getMonthKey(timestamp: string) {
  return timestamp.slice(0, 7)
}

function getSearchText(email: Email) {
  return `${email.sender} ${email.subject} ${email.body} ${
    email.labels?.join(' ') ?? ''
  }`.toLowerCase()
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type OrderAccumulator = {
  merchantName: string
  orderNumber: string
  orderDate: string
  status: OrderStatus
  deliveryStatus?: DeliveryStatus
  expectedDeliveryTime?: string
  deliveredTime?: string
  trackingNumber?: string
  trackingDetails?: string
  items: OrderItem[]
  replacedItems: ReplacedItem[]
  refundedItems: RefundedItem[]
  orderTotalCents?: number
  refundTotalCents: number
  relatedEmailIds: Set<string>
}

type MerchantAccumulator = {
  merchantName: string
  orderCount: number
  refundTotalCents: number
  totalSpendCents: number
  monthlySpend: Map<string, MonthlyAccumulator>
}

type MonthlyAccumulator = {
  month: string
  refundTotalCents: number
  totalSpendCents: number
}

function getMerchantAccumulator(
  merchantMap: Map<string, MerchantAccumulator>,
  merchantName: string,
) {
  const existingMerchant = merchantMap.get(merchantName)

  if (existingMerchant) {
    return existingMerchant
  }

  const merchant = {
    merchantName,
    orderCount: 0,
    refundTotalCents: 0,
    totalSpendCents: 0,
    monthlySpend: new Map<string, MonthlyAccumulator>(),
  }
  merchantMap.set(merchantName, merchant)
  return merchant
}

function getMonthlyAccumulator(
  monthlyMap: Map<string, MonthlyAccumulator>,
  month: string,
) {
  const existingMonth = monthlyMap.get(month)

  if (existingMonth) {
    return existingMonth
  }

  const monthlySpend = {
    month,
    refundTotalCents: 0,
    totalSpendCents: 0,
  }
  monthlyMap.set(month, monthlySpend)
  return monthlySpend
}
