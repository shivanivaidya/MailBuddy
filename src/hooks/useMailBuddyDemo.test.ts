import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMailBuddyDemo } from '@/hooks/useMailBuddyDemo'

describe('useMailBuddyDemo state transitions', () => {
  it('uses one date range to filter quick actions, conversations, and updates', () => {
    const { result } = renderHook(() => useMailBuddyDemo())

    act(() => {
      result.current.updateDateRange({
        endDate: '2026-04-29',
        startDate: '2026-04-29',
      })
    })

    expect(result.current.filteredEmails).toHaveLength(11)
    expect(result.current.filteredActions).toHaveLength(6)
    expect(result.current.filteredActions.map((action) => action.emailId)).toContain(
      'email_bill_due',
    )
    expect(result.current.filteredActions.map((action) => action.emailId)).not.toContain(
      'email_deadline_reminder',
    )
    expect(result.current.filteredThreads.map((thread) => thread.subject)).toEqual(
      ['Portland trip planning', 'Q2 launch scope'],
    )
    expect(result.current.orderUpdates.map((order) => order.merchantName)).toEqual([
      'Thai Garden',
    ])
  })

  it('handles invalid date ranges by clamping the changed boundary safely', () => {
    const { result } = renderHook(() => useMailBuddyDemo())

    act(() => {
      result.current.updateDateRange({ startDate: '2026-05-01' })
      result.current.updateDateRange({ endDate: '2026-04-29' })
    })

    expect(result.current.dateRange).toEqual({
      endDate: '2026-04-29',
      startDate: '2026-04-29',
    })

    act(() => {
      result.current.updateDateRange({ startDate: '2026-05-01' })
    })

    expect(result.current.dateRange).toEqual({
      endDate: '2026-05-01',
      startDate: '2026-05-01',
    })
  })

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

  it('dismisses and edits quick actions locally', () => {
    const { result } = renderHook(() => useMailBuddyDemo())
    const actionId = 'action_email_permission_slip'

    act(() => {
      result.current.dismissAction(actionId)
      result.current.editAction(actionId, {
        dueDate: 'monday',
        priority: 'low',
        title: 'Return signed school form',
      })
    })

    const updatedAction = result.current.actions.find(
      (action) => action.id === actionId,
    )

    expect(updatedAction).toMatchObject({
      dueDate: 'monday',
      dueDateSource: 'user',
      priority: 'low',
      status: 'dismissed',
      title: 'Return signed school form',
    })
    expect(result.current.filteredActions.map((action) => action.id)).toContain(
      actionId,
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
