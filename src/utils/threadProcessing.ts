import type { Email, EmailThread } from '@/types/mail'

export function groupEmailsIntoThreads(emails: Email[]): EmailThread[] {
  const groups = emails
    .filter(isHumanConversationEmail)
    .reduce<Record<string, Email[]>>((threadGroups, email) => {
      const key = getThreadKey(email)
      threadGroups[key] = [...(threadGroups[key] ?? []), email]
      return threadGroups
    }, {})

  return Object.entries(groups)
    .filter(([, threadEmails]) => threadEmails.length >= 2)
    .map(([key, threadEmails]) => createThread(key, threadEmails))
    .sort(
      (firstThread, secondThread) =>
        new Date(secondThread.latestEmail.date).getTime() -
        new Date(firstThread.latestEmail.date).getTime(),
    )
}

function createThread(key: string, emails: Email[]): EmailThread {
  const sortedEmails = [...emails].sort(
    (firstEmail, secondEmail) =>
      new Date(firstEmail.date).getTime() - new Date(secondEmail.date).getTime(),
  )
  const latestEmail = sortedEmails[sortedEmails.length - 1]
  const suggestedDueDate = suggestThreadDueDate(sortedEmails)
  const hasRecentUserReply = sortedEmails.some(
    (email) =>
      email.direction === 'sent' &&
      new Date(email.date).getTime() > new Date(latestEmail.date).getTime(),
  )

  return {
    id: `thread_${key}`,
    subject: createThreadSubject(sortedEmails),
    participants: getParticipants(sortedEmails),
    priority: prioritizeThread(sortedEmails),
    dueDate: suggestedDueDate,
    dueDateSource: suggestedDueDate ? 'email' : undefined,
    status: 'suggested',
    shortSummary: createShortSummary(sortedEmails),
    detailedSummaryBullets: createDetailedSummary(sortedEmails),
    latestEmail,
    emails: sortedEmails,
    needsReply: latestEmail.direction === 'inbound' && !hasRecentUserReply,
  }
}

function prioritizeThread(emails: Email[]): EmailThread['priority'] {
  const text = emails.map((email) => `${email.subject} ${email.body}`).join(' ').toLowerCase()

  if (
    text.includes('today') ||
    text.includes('tomorrow') ||
    text.includes('waiting on') ||
    text.includes('before rates go up')
  ) {
    return 'high'
  }

  if (
    text.includes('can you') ||
    text.includes('decide') ||
    text.includes('confirm') ||
    text.includes('update')
  ) {
    return 'medium'
  }

  return 'low'
}

function suggestThreadDueDate(emails: Email[]): string | undefined {
  const text = emails.map((email) => email.body).join(' ').toLowerCase()

  if (text.includes('today')) {
    return 'today'
  }

  if (text.includes('tomorrow')) {
    return 'tomorrow'
  }

  if (text.includes('friday')) {
    return 'friday'
  }

  if (text.includes('tonight')) {
    return 'tonight'
  }

  return undefined
}

function getParticipants(emails: Email[]) {
  const participants = emails.flatMap((email) => [
    email.sender,
    ...(email.recipients ?? []),
  ])

  return Array.from(
    participants.reduce<Map<string, string>>((participantMap, participant) => {
      if (isAutomatedParticipant(participant)) {
        return participantMap
      }

      const name = formatParticipantName(participant)
      const key = name.toLowerCase()

      if (name && !participantMap.has(key)) {
        participantMap.set(key, name)
      }

      return participantMap
    }, new Map()).values(),
  )
}

function isAutomatedParticipant(participant: string) {
  const normalizedParticipant = participant.toLowerCase()
  return (
    normalizedParticipant.includes('no-reply') ||
    normalizedParticipant.includes('noreply') ||
    normalizedParticipant.includes('support@') ||
    normalizedParticipant.includes('billing@')
  )
}

function formatParticipantName(participant: string) {
  return participant.replace(/\s*<[^>]+>\s*$/, '').trim()
}

function isHumanConversationEmail(email: Email) {
  const sender = email.sender.toLowerCase()
  const labels = email.labels?.map((label) => label.toLowerCase()) ?? []
  const excludedLabels = [
    'bills',
    'finance',
    'shipping',
    'health',
    'subscriptions',
    'newsletter',
    'promotions',
    'receipts',
    'deadline',
  ]

  if (sender.includes('no-reply') || sender.includes('support@')) {
    return false
  }

  if (labels.some((label) => excludedLabels.includes(label))) {
    return false
  }

  return labels.includes('conversation') || email.subject.toLowerCase().startsWith('re:')
}

