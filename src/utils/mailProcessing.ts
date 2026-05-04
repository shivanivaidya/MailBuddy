import type { ActionItem, DashboardStats, Email } from '@/types/mail'

type Priority = ActionItem['priority']

const highPriorityKeywords = [
  'urgent',
  'due today',
  'overdue',
  'final reminder',
  'payment due',
  'deadline',
]

const mediumPriorityKeywords = [
  'please complete',
  'respond',
  'rsvp',
  'form',
  'schedule',
  'follow up',
  'follow-up',
]

const noTaskKeywords = [
  'newsletter',
  'promotion',
  'sale',
  'receipt',
  'password reset',
  'verification code',
  'security code',
  'for your records',
  'roundup',
]

const actionKeywords = [
  ...highPriorityKeywords,
  ...mediumPriorityKeywords,
  'action required',
  'please sign',
  'return the attached',
  'reply',
  'review',
  'send your edits',
  'update payment',
  'registration closes',
  'submit',
  'renew',
  'let me know',
  'i will follow up',
]

export function extractActionItems(emails: Email[]): ActionItem[] {
  const directActions = emails.flatMap<ActionItem>((email) => {
    if (!shouldCreateActionItem(email)) {
      return []
    }

    const dueDate = extractDueDate(email)

    return [
      {
        id: `action_${email.id}`,
        emailId: email.id,
        title: createTaskTitle(email),
        priority: prioritizeActionItem(email),
        dueDate,
        dueDateSource: dueDate ? 'email' : undefined,
        status: 'suggested',
        sourceSender: email.sender,
        sourceSubject: email.subject,
        sourceSnippet: createSourceSnippet(email.body),
        reason: createReason(email),
      },
    ]
  })
  const actionEmailIds = new Set(directActions.map((action) => action.emailId))
  const followUpActions = extractUnansweredSentFollowUps(
    emails,
    actionEmailIds,
  )

  return [...directActions, ...followUpActions]
}

export function prioritizeActionItem(email: Email): Priority {
  const text = getSearchText(email)

  if (includesAny(text, highPriorityKeywords)) {
    return 'high'
  }

  if (includesAny(text, mediumPriorityKeywords)) {
    return 'medium'
  }

  return 'low'
}

export function generateDashboardStats(
  emails: Email[],
  actions: ActionItem[],
): DashboardStats {
  return {
    emailsProcessed: emails.length,
    tasksFound: actions.filter((action) => action.status === 'suggested').length,
    highPriorityTasks: actions.filter(
      (action) => action.priority === 'high' && action.status === 'suggested',
    ).length,
    completedTasks: actions.filter((action) => action.status === 'completed')
      .length,
  }
}

function shouldCreateActionItem(email: Email) {
  const text = getSearchText(email)

  if (includesAny(text, noTaskKeywords)) {
    return false
  }

  if (isSentByUser(email)) {
    return text.includes('i will follow up')
  }

  return includesAny(text, actionKeywords)
}

function createTaskTitle(email: Email) {
  const text = getSearchText(email)

  if (text.includes('payment due') || text.includes('bill')) {
    return 'Pay upcoming bill'
  }

  if (text.includes('permission slip')) {
    return 'Sign and return permission slip'
  }

  if (text.includes('delivery') && text.includes('address')) {
    return 'Reply with corrected delivery address'
  }

  if (text.includes('rsvp')) {
    return `RSVP: ${cleanSubject(email.subject)}`
  }

  if (text.includes('launch notes') || text.includes('send your edits')) {
    return 'Review and send launch note edits'
  }

  if (text.includes('intake form') || text.includes('form')) {
    return 'Complete required form'
  }

  if (text.includes('subscription') || text.includes('renew')) {
    return 'Review subscription renewal'
  }

  if (email.direction === 'sent' && text.includes('follow up')) {
    return 'Follow up on sent email'
  }

  if (text.includes('registration closes') || text.includes('deadline')) {
    return 'Submit registration before deadline'
  }

  return `Follow up: ${cleanSubject(email.subject)}`
}

