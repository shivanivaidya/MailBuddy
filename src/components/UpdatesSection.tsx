import { useEffect, useMemo, useRef, useState } from 'react'
import type { MerchantSpendSummary, OrderUpdate } from '@/types/mail'
import { formatCurrency } from '@/utils/updateProcessing'

type UpdatesSectionProps = {
  onToggleOrder: (orderId: string) => void
  orderUpdates: OrderUpdate[]
  selectedOrderId: string | null
}

export function UpdatesSpendSection({
  merchantSpend,
}: {
  merchantSpend: MerchantSpendSummary[]
}) {
  return (
    <details
      className="group rounded-2xl bg-gradient-to-br from-violet-50 via-pink-50 to-white p-5 shadow-sm ring-1 ring-violet-200"
      open
    >
      <summary className="cursor-pointer list-none px-1 marker:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">
              Spend statistics
            </h3>
            <p className="mt-2 text-base leading-7 text-slate-600">
              A quick visual breakdown for the selected date range.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/80 text-violet-700 ring-1 ring-violet-100 transition group-open:rotate-180"
          >
            <ChevronDownIcon />
          </span>
        </div>
      </summary>

      <div className="mt-5">
        <SpendSummary merchantSpend={merchantSpend} />
      </div>
    </details>
  )
}

