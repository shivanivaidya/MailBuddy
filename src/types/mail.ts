export type Email = {
  id: string
  sender: string
  subject: string
  body: string
  date: string
  direction: 'inbound' | 'sent'
  labels?: string[]
  recipients?: string[]
}

export type ActionItem = {
  id: string
  emailId: string
  title: string
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  dueDateSource?: 'email' | 'user'
  status: 'suggested' | 'completed' | 'dismissed'
  sourceSender: string
  sourceSubject: string
  sourceSnippet: string
  reason: string
}

export type ActionItemEdit = Pick<ActionItem, 'priority' | 'title'> & {
  dueDate?: string
}

export type DashboardStats = {
  emailsProcessed: number
  tasksFound: number
  highPriorityTasks: number
  completedTasks: number
}

export type EmailThread = {
  id: string
  subject: string
  participants: string[]
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  dueDateSource?: 'email' | 'user'
  status: 'suggested' | 'reviewed'
  shortSummary: string
  detailedSummaryBullets: string[]
  latestEmail: Email
  emails: Email[]
  needsReply: boolean
}

export type EmailThreadEdit = Pick<EmailThread, 'priority'> & {
  dueDate?: string
}
