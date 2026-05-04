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
        className="inline-flex items-center gap-3 rounded-full border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-white text-cyan-700 ring-1 ring-cyan-100">
          <CalendarIcon />
        </span>
        <span className="font-semibold">{formatDateRange(dateRange)}</span>
        <span className="h-4 w-px bg-cyan-200" />
        <span className="text-xs font-semibold text-slate-500">{meta}</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-11 z-10 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:grid-cols-2">
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
      ) : null}
    </div>
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
      className="size-4"
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