export function UpdatesSection({
  onToggleOrder,
  orderUpdates,
  selectedOrderId,
}: UpdatesSectionProps) {
  const [activeStatuses, setActiveStatuses] = useState<Set<OrderUpdate['status']>>(
    () => new Set(),
  )
  const [activeMerchants, setActiveMerchants] = useState<Set<string>>(
    () => new Set(),
  )
  const [openFilter, setOpenFilter] = useState<'merchant' | 'status' | null>(
    null,
  )
  const filtersRef = useRef<HTMLDivElement>(null)
  const availableStatuses = useMemo(
    () =>
      statusOrder.filter((status) =>
        orderUpdates.some((order) => order.status === status),
      ),
    [orderUpdates],
  )
  const availableMerchants = useMemo(
    () =>
      [...new Set(orderUpdates.map((order) => order.merchantName))].sort(
        (firstMerchant, secondMerchant) =>
          firstMerchant.localeCompare(secondMerchant),
      ),
    [orderUpdates],
  )
  const filteredOrderUpdates =
    activeStatuses.size > 0 || activeMerchants.size > 0
      ? orderUpdates.filter(
          (order) =>
            (activeStatuses.size === 0 || activeStatuses.has(order.status)) &&
            (activeMerchants.size === 0 ||
              activeMerchants.has(order.merchantName)),
        )
      : orderUpdates

  useEffect(() => {
    if (!openFilter) {
      return undefined
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setOpenFilter(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [openFilter])

  function toggleStatus(status: OrderUpdate['status']) {
    setActiveStatuses((currentStatuses) => {
      const nextStatuses = new Set(currentStatuses)

      if (nextStatuses.has(status)) {
        nextStatuses.delete(status)
      } else {
        nextStatuses.add(status)
      }

      return nextStatuses
    })
  }

  function toggleMerchant(merchantName: string) {
    setActiveMerchants((currentMerchants) => {
      const nextMerchants = new Set(currentMerchants)

      if (nextMerchants.has(merchantName)) {
        nextMerchants.delete(merchantName)
      } else {
        nextMerchants.add(merchantName)
      }

      return nextMerchants
    })
  }

  return (
    <section className="overflow-visible rounded-2xl bg-slate-950 p-6 shadow-sm">
      <div className="flex flex-col gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold">Order updates & spend</h3>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300">
            Orders grouped from related emails.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-md bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3 text-base font-semibold text-white">
          {filteredOrderUpdates.length} updates
        </span>
      </div>

      {availableStatuses.length > 0 ? (
        <div
          className="mt-8 grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-start"
          ref={filtersRef}
        >
          <div className="flex size-10 items-center justify-center pt-3 text-slate-300">
            <FilterIcon />
          </div>

          <FilterDropdown
            label={
              activeStatuses.size
                ? `${activeStatuses.size} ${
                    activeStatuses.size === 1 ? 'status' : 'statuses'
                  } selected`
                : 'All statuses'
            }
            onToggle={() =>
              setOpenFilter((currentFilter) =>
                currentFilter === 'status' ? null : 'status',
              )
            }
            open={openFilter === 'status'}
          >
            {availableStatuses.map((status) => {
              const isActive = activeStatuses.has(status)

              return (
                <FilterOption
                  active={isActive}
                  key={status}
                  label={formatStatus(status)}
                  onClick={() => toggleStatus(status)}
                />
              )
            })}
          </FilterDropdown>

          <FilterDropdown
            label={
              activeMerchants.size
                ? `${activeMerchants.size} ${
                    activeMerchants.size === 1 ? 'merchant' : 'merchants'
                  } selected`
                : 'All merchants'
            }
            onToggle={() =>
              setOpenFilter((currentFilter) =>
                currentFilter === 'merchant' ? null : 'merchant',
              )
            }
            open={openFilter === 'merchant'}
          >
            {availableMerchants.map((merchantName) => (
              <FilterOption
                active={activeMerchants.has(merchantName)}
                key={merchantName}
                label={merchantName}
                onClick={() => toggleMerchant(merchantName)}
              />
            ))}
          </FilterDropdown>
        </div>
      ) : null}

      <div className="mt-4 space-y-5">
        {filteredOrderUpdates.length > 0 ? (
          filteredOrderUpdates.map((order, index) => (
            <OrderUpdateCard
              index={index}
              key={order.id}
              onToggleOrder={onToggleOrder}
              order={order}
              selected={selectedOrderId === order.id}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-cyan-300 bg-cyan-50 p-8 text-center">
            <p className="font-semibold text-slate-950">
              No data found for this date range.
            </p>
          </div>
        )}
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
      className={`rounded-2xl bg-white px-7 py-6 text-left shadow-sm ring-1 transition ${
        selected
          ? 'ring-4 ring-pink-400'
          : 'ring-slate-100 hover:ring-slate-200'
      }`}
      onClick={() => onToggleOrder(order.id)}
    >
      <div className="flex min-w-0 gap-4">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-lg font-medium text-slate-500">
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
            <span
              className={`w-fit rounded-md border px-4 py-2 text-lg font-semibold capitalize ${statusStyles[order.status]}`}
            >
              {formatStatus(order.status)}
            </span>
          </div>

          <p className="mt-3 text-base font-semibold text-slate-500">
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
  const [activeCategory, setActiveCategory] = useState<SpendCategory>('all')
  const visibleMerchantSpend = merchantSpend.filter((merchant) =>
    activeCategory === 'all'
      ? true
      : getMerchantSpendCategory(merchant.merchantName) === activeCategory,
  )
  const totalSpend = visibleMerchantSpend.reduce(
    (total, merchant) => total + merchant.totalSpend,
    0,
  )
  const refundTotal = visibleMerchantSpend.reduce(
    (total, merchant) => total + merchant.refundTotal,
    0,
  )
  const netSpend = totalSpend - refundTotal
  const topMerchants = [...visibleMerchantSpend]
    .filter((merchant) => merchant.netSpend > 0)
    .sort((firstMerchant, secondMerchant) =>
      secondMerchant.netSpend - firstMerchant.netSpend,
    )
  const highestMerchantSpend = topMerchants[0]?.netSpend ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {spendCategories.map((category) => (
          <button
            aria-pressed={activeCategory === category.id}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              activeCategory === category.id
                ? 'bg-pink-600 text-white ring-pink-600'
                : 'bg-pink-50 text-pink-700 ring-pink-100 hover:bg-pink-100'
            }`}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Spent" value={formatCurrency(totalSpend)} />
        <SummaryTile label="Refunded" value={formatCurrency(refundTotal)} />
        <SummaryTile label="Net" value={formatCurrency(netSpend)} />
      </div>

      <div className="rounded-2xl bg-white/75 p-5 ring-1 ring-pink-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">
              Top merchants
            </p>
            <p className="mt-1 text-sm text-slate-500">
              A quick view of where spending is concentrated.
            </p>
          </div>
        </div>

        <div aria-label="Top merchants" className="mt-5 space-y-4">
          {topMerchants.map((merchant) => (
            <SpendBar
              key={merchant.merchantName}
              merchant={merchant}
              maxSpend={highestMerchantSpend}
            />
          ))}
          {topMerchants.length === 0 ? (
            <p className="rounded-xl bg-white/70 px-4 py-5 text-center text-sm font-medium text-slate-500">
              No merchant spend for this category in this date range.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type SpendCategory = 'all' | 'beauty' | 'dining' | 'groceries'

const spendCategories: Array<{ id: SpendCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'groceries', label: 'Groceries' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'dining', label: 'Dining' },
]

const merchantCategoryMatchers: Array<{
  category: Exclude<SpendCategory, 'all'>
  pattern: RegExp
}> = [
  {
    category: 'groceries',
    pattern: /\b(whole foods|instacart|market|grocery|groceries|foods?)\b/,
  },
  {
    category: 'beauty',
    pattern: /\b(sephora|ulta|beauty|cosmetic|cosmetics)\b/,
  },
  {
    category: 'dining',
    pattern: /\b(restaurant|dining|cafe|coffee|thai|garden|kitchen|bistro|grill)\b/,
  },
]

function getMerchantSpendCategory(merchantName: string): SpendCategory | 'other' {
  const normalizedName = merchantName.toLowerCase()
  const matchingCategory = merchantCategoryMatchers.find(({ pattern }) =>
    pattern.test(normalizedName),
  )

  return matchingCategory?.category ?? 'other'
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/85 p-5 ring-1 ring-violet-100">
      <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function SpendBar({
  maxSpend,
  merchant,
}: {
  maxSpend: number
  merchant: MerchantSpendSummary
}) {
  const width = maxSpend > 0
    ? Math.max(8, Math.round((merchant.netSpend / maxSpend) * 100))
    : 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate text-sm font-semibold text-slate-700">
          {merchant.merchantName}
        </span>
        <span className="shrink-0 text-sm font-semibold text-slate-950">
          {formatCurrency(merchant.netSpend)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-emerald-50/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-200 to-teal-200"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function FilterDropdown({
  children,
  label,
  onToggle,
  open,
}: {
  children: React.ReactNode
  label: string
  onToggle: () => void
  open: boolean
}) {
  return (
    <div className="relative">
      <button
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-slate-500 bg-slate-800 px-5 text-left text-base font-semibold text-white transition hover:bg-slate-700"
        onClick={onToggle}
        type="button"
      >
        {label}
        <span
          aria-hidden="true"
          className={`shrink-0 transition ${open ? 'rotate-180' : ''}`}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-3 max-h-80 overflow-auto rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-2xl shadow-slate-950/40">
          <div className="space-y-1">{children}</div>
        </div>
      ) : null}
    </div>
  )
}

function FilterOption({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className="flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left text-base font-semibold text-white transition hover:bg-white/5"
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded border-2 ${
          active
            ? 'border-pink-500 bg-pink-500 text-white'
            : 'border-slate-500 text-transparent'
        }`}
      >
        <CheckIcon />
      </span>
      <span>{label}</span>
    </button>
  )
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

const statusOrder: OrderUpdate['status'][] = [
  'out_for_delivery',
  'shipped',
  'delivered',
  'partially_refunded',
  'refunded',
  'updated',
  'confirmed',
]

const statusStyles: Record<OrderUpdate['status'], string> = {
  confirmed: 'border-lime-200 bg-lime-50 text-lime-700',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  out_for_delivery: 'border-sky-200 bg-sky-50 text-sky-700',
  partially_refunded: 'border-amber-200 bg-amber-50 text-amber-800',
  refunded: 'border-rose-200 bg-rose-50 text-rose-700',
  shipped: 'border-blue-200 bg-blue-50 text-blue-700',
  updated: 'border-slate-200 bg-slate-50 text-slate-700',
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
