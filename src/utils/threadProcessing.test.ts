import { describe, expect, it } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import { groupEmailsIntoThreads } from '@/utils/threadProcessing'

describe('groupEmailsIntoThreads', () => {
  it('groups only meaningful multi-email human conversations', () => {
    const threads = groupEmailsIntoThreads(sampleEmails)
    const subjects = threads.map((thread) => thread.subject)

    expect(subjects).toEqual(
      expect.arrayContaining([
        'Portland trip planning',
        'Q2 launch scope',
        'Team retreat agenda',
      ]),
    )
    expect(subjects).not.toContain('Payment due for your April utility bill')
    expect(subjects).not.toContain('Your receipt from Corner Market')
  })

  it('extracts participants and flags conversations that need a reply', () => {
    const threads = groupEmailsIntoThreads(sampleEmails)
    const retreatThread = threads.find(
      (thread) => thread.subject === 'Team retreat agenda',
    )

    expect(retreatThread).toMatchObject({
      dueDate: 'today',
      dueDateSource: 'email',
      needsReply: true,
      priority: 'high',
      status: 'suggested',
    })
    expect(retreatThread?.participants).toEqual(
      expect.arrayContaining(['Alex Kim', 'Me', 'Priya Shah']),
    )
    expect(retreatThread?.participants).toHaveLength(10)
  })
})
