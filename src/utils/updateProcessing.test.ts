import { describe, expect, it } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import type { Email } from '@/types/mail'
import {
  extractOrderUpdates,
  formatCurrency,
  generateMerchantSpendSummaries,
} from '@/utils/updateProcessing'

describe('order update processing', () => {
  it('groups multiple transactional emails into one order card', () => {
    const orders = extractOrderUpdates(sampleEmails)
    const wholeFoodsOrders = orders.filter(
      (order) => order.merchantName === 'Whole Foods Market',
    )
    const wholeFoodsOrder = wholeFoodsOrders.find(
      (order) => order.orderNumber === 'WF-1048',
    )
    const secondWholeFoodsOrder = wholeFoodsOrders.find(
      (order) => order.orderNumber === 'WF-20491',
    )
    const instacartOrder = orders.find(
      (order) => order.merchantName === 'Instacart',
    )

    expect(orders).toHaveLength(5)
    expect(wholeFoodsOrders).toHaveLength(2)
    expect(wholeFoodsOrder).toMatchObject({
      deliveryStatus: 'delivered',
      items: expect.arrayContaining([
        { name: 'organic bananas', price: 4.29 },
        { name: 'oat milk', price: 5.49 },
      ]),
      orderNumber: 'WF-1048',
      orderTotal: 86.42,
      status: 'delivered',
    })
    expect(secondWholeFoodsOrder).toMatchObject({
      deliveryStatus: 'out_for_delivery',
      orderNumber: 'WF-20491',
      orderTotal: 42.15,
      status: 'out_for_delivery',
    })
    expect(wholeFoodsOrder?.relatedEmailIds).toEqual(
      expect.arrayContaining([
        'email_whole_foods_delivery',
        'email_replacement_notice',
      ]),
    )
    expect(wholeFoodsOrder?.replacedItems).toEqual([
      {
        originalItem: 'Organic strawberries',
        priceDifference: 0,
        replacementItem: 'organic blueberries',
      },
    ])
    expect(instacartOrder?.relatedEmailIds).toEqual(
      expect.arrayContaining([
        'email_instacart_order',
        'email_refund_confirmation',
      ]),
    )
  })

  it('computes refunds, final charged amount, and merchant spend in code', () => {
    const orders = extractOrderUpdates(sampleEmails)
    const instacartOrder = orders.find(
      (order) => order.merchantName === 'Instacart',
    )
    const merchantSpend = generateMerchantSpendSummaries(orders)
    const instacartSpend = merchantSpend.find(
      (merchant) => merchant.merchantName === 'Instacart',
    )

    expect(instacartOrder).toMatchObject({
      finalChargedAmount: 51.69,
      orderTotal: 64.18,
      refundTotal: 12.49,
      status: 'partially_refunded',
    })
    expect(instacartSpend).toMatchObject({
      netSpend: 51.69,
      refundTotal: 12.49,
      totalSpend: 64.18,
    })
    expect(instacartSpend?.monthlySpend[0]).toMatchObject({
      month: '2026-04',
      netSpend: 51.69,
    })
  })

  it('keeps multiple refunds and replacements as individual structured entries', () => {
    const emails: Email[] = [
      {
        id: 'order',
        sender: 'Whole Foods Market <orders@wholefoods.example>',
        subject: 'Your Whole Foods order was delivered',
        body: 'Your Whole Foods Market order WF-3000 was delivered at 6:00 PM. Order total: $20.00. Items: apples $5.00; yogurt $7.00; crackers $8.00.',
        date: '2026-04-30T18:00:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Transactions'],
      },
      {
        id: 'replacement-one',
        sender: 'Whole Foods Market <orders@wholefoods.example>',
        subject: 'Item replacement in your Whole Foods order',
        body: 'Organic apples were unavailable in order WF-3000. We replaced them with gala apples at no extra charge. Price difference: $0.00.',
        date: '2026-04-30T18:05:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Transactions'],
      },
      {
        id: 'replacement-two',
        sender: 'Whole Foods Market <orders@wholefoods.example>',
        subject: 'Item replacement in your Whole Foods order',
        body: 'Greek yogurt were unavailable in order WF-3000. We replaced them with coconut yogurt at no extra charge. Price difference: $1.25.',
        date: '2026-04-30T18:06:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Transactions'],
      },
      {
        id: 'refund-one',
        sender: 'Whole Foods Market <orders@wholefoods.example>',
        subject: 'Refund confirmation',
        body: 'We issued a refund of $2.40 for damaged crackers on order WF-3000. The refund should appear soon.',
        date: '2026-04-30T19:00:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Refunds', 'Transactions'],
      },
      {
        id: 'refund-two',
        sender: 'Whole Foods Market <orders@wholefoods.example>',
        subject: 'Refund confirmation',
        body: 'We issued a refund of $1.10 for bag fee adjustment on order WF-3000. The refund should appear soon.',
        date: '2026-04-30T19:15:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Refunds', 'Transactions'],
      },
    ]

    const [order] = extractOrderUpdates(emails)

    expect(order.replacedItems).toEqual([
      {
        originalItem: 'Organic apples',
        priceDifference: 0,
        replacementItem: 'gala apples',
      },
      {
        originalItem: 'Greek yogurt',
        priceDifference: 1.25,
        replacementItem: 'coconut yogurt',
      },
    ])
    expect(order.refundedItems).toEqual([
      { amount: 2.4, name: 'damaged crackers' },
      { amount: 1.1, name: 'bag fee adjustment' },
    ])
    expect(order.refundTotal).toBe(3.5)
    expect(order.finalChargedAmount).toBe(16.5)
  })

  it('rounds currency math to two decimals for spend metrics', () => {
    const emails: Email[] = [
      {
        id: 'first-order',
        sender: 'Test Merchant <orders@testmerchant.example>',
        subject: 'Order confirmed',
        body: 'Your Test Merchant order TM-1 is confirmed. Order total: $0.10.',
        date: '2026-04-29T10:00:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Transactions'],
      },
      {
        id: 'second-order',
        sender: 'Test Merchant <orders@testmerchant.example>',
        subject: 'Order confirmed',
        body: 'Your Test Merchant order TM-2 is confirmed. Order total: $0.20.',
        date: '2026-04-29T11:00:00.000Z',
        direction: 'inbound',
        labels: ['Orders', 'Transactions'],
      },
    ]

    const spend = generateMerchantSpendSummaries(extractOrderUpdates(emails))

    expect(spend[0]).toMatchObject({
      netSpend: 0.3,
      refundTotal: 0,
      totalSpend: 0.3,
    })
    expect(formatCurrency(spend[0].netSpend)).toBe('$0.30')
  })
})
