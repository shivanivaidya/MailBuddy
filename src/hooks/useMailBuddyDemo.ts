import { useMemo, useState } from 'react'
import { loadSampleEmails } from '@/services/mailData'
import type {
  ActionItem,
  ActionItemEdit,
  Email,
  EmailThread,
  EmailThreadEdit,
  OrderUpdate,
} from '@/types/mail'
import {
  extractActionItems,
  generateDashboardStats,
} from '@/utils/mailProcessing'
import { groupEmailsIntoThreads } from '@/utils/threadProcessing'
import {
  extractOrderUpdates,
  generateMerchantSpendSummaries,
} from '@/utils/updateProcessing'

const priorityRank: Record<ActionItem['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function findSourceEmail(emails: Email[], action: ActionItem | null) {
  if (!action) {
    return undefined
  }

  return emails.find((email) => email.id === action.emailId)
}

function findRelatedEmails(emails: Email[], order: OrderUpdate | null) {
  if (!order) {
    return []
  }

  return emails.filter((email) => order.relatedEmailIds.includes(email.id))
}

export type MailDateRange = {
  endDate: string
  startDate: string
}

export function useMailBuddyDemo() {
  const emails = useMemo(() => loadSampleEmails(), [])
  const [actions, setActions] = useState<ActionItem[]>(() =>
    extractActionItems(emails),
  )
  const [threads, setThreads] = useState<EmailThread[]>(() =>
    groupEmailsIntoThreads(emails),
  )
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<MailDateRange>(() =>
    getEmailDateRange(emails),
  )

  const stats = useMemo(
    () => generateDashboardStats(emails, actions),
    [actions, emails],
  )
  const availableDateRange = useMemo(
    () => getEmailDateRange(emails),
    [emails],
  )
  const filteredEmails = useMemo(
    () => filterEmailsByDateRange(emails, dateRange),
    [emails, dateRange],
  )
  const filteredEmailIds = useMemo(
    () => new Set(filteredEmails.map((email) => email.id)),
    [filteredEmails],
  )
  const filteredActions = useMemo(
    () =>
      sortByPriority(
        actions.filter((action) => filteredEmailIds.has(action.emailId)),
      ),
    [actions, filteredEmailIds],
  )
  const filteredThreads = useMemo(
    () => sortByPriority(filterThreadsByDateRange(threads, filteredEmailIds)),
    [filteredEmailIds, threads],
  )
  const allOrderUpdates = useMemo(() => extractOrderUpdates(emails), [emails])
  const allMerchantSpend = useMemo(
    () => generateMerchantSpendSummaries(allOrderUpdates),
    [allOrderUpdates],
  )
  const filteredOrderEmails = useMemo(
    () => filterOrderEmailsByDateRange(filteredEmails, allOrderUpdates),
    [allOrderUpdates, filteredEmails],
  )
  const orderUpdates = useMemo(
    () => extractOrderUpdates(filteredOrderEmails),
    [filteredOrderEmails],
  )
  const merchantSpend = useMemo(
    () => generateMerchantSpendSummaries(orderUpdates),
    [orderUpdates],
  )
  const selectedAction =
    filteredActions.find((action) => action.id === selectedActionId) ?? null
  const selectedEmail = findSourceEmail(emails, selectedAction)
  const selectedThread =
    filteredThreads.find((thread) => thread.id === selectedThreadId) ?? null
  const selectedOrder =
    orderUpdates.find((order) => order.id === selectedOrderId) ?? null
  const selectedOrderEmails = findRelatedEmails(filteredOrderEmails, selectedOrder)

  function updateDateRange(updates: Partial<MailDateRange>): void {
    setDateRange((currentRange) => {
      const nextRange = {
        ...currentRange,
        ...updates,
      }

      if (new Date(nextRange.endDate) < new Date(nextRange.startDate)) {
        return updates.startDate
          ? { ...nextRange, endDate: nextRange.startDate }
          : { ...nextRange, startDate: nextRange.endDate }
      }

      return nextRange
    })
  }

  function markActionDone(actionId: string): void {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, status: 'completed' } : action,
      ),
    )
    setSelectedActionId((currentId) =>
      currentId === actionId ? null : currentId,
    )
  }

  function dismissAction(actionId: string): void {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, status: 'dismissed' } : action,
      ),
    )
    setSelectedActionId((currentId) =>
      currentId === actionId ? null : currentId,
    )
  }

  function editAction(actionId: string, updates: ActionItemEdit): void {
    const trimmedTitle = updates.title.trim()
    const trimmedDueDate = updates.dueDate?.trim()

    if (!trimmedTitle) {
      return
    }

    setActions((currentActions) =>
      currentActions.map((action) => {
        if (action.id !== actionId) {
          return action
        }

        return {
          ...action,
          dueDate: trimmedDueDate || undefined,
          dueDateSource: getEditedDueDateSource(action, trimmedDueDate),
          priority: updates.priority,
          title: trimmedTitle,
        }
      }),
    )
  }

  function toggleSourceEmail(actionId: string): void {
    setSelectedActionId((currentId) =>
      currentId === actionId ? null : actionId,
    )
    setSelectedThreadId(null)
    setSelectedOrderId(null)
  }

  function toggleThread(threadId: string): void {
    setSelectedThreadId((currentId) =>
      currentId === threadId ? null : threadId,
    )
    setSelectedActionId(null)
    setSelectedOrderId(null)
  }

  function toggleOrderUpdate(orderId: string): void {
    setSelectedOrderId((currentId) =>
      currentId === orderId ? null : orderId,
    )
    setSelectedActionId(null)
    setSelectedThreadId(null)
  }

  function editThread(threadId: string, updates: EmailThreadEdit): void {
    const trimmedSubject = updates.subject.trim()
    const trimmedDueDate = updates.dueDate?.trim()

    if (!trimmedSubject) {
      return
    }

    setThreads((currentThreads) =>
      currentThreads.map((thread) => {
        if (thread.id !== threadId) {
          return thread
        }

        return {
          ...thread,
          dueDate: trimmedDueDate || undefined,
          dueDateSource: getEditedThreadDueDateSource(thread, trimmedDueDate),
          priority: updates.priority,
          subject: trimmedSubject,
        }
      }),
    )
  }

  function markConversationReviewed(threadId: string): void {
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? { ...thread, status: 'reviewed' } : thread,
      ),
    )
    setSelectedThreadId((currentId) =>
      currentId === threadId ? null : currentId,
    )
  }

  function restoreAction(actionId: string): void {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, status: 'suggested' } : action,
      ),
    )
  }

  function restoreThread(threadId: string): void {
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? { ...thread, status: 'suggested' } : thread,
      ),
    )
  }

  function resetDemo(): void {
    setActions(extractActionItems(emails))
    setThreads(groupEmailsIntoThreads(emails))
    setSelectedActionId(null)
    setSelectedThreadId(null)
    setSelectedOrderId(null)
    setDateRange(getEmailDateRange(emails))
  }

  return {
    actions,
    allMerchantSpend,
    allOrderUpdates,
    availableDateRange,
    dateRange,
    dismissAction,
    editAction,
    editThread,
    emails,
    filteredActions,
    filteredEmails,
    filteredThreads,
    markActionDone,
    markConversationReviewed,
    merchantSpend,
    orderUpdates,
    resetDemo,
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
  }
}

