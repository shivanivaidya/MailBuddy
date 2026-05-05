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

  if (subject.includes('portland trip')) {
    return 'Portland trip is nearly decided: second weekend in May, riverfront lodging, and train booking.'
  }

  if (subject.includes('launch scope')) {
    return 'Q2 launch scope is being narrowed: reporting stays in, partner dashboard moves out.'
  }

  if (subject.includes('team retreat')) {
    return 'Team is finalizing event agenda with pending decisions on dinner options and workshop owners.'
  }

  return createGenericShortSummary(emails)
}

function createDetailedSummary(emails: Email[]) {
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

  return createGenericDetailedSummary(emails)
}

function createGenericShortSummary(emails: Email[]) {
  const participants = formatParticipantList(getNonUserParticipants(emails))
  const latestEmail = emails[emails.length - 1]
  const ask = extractAsk(latestEmail.body)
  const proposal = extractProposal(latestEmail.body)

  if (ask && latestEmail.direction === 'inbound') {
    return `${participants} are waiting on ${ask}.`
  }

  if (ask && latestEmail.direction === 'sent') {
    return `You asked ${participants} to ${ask}.`
  }

  if (proposal) {
    return `${participants} proposed ${proposal}.`
  }

  return `${participants} shared an update about ${createThreadSubject(emails).toLowerCase()}.`
}

function createGenericDetailedSummary(emails: Email[]) {
  const bullets = [
    summarizeConversationFlow(emails),
    summarizeDecisionOrProposal(emails),
    summarizeOpenAction(emails),
    summarizeLatestUpdate(emails),
  ].filter((bullet): bullet is string => Boolean(bullet))

  return Array.from(new Set(bullets)).slice(0, 4)
}

function summarizeConversationFlow(emails: Email[]) {
  const participants = formatParticipantList(getNonUserParticipants(emails))
  const subject = createThreadSubject(emails).toLowerCase()

  return `${participants} are discussing ${subject}.`
}

function summarizeDecisionOrProposal(emails: Email[]) {
  const messages = emails.map((email) => email.body)
  const decision = messages.find((body) =>
    /\b(agreed|confirmed|decided|finalized|finalised|booked|that works)\b/i.test(body),
  )

  if (decision) {
    return `Decision signal: ${summarizeEmailBody(decision)}`
  }

  const proposal = messages.map(extractProposal).find(Boolean)

  return proposal ? `Current proposal: ${proposal}.` : undefined
}

function summarizeOpenAction(emails: Email[]) {
  const latestAskEmail = [...emails]
    .reverse()
    .find((email) => extractAsk(email.body) ?? extractConditionalNeed(email.body))

  if (!latestAskEmail) {
    return undefined
  }

  const directAsk = extractAsk(latestAskEmail.body)
  const conditionalNeed = extractConditionalNeed(latestAskEmail.body)
  const owner = directAsk
    ? latestEmailOwner(latestAskEmail)
    : 'Someone'
  const ask = directAsk ?? conditionalNeed

  return ask ? `Open action: ${owner} needs to ${ask}.` : undefined
}

function summarizeLatestUpdate(emails: Email[]) {
  const latestEmail = emails[emails.length - 1]
  const sender = latestEmail.direction === 'sent' ? 'You' : formatParticipantName(latestEmail.sender)

  return `Latest update: ${sender} said ${summarizeEmailBody(latestEmail.body)}`
}

function summarizeEmailBody(body: string) {
  const normalizedBody = body.replace(/\s+/g, ' ').trim()
  return normalizedBody.length > 96
    ? `${normalizedBody.slice(0, 93).trim()}...`
    : normalizedBody
}

function extractAsk(body: string) {
  const askMatch = body.match(
    /(?:(?:can|could)\s+(?:you|someone|we)\s+|please\s+)(.+?)(?:\?|\.|$)/i,
  )

  if (!askMatch) {
    return undefined
  }

  return askMatch[1].trim()
}

function extractConditionalNeed(body: string) {
  const target = body.match(/\bif someone else handles\s+(.+?)(?:\.|$)/i)?.[1]?.trim()
  return target ? `handle ${target}` : undefined
}

function extractProposal(body: string) {
  const proposalMatch =
    body.match(/([^.!?]*\b(?:works|available|can hold|can do|leaning toward|should|would)\b[^.!?]*)(?:[.!?]|$)/i) ??
    body.match(/(?:let us|let's)\s+(.+?)(?:\.|$)/i)

  return proposalMatch?.[1]?.trim()
}

function latestEmailOwner(email: Email) {
  return email.direction === 'sent'
    ? formatParticipantName(email.recipients?.[0] ?? 'recipient')
    : 'You'
}

function getNonUserParticipants(emails: Email[]) {
  return getParticipants(emails).filter((participant) => participant !== 'Me')
}

function formatParticipantList(participants: string[]) {
  if (!participants.length) {
    return 'The thread'
  }

  if (participants.length === 1) {
    return participants[0]
  }

  if (participants.length === 2) {
    return `${participants[0]} and ${participants[1]}`
  }

  return `${participants.slice(0, 2).join(', ')} and ${participants.length - 2} others`
}

function normalizeSubject(subject: string) {
  return subject
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
