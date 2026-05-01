import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMailBuddyDemo } from '@/hooks/useMailBuddyDemo'

describe('useMailBuddyDemo state transitions', () => {
  it('marks a quick action done and updates dashboard stats', () => {
    const { result } = renderHook(() => useMailBuddyDemo())
    const actionId = 'action_email_bill_due'
    const initialCompletedTasks = result.current.stats.completedTasks

    act(() => {
      result.current.markActionDone(actionId)
    })

    const updatedAction = result.current.actions.find(
      (action) => action.id === actionId,
    )

    expect(updatedAction?.status).toBe('completed')
    expect(result.current.stats.completedTasks).toBe(initialCompletedTasks + 1)
    expect(result.current.stats.tasksFound).toBe(
      result.current.actions.filter((action) => action.status === 'suggested')
        .length,
    )
  })

  it('marks a conversation reviewed and can restore it', () => {
    const { result } = renderHook(() => useMailBuddyDemo())
    const conversationId = 'thread_team-retreat-agenda'

    act(() => {
      result.current.markConversationReviewed(conversationId)
    })

    expect(
      result.current.threads.find((thread) => thread.id === conversationId)
        ?.status,
    ).toBe('reviewed')

    act(() => {
      result.current.restoreThread(conversationId)
    })

    expect(
      result.current.threads.find((thread) => thread.id === conversationId)
        ?.status,
    ).toBe('suggested')
  })
})
