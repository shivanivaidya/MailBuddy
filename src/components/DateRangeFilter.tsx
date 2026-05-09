import { useEffect, useRef, useState } from 'react'
import type { MailDateRange } from '@/hooks/useMailBuddyDemo'

type DateRangeFilterProps = {
  availableDateRange: MailDateRange
  dateRange: MailDateRange
  meta: string
  onChange: (updates: Partial<MailDateRange>) => void
}

export function DateRangeFilter({
  availableDateRange,
  dateRange,
  meta,
  onChange,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeBoundary, setActiveBoundary] = useState<'endDate' | 'startDate'>(
    'startDate',
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [isOpen])

  return (
    <div className="relative w-fit" ref={containerRef}>
      <button
        className="inline-flex items-center gap-5 rounded-3xl border-4 border-slate-200 bg-white px-5 py-4 text-slate-950 shadow-sm transition hover:border-pink-200"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex size-9 items-center justify-center text-pink-500">
          <CalendarIcon />
        </span>
        <span className="text-base font-semibold">{formatDateRange(dateRange)}</span>
        <span className="rounded-full bg-pink-50 px-6 py-2 text-base font-semibold text-pink-600">
          {meta}
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-1 top-20 z-20 w-[560px] rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-2xl shadow-slate-900/15">
          <div className="sr-only">
            <DateInput
              max={dateRange.endDate}
              min={availableDateRange.startDate}
              onChange={(startDate) => onChange({ startDate })}
              value={dateRange.startDate}
            />
            <DateInput
              max={availableDateRange.endDate}
              min={dateRange.startDate}
              onChange={(endDate) => onChange({ endDate })}
              value={dateRange.endDate}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              aria-label="Previous month"
              className="flex size-10 items-center justify-center text-slate-950"
              type="button"
            >
              <ChevronLeftIcon />
            </button>
            <p className="text-base font-semibold text-slate-950">April 2026</p>
            <button
              aria-label="Next month"
              className="flex size-10 items-center justify-center text-slate-950"
              type="button"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-7 gap-y-3 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <p className="text-base font-semibold text-slate-500" key={day}>
                {day}
              </p>
            ))}
            {calendarDays.map((day) => (
              <CalendarDay
                activeBoundary={activeBoundary}
                dateRange={dateRange}
                day={day}
                key={`${day.month}-${day.value}`}
                onChange={onChange}
                onSelectBoundary={setActiveBoundary}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <BoundaryButton
                active={activeBoundary === 'startDate'}
                label="Start date"
                onClick={() => setActiveBoundary('startDate')}
              />
              <BoundaryButton
                active={activeBoundary === 'endDate'}
                label="End date"
                onClick={() => setActiveBoundary('endDate')}
              />
            </div>
            <button
              className="text-base font-semibold text-pink-600"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const calendarDays = [
  { disabled: true, month: 'previous', value: 29 },
  { disabled: true, month: 'previous', value: 30 },
  { disabled: true, month: 'previous', value: 31 },
  ...Array.from({ length: 30 }, (_, index) => ({
    month: 'april',
    value: index + 1,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    disabled: index > 0,
    month: 'may',
    value: index + 1,
  })),
]

function CalendarDay({
  activeBoundary,
  dateRange,
  day,
  onChange,
  onSelectBoundary,
}: {
  activeBoundary: 'endDate' | 'startDate'
  dateRange: MailDateRange
  day: { disabled?: boolean; month: string; value: number }
  onChange: (updates: Partial<MailDateRange>) => void
  onSelectBoundary: (boundary: 'endDate' | 'startDate') => void
}) {
  const dateValue =
    day.month === 'april'
      ? `2026-04-${String(day.value).padStart(2, '0')}`
      : day.month === 'may'
        ? `2026-05-${String(day.value).padStart(2, '0')}`
        : ''
  const isStart = dateValue === dateRange.startDate
  const isEnd = dateValue === dateRange.endDate
  const isInRange =
    Boolean(dateValue) &&
    dateValue >= dateRange.startDate &&
    dateValue <= dateRange.endDate

  function selectDate() {
    if (!dateValue || day.disabled) {
      return
    }

    if (activeBoundary === 'startDate') {
      onChange(
        dateValue > dateRange.endDate
          ? { endDate: dateValue, startDate: dateValue }
          : { startDate: dateValue },
      )
      onSelectBoundary('endDate')
      return
    }

    onChange(
      dateValue < dateRange.startDate
        ? { endDate: dateValue, startDate: dateValue }
        : { endDate: dateValue },
    )
  }

  return (
    <button
      aria-label={dateValue ? `Select ${dateValue}` : undefined}
      className={`mx-auto flex size-9 items-center justify-center rounded-2xl text-base font-semibold transition ${
        isStart || isEnd
          ? 'bg-pink-600 text-white shadow-inner shadow-pink-900/20'
          : isInRange
            ? 'bg-pink-50 text-slate-950'
            : day.disabled
              ? 'text-slate-300'
              : 'text-slate-950 hover:bg-slate-50'
      }`}
      disabled={day.disabled}
      onClick={selectDate}
      type="button"
    >
      {day.value}
    </button>
  )
}

function BoundaryButton({
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
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-white text-pink-600 shadow-sm'
          : 'text-slate-500 hover:text-slate-900'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function DateInput({
  max,
  min,
  onChange,
  value,
}: {
  max: string
  min: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <input
      aria-label="Date range value"
      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
      max={max}
      min={min}
      onChange={(event) => onChange(event.target.value)}
      type="date"
      value={value}
    />
  )
}

function formatDateRange(dateRange: MailDateRange) {
  const startDate = new Date(`${dateRange.startDate}T00:00:00`)
  const endDate = new Date(`${dateRange.endDate}T00:00:00`)
  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth()
  const startFormatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
  const endFormatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
    year: 'numeric',
  })

  return `${startFormatter.format(startDate)} – ${endFormatter.format(endDate)}`
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
