import { useMemo, useState } from 'react'
import { loadSampleEmails } from '@/services/mailData'
import type {
  ActionItem,
  ActionItemEdit,
  Email,
  EmailThread,
  EmailThreadEdit,
} from '@/types/mail'
import {
  extractActionItems,
  generateDashboardStats,
} from '@/utils/mailProcessing'
import { groupEmailsIntoThreads } from '@/utils/threadProcessing'

function findSourceEmail(emails: Email[], action: ActionItem | null) {
  if (!action) {
    return undefined
  }

  return emails.find((email) => email.id === action.emailId)
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

  const stats = useMemo(
    () => generateDashboardStats(emails, actions),
    [actions, emails],
  )
  const selectedAction =
    actions.find((action) => action.id === selectedActionId) ?? null
  const selectedEmail = findSourceEmail(emails, selectedAction)
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null

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
  }

  function toggleThread(threadId: string): void {
    setSelectedThreadId((currentId) =>
      currentId === threadId ? null : threadId,
    )
    setSelectedActionId(null)
  }

  function editThread(threadId: string, updates: EmailThreadEdit): void {
    const trimmedDueDate = updates.dueDate?.trim()

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
  }

  return {
    actions,
    dismissAction,
    editAction,
    editThread,
    markActionDone,
    markConversationReviewed,
    resetDemo,
    restoreAction,
    restoreThread,
    selectedAction,
    selectedActionId,
    selectedEmail,
    selectedThread,
    selectedThreadId,
    stats,
    threads,
    toggleSourceEmail,
    toggleThread,
  }
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
