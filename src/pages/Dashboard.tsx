import { SourceEmailPreview } from '@/components/SourceEmailPreview'
import { SuggestedTodoList } from '@/components/SuggestedTodoList'
import { SummaryStrip } from '@/components/SummaryStrip'
import { useMailBuddyDemo } from '@/hooks/useMailBuddyDemo'

export function Dashboard() {
  const {
    actions,
    dismissAction,
    editAction,
    markActionDone,
    resetDemo,
    selectSourceEmail,
    selectedAction,
    selectedActionId,
    selectedEmail,
    stats,
  } = useMailBuddyDemo()

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
            AI action dashboard
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Suggested next steps from your inbox
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            A clean Phase 1 shell for reviewing extracted to-do items alongside
            the email context they came from.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Inbox scan
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {stats.emailsProcessed} sample emails processed
            </p>
          </div>
          <button
            className="rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            onClick={resetDemo}
            type="button"
          >
            Refresh Demo
          </button>
        </div>
      </section>

      <SummaryStrip stats={stats} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <SuggestedTodoList
          actions={actions}
          onDismiss={dismissAction}
          onEdit={editAction}
          onMarkDone={markActionDone}
          onViewSource={selectSourceEmail}
          selectedActionId={selectedActionId}
        />
        <SourceEmailPreview action={selectedAction} email={selectedEmail} />
      </section>
    </div>
  )
}
