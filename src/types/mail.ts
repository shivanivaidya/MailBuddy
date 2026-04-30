export type Email = {
  id: string
  sender: string
  subject: string
  body: string
  date: string
  direction: 'inbound' | 'sent'
  labels?: string[]
}

export type ActionItem = {
  id: string
  emailId: string
  title: string
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  status: 'suggested' | 'completed' | 'dismissed'
  sourceSender: string
  sourceSubject: string
  sourceSnippet: string
  reason: string
}

export type DashboardStats = {
  emailsProcessed: number
  tasksFound: number
  highPriorityTasks: number
  completedTasks: number
}