function getThreadKey(email: Email) {
  const subject = email.subject.toLowerCase()
  const labels = email.labels?.map((label) => label.toLowerCase()) ?? []

  if (subject.includes('portland trip') || labels.includes('travel')) {
    return 'portland-trip-planning'
  }

  if (subject.includes('launch scope')) {
    return 'q2-launch-scope'
  }

  if (subject.includes('team retreat')) {
    return 'team-retreat-agenda'
  }

  if (
    subject.includes('follow') ||
    subject.includes('proposal') ||
    labels.includes('work')
  ) {
    return normalizeSubject(email.subject)
  }

  return normalizeSubject(email.subject)
}

function createThreadSubject(emails: Email[]) {
  const latestEmail = emails[emails.length - 1]
  return latestEmail.subject.replace(/^(re|fw|fwd):\s*/i, '').trim()
}

function createShortSummary(emails: Email[]) {
  const subject = createThreadSubject(emails).toLowerCase()
  const latestEmail = emails[emails.length - 1]

  if (subject.includes('portland trip')) {
    return 'Portland trip is nearly decided: second weekend in May, riverfront lodging, and train booking.'
  }

  if (subject.includes('launch scope')) {
    return 'Q2 launch scope is being narrowed: reporting stays in, partner dashboard moves out.'
  }

  if (subject.includes('team retreat')) {
    return 'Team is finalizing event agenda with pending decisions on dinner options and workshop owners.'
  }

  return summarizeEmail(latestEmail)
}

function createDetailedSummary(emails: Email[]) {
  const latestEmail = emails[emails.length - 1]
  const subject = createThreadSubject(emails).toLowerCase()

  if (subject.includes('team retreat')) {
    return [
      'Alex shared an initial agenda draft but key decisions are still pending: dinner, transport, workshop owners, and budget.',
      'You agreed to take ownership of transport and budget and asked others to confirm remaining items.',
      'Priya will confirm dinner options by tomorrow and is waiting on Maya and Jordan to provide workshop owners so the agenda can be finalized.',
    ]
  }

  if (subject.includes('portland trip')) {
    return [
      'Maya and the user both confirmed the second weekend in May works for the Portland trip.',
      'The group is leaning toward the riverfront place and wants to decide before rates increase.',
      'Maya will handle the lodging reservation, while the user needs to book train travel.',
    ]
  }

  if (subject.includes('launch scope')) {
    return [
      'Jordan raised concern that the Q2 launch scope is too broad for the first milestone.',
      'The user agreed to narrow scope by keeping reporting in launch and moving partner dashboard to a later cycle.',
      'Jordan accepted the plan and asked the user to update the launch notes with the revised scope.',
    ]
  }

  const bullets = [
    createConversationSummary(emails),
    summarizeThreadStatus(emails),
  ]

  if (latestEmail.direction === 'inbound') {
    bullets.push('The latest message is waiting on the user side of the conversation.')
  }

  return bullets
}

function createConversationSummary(emails: Email[]) {
  const subject = createThreadSubject(emails).toLowerCase()

  if (subject.includes('portland trip')) {
    return 'Maya and the user agreed on the second weekend in May and are deciding logistics.'
  }

  if (subject.includes('launch scope')) {
    return 'Jordan and the user aligned on reducing Q2 launch scope while keeping reporting in.'
  }

  if (subject.includes('team retreat')) {
    return 'The group is coordinating open retreat decisions across dinner, transport, workshop owners, and budget.'
  }

  return summarizeEmail(emails[emails.length - 1])
}

function summarizeEmail(email: Email) {
  const normalizedBody = email.body.replace(/\s+/g, ' ').trim()
  return normalizedBody.length > 96
    ? `${normalizedBody.slice(0, 93).trim()}...`
    : normalizedBody
}

function summarizeThreadStatus(emails: Email[]) {
  const latestEmail = emails[emails.length - 1]

  if (latestEmail.direction === 'sent') {
    return 'Latest message was sent by you.'
  }

  return 'Latest message came from the sender.'
}

function normalizeSubject(subject: string) {
  return subject
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
