import type { MerchantSpendSummary, OrderUpdate } from '@/types/mail'
import { formatCurrency } from '@/utils/updateProcessing'

type UpdatesSectionProps = {
  merchantSpend: MerchantSpendSummary[]
  onToggleOrder: (orderId: string) => void
  orderUpdates: OrderUpdate[]
  selectedOrderId: string | null
}

export function UpdatesSection({
  merchantSpend,
  onToggleOrder,
  orderUpdates,
  selectedOrderId,
}: UpdatesSectionProps) {
  return (
    <section className="rounded-lg bg-white/80 shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-xl font-semibold text-slate-950">
          Order updates & spend
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Orders grouped from related emails. Spend metrics shown for the
          selected date range.
        </p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <SpendSummary merchantSpend={merchantSpend} />

        <div className="space-y-3">
          {orderUpdates.length > 0 ? (
            orderUpdates.map((order, index) => (
              <OrderUpdateCard
                index={index}
                key={order.id}
                onToggleOrder={onToggleOrder}
                order={order}
                selected={selectedOrderId === order.id}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No data found for this date range.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function OrderUpdateCard({
  index,
  onToggleOrder,
  order,
  selected,
}: {
  index: number
  onToggleOrder: (orderId: string) => void
  order: OrderUpdate
  selected: boolean
}) {
  return (
    <article
      className={`rounded-lg bg-white px-4 py-5 text-left shadow-sm ring-1 transition sm:px-5 ${
        selected ? 'ring-4 ring-cyan-100' : 'ring-slate-100 hover:ring-slate-200'
      }`}
      onClick={() => onToggleOrder(order.id)}
    >
      <div className="flex min-w-0 gap-4 md:items-center">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 md:mt-0">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold leading-snug text-slate-950 sm:text-xl">
                {order.merchantName}
              </h4>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {formatDate(order.orderDate)}
              </p>
            </div>
            <span className="w-fit rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold capitalize text-white">
              {formatStatus(order.status)}
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-600">
            Order #{order.orderNumber}
          </p>
        </div>
      </div>
    </article>
  )
}

function SpendSummary({
  merchantSpend,
}: {
  merchantSpend: MerchantSpendSummary[]
}) {
  const totalSpend = merchantSpend.reduce(
    (total, merchant) => total + merchant.totalSpend,
    0,
  )
  const refundTotal = merchantSpend.reduce(
    (total, merchant) => total + merchant.refundTotal,
    0,
  )
  const netSpend = totalSpend - refundTotal

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryTile
        label="Total spend (selected date range)"
        value={formatCurrency(totalSpend)}
      />
      <SummaryTile
        label="Refunds (selected date range)"
        value={formatCurrency(refundTotal)}
      />
      <SummaryTile
        label="Net spend (selected date range)"
        value={formatCurrency(netSpend)}
      />
      <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100 sm:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Merchant spend
        </p>
        <div className="mt-3 space-y-2">
          {merchantSpend.map((merchant) => (
            <div
              className="flex items-center justify-between gap-3 text-sm"
              key={merchant.merchantName}
            >
              <span className="font-medium text-slate-700">
                {merchant.merchantName}
              </span>
              <span className="font-semibold text-slate-950">
                {formatCurrency(merchant.netSpend)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function formatStatus(value: OrderUpdate['status']) {
  return value.replace(/_/g, ' ')
}
