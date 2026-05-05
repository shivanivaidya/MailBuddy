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

export type OrderStatus =
  | 'delivered'
  | 'out_for_delivery'
  | 'shipped'
  | 'refunded'
  | 'partially_refunded'
  | 'confirmed'
  | 'updated'

export type DeliveryStatus =
  | 'delivered'
  | 'out_for_delivery'
  | 'shipped'
  | 'delayed'

export type RefundedItem = {
  amount: number
  name: string
}

export type ReplacedItem = {
  originalItem: string
  priceDifference?: number
  replacementItem: string
}

export type OrderItem = {
  name: string
  price: number
}

export type OrderUpdate = {
  id: string
  merchantName: string
  orderNumber: string
  orderDate: string
  status: OrderStatus
  deliveryStatus?: DeliveryStatus
  expectedDeliveryTime?: string
  deliveredTime?: string
  trackingNumber?: string
  trackingDetails?: string
  items?: OrderItem[]
  replacedItems?: ReplacedItem[]
  refundedItems?: RefundedItem[]
  orderTotal?: number
  refundTotal?: number
  finalChargedAmount?: number
  relatedEmailIds: string[]
}

export type MerchantSpendSummary = {
  merchantName: string
  orderCount: number
  refundTotal: number
  totalSpend: number
  netSpend: number
  monthlySpend: Array<{
    month: string
    refundTotal: number
    totalSpend: number
    netSpend: number
  }>
}

export type AssistantAnswer = {
  grounding?: string
  message: string
  type: 'answer' | 'clarification' | 'unsupported' | 'no-data'
}
