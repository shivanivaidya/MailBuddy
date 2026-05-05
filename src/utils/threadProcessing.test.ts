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
        'Friday dinner reservation',
        'Budget review notes',
        'Neighborhood outing',
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

  it('creates useful generic summaries for new conversation threads', () => {
    const threads = groupEmailsIntoThreads(sampleEmails)
    const outingThread = threads.find(
      (thread) => thread.subject === 'Neighborhood outing',
    )

    expect(outingThread?.shortSummary).toBe(
      'Avery Kim and Nina Rao proposed Saturday morning works.',
    )
    expect(outingThread?.detailedSummaryBullets).toEqual(
      expect.arrayContaining([
        'Avery Kim and Nina Rao are discussing neighborhood outing.',
        'Current proposal: The park pavilion is available on Saturday morning, and I can bring the sign-up sheet.',
        'Open action: Someone needs to handle the supplies list.',
      ]),
    )
    expect(outingThread?.detailedSummaryBullets).not.toContain(
      'Latest message came from the sender.',
    )
  })
})