function createReason(email: Email) {
  const text = getSearchText(email)

  if (includesAny(text, highPriorityKeywords)) {
    return 'MailBuddy found deadline or urgency language that implies a time-sensitive task.'
  }

  if (email.direction === 'sent' && text.includes('follow up')) {
    return 'MailBuddy found a promised follow-up in a sent email.'
  }

  if (includesAny(text, mediumPriorityKeywords)) {
    return 'MailBuddy found a request to respond, complete a form, schedule, or follow up.'
  }

  return 'MailBuddy found an optional action that may be useful to review.'
}

function extractUnansweredSentFollowUps(
  emails: Email[],
  actionEmailIds: Set<string>,
) {
  const latestEmailTime = getLatestEmailTime(emails)

  return emails.flatMap((email) => {
    if (
      actionEmailIds.has(email.id) ||
      !isSentByUser(email) ||
      !isOldEnoughForFollowUp(email, latestEmailTime) ||
      !isMeaningfulSentRequest(email) ||
      hasLaterInboundReply(email, emails)
    ) {
      return []
    }

    return [
      {
        id: `action_${email.id}_follow_up`,
        emailId: email.id,
        title: createSentFollowUpTitle(email),
        priority: 'medium',
        status: 'suggested',
        sourceSender: email.sender,
        sourceSubject: email.subject,
        sourceSnippet: createSourceSnippet(email.body),
        reason: 'No response received yet.',
      } satisfies ActionItem,
    ]
  })
}

function isSentByUser(email: Email) {
  return email.direction === 'sent' && email.sender.toLowerCase() === 'me'
}

function isOldEnoughForFollowUp(email: Email, latestEmailTime: number) {
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000
  return latestEmailTime - new Date(email.date).getTime() > twoDaysInMs
}

function isMeaningfulSentRequest(email: Email) {
  const text = getSearchText(email)
  const requestKeywords = [
    'can you',
    'could you',
    'please send',
    'please confirm',
    'confirm whether',
    'send the',
    'need it',
    'need your',
    'waiting on',
    '?',
  ]

  if (includesAny(text, noTaskKeywords) || text.includes('no action needed')) {
    return false
  }

  return includesAny(text, requestKeywords)
}

function hasLaterInboundReply(sentEmail: Email, emails: Email[]) {
  const sentEmailTime = new Date(sentEmail.date).getTime()
  const sentThreadKey = getSubjectGroup(sentEmail.subject)

  return emails.some(
    (email) =>
      email.direction === 'inbound' &&
      new Date(email.date).getTime() > sentEmailTime &&
      getSubjectGroup(email.subject) === sentThreadKey,
  )
}

function createSentFollowUpTitle(email: Email) {
  const recipientName = formatRecipientName(email.recipients?.[0])
  const topic = cleanSubject(email.subject)

  if (recipientName) {
    return `Follow up with ${recipientName} about ${topic}`
  }

  return `Follow up on ${topic}`
}

function formatRecipientName(recipient?: string) {
  return recipient?.replace(/\s*<[^>]+>\s*$/, '').trim()
}

function getLatestEmailTime(emails: Email[]) {
  return Math.max(...emails.map((email) => new Date(email.date).getTime()))
}

function createSourceSnippet(body: string) {
  const normalizedBody = body.replace(/\s+/g, ' ').trim()

  if (normalizedBody.length <= 140) {
    return normalizedBody
  }

  return `${normalizedBody.slice(0, 137).trim()}...`
}

function extractDueDate(email: Email) {
  const text = getSearchText(email)

  if (text.includes('today') || text.includes('within 24 hours')) {
    return 'today'
  }

  if (text.includes('tomorrow')) {
    return 'tomorrow'
  }

  if (text.includes('friday')) {
    return 'friday'
  }

  if (text.includes('thursday')) {
    return 'thursday'
  }

  const dateMatch = text.match(/\bmay\s+\d{1,2}\b/)

  return dateMatch?.[0]
}

function cleanSubject(subject: string) {
  return subject.replace(/^(re|fw|fwd):\s*/i, '').trim()
}

function getSubjectGroup(subject: string) {
  return cleanSubject(subject)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function getSearchText(email: Email) {
  return `${email.subject} ${email.body} ${email.labels?.join(' ') ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
