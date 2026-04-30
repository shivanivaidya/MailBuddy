import type { DashboardStats } from '@/types/mail'

type SummaryStripProps = {
  stats: DashboardStats
}

export function SummaryStrip({ stats }: SummaryStripProps) {
  const summaryItems = [
    {
      label: 'Emails processed',
      value: stats.emailsProcessed,
      detail: 'Sample inbox',
    },
    {
      label: 'Suggested tasks found',
      value: stats.tasksFound,
      detail: 'Ready to review',
    },
    {
      label: 'High priority tasks',
      value: stats.highPriorityTasks,
      detail: 'Needs attention',
    },
    {
      label: 'Completed tasks',
      value: stats.completedTasks,
      detail: 'Demo state',
    },
  ]

  return (
    <section className="grid gap-2 rounded-lg bg-white/70 p-2 ring-1 ring-slate-200 md:grid-cols-4">
      {summaryItems.map((item) => (
        <article
          className="rounded-md bg-slate-50/70 px-4 py-3"
          key={item.label}
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {item.value}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {item.detail}
          </p>
        </article>
      ))}
    </section>
  )
}
