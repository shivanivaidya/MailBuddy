import { useMemo, useState } from 'react'
import { loadSampleEmails } from '@/services/mailData'
import type { ActionItem, Email } from '@/types/mail'
import {
  extractActionItems,
  generateDashboardStats,
} from '@/utils/mailProcessing'

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
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)

  const stats = useMemo(
    () => generateDashboardStats(emails, actions),
    [actions, emails],
  )
  const selectedAction =
    actions.find((action) => action.id === selectedActionId) ?? null
  const selectedEmail = findSourceEmail(emails, selectedAction)

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

  function editAction(actionId: string, newTitle: string): void {
    const trimmedTitle = newTitle.trim()

    if (!trimmedTitle) {
      return
    }

    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, title: trimmedTitle } : action,
      ),
    )
  }

  function selectSourceEmail(actionId: string): void {
    setSelectedActionId(actionId)
  }

  function resetDemo(): void {
    setActions(extractActionItems(emails))
    setSelectedActionId(null)
  }

  return {
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
  }
}
