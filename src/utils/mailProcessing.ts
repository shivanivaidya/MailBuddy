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
  return emails.flatMap((email) => {
    if (!shouldCreateActionItem(email)) {
      return []
    }

    return [
      {
        id: `action_${email.id}`,
        emailId: email.id,
        title: createTaskTitle(email),
        priority: prioritizeActionItem(email),
        dueDate: extractDueDate(email),
        status: 'suggested',
        sourceSender: email.sender,
        sourceSubject: email.subject,
        sourceSnippet: createSourceSnippet(email.body),
        reason: createReason(email),
      },
    ]
  })
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

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function getSearchText(email: Email) {
  return `${email.subject} ${email.body} ${email.labels?.join(' ') ?? ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
