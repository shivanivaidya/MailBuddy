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
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-4">
      {summaryItems.map((item) => (
        <article
          className="rounded-md border border-slate-100 bg-slate-50 px-4 py-4"
          key={item.label}
        >
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {item.value}
          </p>
          <p className="mt-1 text-xs font-medium text-cyan-700">
            {item.detail}
          </p>
        </article>
      ))}
    </section>
  )
}