function getEmailDateRange(emails: Email[]): MailDateRange {
  const sortedDates = emails
    .map((email) => email.date)
    .sort(
      (firstDate, secondDate) =>
        new Date(firstDate).getTime() - new Date(secondDate).getTime(),
    )

  return {
    startDate: toDateInputValue(sortedDates[0] ?? new Date().toISOString()),
    endDate: toDateInputValue(
      sortedDates[sortedDates.length - 1] ?? new Date().toISOString(),
    ),
  }
}

function filterEmailsByDateRange(
  emails: Email[],
  dateRange: MailDateRange,
) {
  const startDate = new Date(`${dateRange.startDate}T00:00:00.000`)
  const endDate = new Date(`${dateRange.endDate}T23:59:59.999`)

  return emails.filter((email) => {
    const emailDate = new Date(email.date)
    return emailDate >= startDate && emailDate <= endDate
  })
}

function filterOrderEmailsByDateRange(
  filteredEmails: Email[],
  orderUpdates: OrderUpdate[],
) {
  const orderEmailIds = new Set(
    orderUpdates.flatMap((order) => order.relatedEmailIds),
  )

  return filteredEmails.filter((email) => orderEmailIds.has(email.id))
}

function filterThreadsByDateRange(
  threads: EmailThread[],
  filteredEmailIds: Set<string>,
) {
  return threads.flatMap((thread) => {
    const filteredThreadEmails = thread.emails.filter((email) =>
      filteredEmailIds.has(email.id),
    )

    if (!filteredThreadEmails.length) {
      return []
    }

    return [
      {
        ...thread,
        emails: filteredThreadEmails,
        latestEmail: filteredThreadEmails[filteredThreadEmails.length - 1],
        needsReply:
          filteredThreadEmails[filteredThreadEmails.length - 1].direction ===
          'inbound',
      },
    ]
  })
}

function toDateInputValue(value: string) {
  return value.slice(0, 10)
}

function sortByPriority<T extends { priority: ActionItem['priority'] }>(
  items: T[],
) {
  return [...items].sort(
    (firstItem, secondItem) =>
      priorityRank[firstItem.priority] - priorityRank[secondItem.priority],
  )
}

function getEditedDueDateSource(
  action: ActionItem,
  nextDueDate: string | undefined,
) {
  if (!nextDueDate) {
    return undefined
  }

  return nextDueDate === action.dueDate ? action.dueDateSource : 'user'
}

function getEditedThreadDueDateSource(
  thread: EmailThread,
  nextDueDate: string | undefined,
) {
  if (!nextDueDate) {
    return undefined
  }

  return nextDueDate === thread.dueDate ? thread.dueDateSource : 'user'
}
