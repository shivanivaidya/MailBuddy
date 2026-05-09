import { useRef, useState } from 'react'
import { AssistantPanel } from '@/components/AssistantPanel'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { SourceEmailPreview } from '@/components/SourceEmailPreview'
import { SuggestedTodoList } from '@/components/SuggestedTodoList'
import { ThreadsSection } from '@/components/ThreadsSection'
import {
  UpdatesSection,
  UpdatesSpendSection,
} from '@/components/UpdatesSection'
import { useMailBuddyDemo } from '@/hooks/useMailBuddyDemo'
import type { AssistantAnswer } from '@/types/mail'
import {
  answerAssistantTurn,
  getAssistantChatHistory,
  type AssistantMemory,
} from '@/utils/assistantProcessing'
import {
  answerAssistantWithToolPlanning,
  finalizeAssistantToolResults,
} from '@/utils/assistantToolAgent'

type WorkspaceTab = 'tasks' | 'threads' | 'updates'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tasks')
  const [assistantAnswer, setAssistantAnswer] =
    useState<AssistantAnswer | null>(null)
  const [assistantMemory, setAssistantMemory] = useState<AssistantMemory>({})
  const [isFinalizingAnswer, setIsFinalizingAnswer] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const assistantRequestId = useRef(0)
  const {
    actions,
    availableDateRange,
    dateRange,
    allMerchantSpend,
    allOrderUpdates,
    dismissAction,
    editAction,
    editThread,
    emails,
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
    threads,
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

  function askAssistant(query: string) {
    const requestId = assistantRequestId.current + 1
    assistantRequestId.current = requestId
    const assistantDateRange = getAssistantDateRange(query, emails)
    const assistantContext = {
      actions,
      dateRange: assistantDateRange ?? dateRange,
      emails,
      merchantSpend: allMerchantSpend,
      orders: allOrderUpdates,
      threads,
    }
    const fallback = answerAssistantTurn(
      query,
      assistantContext,
      assistantMemory,
    )

    if (!query.trim()) {
      setAssistantAnswer(fallback.answer)
      setAssistantMemory(fallback.memory)
      setIsFinalizingAnswer(false)
      return
    }

    const chatHistory = getAssistantChatHistory(assistantMemory)
    setAssistantAnswer(null)
    setIsFinalizingAnswer(true)
    void answerAssistantWithToolPlanning(
      query,
      assistantContext,
      assistantMemory,
      { chatHistory },
    )
      .then(async (plannedResult) => {
        if (assistantRequestId.current !== requestId) {
          return undefined
        }

        const finalAnswer = await finalizeAssistantToolResults(
          query,
          plannedResult.answer,
          plannedResult.toolResults,
          {
            chatHistory,
            standaloneQuestion: plannedResult.standaloneQuestion,
          },
        )

        return {
          answer: finalAnswer,
          memory: plannedResult.memory,
        }
      })
      .then((finalResult) => {
        if (assistantRequestId.current === requestId && finalResult) {
          setAssistantAnswer(finalResult.answer)
          setAssistantMemory(finalResult.memory)
        }
      })
      .finally(() => {
        if (assistantRequestId.current === requestId) {
          setIsFinalizingAnswer(false)
        }
      })
  }

  function resetAssistantSession() {
    assistantRequestId.current += 1
    setAssistantAnswer(null)
    setAssistantMemory({})
    setIsFinalizingAnswer(false)
    setIsListening(false)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <DateRangeFilter
          availableDateRange={availableDateRange}
          dateRange={dateRange}
          meta={dateFilterMeta}
          onChange={updateDateRange}
        />

        <div className="flex flex-wrap items-center gap-5 lg:justify-end">
          <p className="text-base font-semibold text-emerald-600">
            {stats.emailsProcessed} emails processed
          </p>
          <AssistantPanel
            answer={assistantAnswer}
            isFinalizingAnswer={isFinalizingAnswer}
            isListening={isListening}
            onAsk={askAssistant}
            onListeningChange={setIsListening}
            onSessionReset={resetAssistantSession}
          />
          <button
            className="rounded-xl bg-slate-950 px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
            onClick={resetDemo}
            type="button"
          >
            Refresh
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
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

      {activeTab === 'updates' ? (
        <div className="space-y-6">
          <UpdatesSpendSection merchantSpend={merchantSpend} />
          <section className="grid gap-6 xl:grid-cols-2">
            <UpdatesSection
              onToggleOrder={toggleOrderUpdate}
              orderUpdates={orderUpdates}
              selectedOrderId={selectedOrderId}
            />
            <SourceEmailPreview
              mode="updates"
              order={selectedOrder}
              orderEmails={selectedOrderEmails}
            />
          </section>
        </div>
      ) : (
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
          ) : (
            <ThreadsSection
              onEditThread={editThread}
              onMarkReviewed={markConversationReviewed}
              onRestoreThread={restoreThread}
              onToggleThread={toggleThread}
              selectedThreadId={selectedThreadId}
              threads={filteredThreads}
            />
          )}
          <SourceEmailPreview
            action={activeTab === 'tasks' ? selectedAction : null}
            email={activeTab === 'tasks' ? selectedEmail : undefined}
            mode={activeTab === 'threads' ? 'thread' : 'source'}
            thread={activeTab === 'threads' ? selectedThread : null}
          />
        </section>
      )}
    </div>
  )
}

function getAssistantDateRange(query: string, emails: Array<{ date: string }>) {
  const normalizedQuery = query.toLowerCase()
  const today = getAssistantAnchorDate(emails)

  if (isTodayTaskSummaryQuery(normalizedQuery)) {
    return undefined
  }

  if (normalizedQuery.includes('this month')) {
    const year = today.getFullYear()
    const monthIndex = today.getMonth()
    const month = String(monthIndex + 1).padStart(2, '0')
    const lastDay = new Date(year, monthIndex + 1, 0).getDate()

    return {
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      startDate: `${year}-${month}-01`,
    }
  }

  if (normalizedQuery.includes('last month')) {
    const year = today.getFullYear()
    const monthIndex = today.getMonth() - 1
    const lastMonth = new Date(year, monthIndex, 1)
    const lastMonthYear = lastMonth.getFullYear()
    const lastMonthIndex = lastMonth.getMonth()
    const month = String(lastMonthIndex + 1).padStart(2, '0')
    const lastDay = new Date(lastMonthYear, lastMonthIndex + 1, 0).getDate()

    return {
      endDate: `${lastMonthYear}-${month}-${String(lastDay).padStart(2, '0')}`,
      startDate: `${lastMonthYear}-${month}-01`,
    }
  }

  if (normalizedQuery.includes('today')) {
    const todayValue = toDateValue(today)

    return {
      endDate: todayValue,
      startDate: todayValue,
    }
  }

  return undefined
}

function isTodayTaskSummaryQuery(query: string) {
  return /\b(today|to do|need to do|tasks?|quick actions?)\b/.test(query) &&
    /\b(today|to do|need to do)\b/.test(query) &&
    !/\b(order|spend|spent|refund|delivered|delivery|conversation|thread|reply|respond)\b/.test(query)
}

function toDateValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getAssistantAnchorDate(emails: Array<{ date: string }>) {
  const latestEmailDate = emails
    .map((email) => new Date(email.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0]

  return latestEmailDate ?? new Date()
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
      className={`rounded-xl px-6 py-4 text-base font-semibold shadow-sm transition ${
        active
          ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-lg shadow-pink-900/15'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      <span
        className={`ml-2 text-sm ${
          active ? 'text-white/80' : 'text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
