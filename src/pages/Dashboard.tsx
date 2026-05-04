import { useState } from 'react'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { SourceEmailPreview } from '@/components/SourceEmailPreview'
import { SuggestedTodoList } from '@/components/SuggestedTodoList'
import { SummaryStrip } from '@/components/SummaryStrip'
import { ThreadsSection } from '@/components/ThreadsSection'
import { UpdatesSection } from '@/components/UpdatesSection'
import { useMailBuddyDemo } from '@/hooks/useMailBuddyDemo'

type WorkspaceTab = 'tasks' | 'threads' | 'updates'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tasks')
  const {
    availableDateRange,
    dateRange,
    dismissAction,
    editAction,
    editThread,
    filteredActions,
    filteredEmails,
    filteredThreads,
    markConversationReviewed,
    markActionDone,
    resetDemo,
    merchantSpend,
    orderUpdates,
    restoreAction,
    restoreThread,
    selectedAction,
    selectedActionId,
    selectedEmail,
    selectedOrder,
    selectedOrderEmails,
    selectedOrderId,
    selectedThread,
    selectedThreadId,
    stats,
    toggleOrderUpdate,
    toggleSourceEmail,
    toggleThread,
    updateDateRange,
  } = useMailBuddyDemo()
  const suggestedTaskCount = filteredActions.filter(
    (action) => action.status === 'suggested',
  ).length
  const activeThreadCount = filteredThreads.filter(
    (thread) => thread.status === 'suggested',
  ).length
  const updateCount = orderUpdates.length
  const dateFilterMeta = `${filteredEmails.length} emails`

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
            Review fast inbox actions or switch into conversation context when
            a thread needs more attention.
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

      <DateRangeFilter
        availableDateRange={availableDateRange}
        dateRange={dateRange}
        meta={dateFilterMeta}
        onChange={updateDateRange}
      />

      <div className="inline-flex w-fit rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
        <TabButton
          active={activeTab === 'tasks'}
          count={suggestedTaskCount}
          label="Quick actions"
          onClick={() => setActiveTab('tasks')}
        />
        <TabButton
          active={activeTab === 'threads'}
          count={activeThreadCount}
          label="Conversations"
          onClick={() => setActiveTab('threads')}
        />
        <TabButton
          active={activeTab === 'updates'}
          count={updateCount}
          label="Updates"
          onClick={() => setActiveTab('updates')}
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        {activeTab === 'tasks' ? (
          <SuggestedTodoList
            actions={filteredActions}
            onDismiss={dismissAction}
            onEdit={editAction}
            onMarkDone={markActionDone}
            onRestore={restoreAction}
            onToggleSource={toggleSourceEmail}
            selectedActionId={selectedActionId}
          />
        ) : activeTab === 'threads' ? (
          <ThreadsSection
            onEditThread={editThread}
            onMarkReviewed={markConversationReviewed}
            onRestoreThread={restoreThread}
            onToggleThread={toggleThread}
            selectedThreadId={selectedThreadId}
            threads={filteredThreads}
          />
        ) : (
          <UpdatesSection
            merchantSpend={merchantSpend}
            onToggleOrder={toggleOrderUpdate}
            orderUpdates={orderUpdates}
            selectedOrderId={selectedOrderId}
          />
        )}
        <SourceEmailPreview
          action={activeTab === 'tasks' ? selectedAction : null}
          email={activeTab === 'tasks' ? selectedEmail : undefined}
          mode={
            activeTab === 'threads'
              ? 'thread'
              : activeTab === 'updates'
                ? 'updates'
                : 'source'
          }
          order={activeTab === 'updates' ? selectedOrder : null}
          orderEmails={activeTab === 'updates' ? selectedOrderEmails : []}
          thread={activeTab === 'threads' ? selectedThread : null}
        />
      </section>
    </div>
  )
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-slate-950 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      <span
        className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
          active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
