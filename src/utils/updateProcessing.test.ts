import { describe, expect, it } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import {
  extractOrderUpdates,
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
})
