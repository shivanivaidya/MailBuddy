import type { ActionItem, AssistantAnswer, OrderUpdate } from '@/types/mail'
import {
  answerAssistantTurn,
  calculateMerchantSpend,
  calculateRefundTotals,
  getConversationDetails,
  getOrderDetails,
  getQuickActionDetails,
  listQuickActionsByStatus,
  searchConversationMessages,
  searchConversations,
  searchOrderUpdates,
  searchQuickActions,
  trackResponseFromPerson,
  type AssistantContext,
  type AssistantDateRange,
  type AssistantMemory,
  type AssistantTurnResult,
} from '@/utils/assistantProcessing'
import { formatCurrency } from '@/utils/updateProcessing'

type AssistantToolName =
  | 'searchQuickActions'
  | 'listQuickActions'
  | 'getQuickActionDetails'
  | 'searchConversations'
  | 'searchConversationMessages'
  | 'getConversationDetails'
  | 'searchOrderUpdates'
  | 'getOrderDetails'
  | 'calculateMerchantSpend'
  | 'calculateRefundTotals'
  | 'trackResponseFromPerson'

type ToolArguments = Record<string, unknown>

export type AssistantToolCall = {
  arguments: ToolArguments
  id?: string
  tool: AssistantToolName
}

export type AssistantToolPlan = {
  clarificationQuestion?: string
  fallbackReason?: string
  mode: 'tool_calls' | 'clarification' | 'unsupported'
  toolCalls: AssistantToolCall[]
}

type AssistantPlanResponse = {
  plan?: AssistantToolPlan
}

export type AssistantToolResult = {
  arguments: ToolArguments
  result: unknown
  tool: AssistantToolName
}

type ToolAgentResult = AssistantTurnResult & {
  toolResults?: AssistantToolResult[]
}

type ToolAgentOptions = {
  fetcher?: typeof fetch
}

type SpendClassification = {
  category: string
  confidence: number
  include: boolean
  orderId: string
  reason: string
}

const supportedTools: AssistantToolName[] = [
  'searchQuickActions',
  'listQuickActions',
  'getQuickActionDetails',
  'searchConversations',
  'searchConversationMessages',
  'getConversationDetails',
  'searchOrderUpdates',
  'getOrderDetails',
  'calculateMerchantSpend',
  'calculateRefundTotals',
  'trackResponseFromPerson',
]

export const assistantToolSchemas = [
  {
    arguments: {
      priority: 'optional: high | medium | low',
      responseFormat: 'optional: count | list',
      status: 'optional: suggested | completed | dismissed',
    },
    description: 'List quick actions by structured fields. Use for priority counts/lists.',
    tool: 'listQuickActions',
  },
  {
    arguments: { query: 'string' },
    description: 'Search quick action titles, source subjects, snippets, and recipients.',
    tool: 'searchQuickActions',
  },
  {
    arguments: { id: 'string' },
    description: 'Fetch one quick action by id after a search result is selected.',
    tool: 'getQuickActionDetails',
  },
  {
    arguments: { personName: 'string', topic: 'optional string' },
    description: 'Check if a person responded or provided requested information.',
    tool: 'trackResponseFromPerson',
  },
  {
    arguments: { query: 'string' },
    description: 'Search conversation subjects, summaries, participants, and messages.',
    tool: 'searchConversations',
  },
  {
    arguments: { query: 'string' },
    description: 'Search individual conversation messages.',
    tool: 'searchConversationMessages',
  },
  {
    arguments: { id: 'string' },
    description: 'Fetch one conversation/thread by id after search.',
    tool: 'getConversationDetails',
  },
  {
    arguments: { query: 'string' },
    description: 'Search order updates by merchant, status, order number, and source emails.',
    tool: 'searchOrderUpdates',
  },
  {
    arguments: { id: 'string' },
    description: 'Fetch one order update by id after search.',
    tool: 'getOrderDetails',
  },
  {
    arguments: {
      category: 'optional string, such as clothing, groceries, beauty, pets, restaurant, electronics, household, gifts',
      merchantNames: 'optional string[]',
    },
    description:
      'Calculate spend with deterministic code. For category questions, pass the user-requested category string and let the LLM classifier decide included orders.',
    tool: 'calculateMerchantSpend',
  },
  {
    arguments: {
      category: 'optional string, such as clothing, groceries, beauty, pets, restaurant, electronics, household, gifts',
      merchantNames: 'optional string[]',
    },
    description: 'Calculate refund totals with deterministic code.',
    tool: 'calculateRefundTotals',
  },
]

export async function answerAssistantWithToolPlanning(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
  options: ToolAgentOptions = {},
): Promise<ToolAgentResult> {
  const fallback = answerAssistantTurn(query, context, memory)

  try {
    const plan = await requestAssistantPlan(query, context.dateRange, options)
    if (!validateAssistantToolPlan(plan)) {
      return fallback
    }

    if (plan.mode === 'clarification') {
      const localPlan =
        createQuickActionPlanFromQuestion(query) ?? createSpendPlanFromQuestion(query)

      if (localPlan) {
        const toolResults = await executeAssistantToolPlan(localPlan, context, options)
        const answer = createAnswerFromToolResults(toolResults)

        if (answer) {
          return {
            answer,
            memory: fallback.memory,
            toolResults,
          }
        }
      }

      return {
        answer: {
          message: plan.clarificationQuestion ?? 'Can you clarify what you mean?',
          type: 'clarification',
        },
        memory,
      }
    }

    if (plan.mode === 'unsupported') {
      return fallback
    }

    const toolResults = await executeAssistantToolPlan(plan, context, options)
    const answer = createAnswerFromToolResults(toolResults)

    if (!answer) {
      return fallback
    }

    return {
      answer,
      memory: fallback.memory,
      toolResults,
    }
  } catch {
    return fallback
  }
}

function createQuickActionPlanFromQuestion(
  query: string,
): AssistantToolPlan | undefined {
  if (
    !/\b(task|quick action|todo|to do|due|deadline|permission slip|form|renew|submit|sign|return|need to do)\b/i.test(
      query,
    )
  ) {
    return undefined
  }

  return {
    mode: 'tool_calls',
    toolCalls: [
      {
        arguments: {
          query: extractQuickActionQuery(query),
        },
        tool: 'searchQuickActions',
      },
    ],
  }
}

function extractQuickActionQuery(query: string) {
  return query
    .replace(/[?.!]+$/g, '')
    .replace(
      /\b(?:when|what|is|are|the|my|a|an|do|does|did|i|need|to|know|due|date|for)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim() || query
}

function createSpendPlanFromQuestion(query: string): AssistantToolPlan | undefined {
  const normalizedQuery = query.toLowerCase()
  const isRefundQuestion = /\brefund|refunded|reimburse|reimbursed\b/.test(
    normalizedQuery,
  )
  const isSpendQuestion =
    isRefundQuestion ||
    /\bspend|spent|buy|bought|purchase|purchased|order|orders|paid\b/.test(
      normalizedQuery,
    )

  if (!isSpendQuestion) {
    return undefined
  }

  return {
    mode: 'tool_calls',
    toolCalls: [
      {
        arguments: {
          category: extractSpendCategory(query),
          merchantNames: null,
        },
        tool: isRefundQuestion ? 'calculateRefundTotals' : 'calculateMerchantSpend',
      },
    ],
  }
}

function extractSpendCategory(query: string) {
  const categoryMatch = query.match(
    /\b(?:spend|spent|refund|refunded|reimburse|reimbursed|buy|bought|purchase|purchased|order|orders|paid)\s+(?:on|for|from)?\s+(.+?)\s*(?:\b(?:this|last|next)\s+(?:week|month|year)\b|\b(?:today|yesterday|tomorrow)\b|\b(?:in|during|between|from)\b|[?.!]|$)/i,
  )
  const category = categoryMatch?.[1]
    ?.replace(/\b(?:the|my|a|an|total|amount|much|did|i)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return category && isSafeCategoryName(category) ? normalizeCategoryName(category) : undefined
}

export async function finalizeAssistantToolResults(
  query: string,
  answer: AssistantAnswer,
  toolResults: AssistantToolResult[] | undefined,
  options: ToolAgentOptions = {},
) {
  if (answer.type !== 'answer' || !toolResults?.length) {
    return answer
  }

  const fetcher = options.fetcher ?? fetch

  try {
    const response = await fetcher('/api/assistant/finalize', {
      body: JSON.stringify({
        formatting: {
          audience: 'MailBuddy portfolio demo user',
          maxSentences: 3,
          style: 'natural, concise, grounded',
        },
        question: query,
        toolResults,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (!response.ok) {
      return answer
    }

    const data = (await response.json()) as { message?: string }
    const message = data.message?.trim()

    return message ? { ...answer, message } : answer
  } catch {
    return answer
  }
}

export function validateAssistantToolPlan(plan: unknown): plan is AssistantToolPlan {
  if (!plan || typeof plan !== 'object') {
    return false
  }

  const candidate = plan as AssistantToolPlan

  if (!['tool_calls', 'clarification', 'unsupported'].includes(candidate.mode)) {
    return false
  }

  if (!Array.isArray(candidate.toolCalls)) {
    return false
  }

  if (candidate.mode === 'clarification') {
    return typeof candidate.clarificationQuestion === 'string'
  }

  if (candidate.mode === 'unsupported') {
    return candidate.toolCalls.length === 0
  }

  return (
    candidate.toolCalls.length > 0 &&
    candidate.toolCalls.every((call) => isValidToolCall(call))
  )
}

export function executeAssistantToolPlan(
  plan: AssistantToolPlan,
  context: AssistantContext,
  options: ToolAgentOptions = {},
): Promise<AssistantToolResult[]> {
  return Promise.all(
    plan.toolCalls.map(async (call) => ({
      arguments: sanitizeArguments(call.arguments),
      result: await executeToolCall(call, context, options),
      tool: call.tool,
    })),
  )
}

async function requestAssistantPlan(
  query: string,
  dateRange: AssistantDateRange | undefined,
  options: ToolAgentOptions,
) {
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher('/api/assistant/plan', {
    body: JSON.stringify({
      dateRange,
      question: query,
      tools: assistantToolSchemas,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Assistant planner unavailable')
  }

  const data = (await response.json()) as AssistantPlanResponse

  if (!data.plan) {
    throw new Error('Assistant planner returned no plan')
  }

  return data.plan
}

function isValidToolCall(call: unknown): call is AssistantToolCall {
  if (!call || typeof call !== 'object') {
    return false
  }

  const candidate = call as AssistantToolCall

  return (
    supportedTools.includes(candidate.tool) &&
    candidate.arguments !== null &&
    typeof candidate.arguments === 'object' &&
    validateToolArguments(candidate.tool, candidate.arguments)
  )
}

function validateToolArguments(tool: AssistantToolName, args: ToolArguments) {
  if (hasArgument(args.status) && !['suggested', 'completed', 'dismissed'].includes(String(args.status))) {
    return false
  }

  if (hasArgument(args.priority) && !['high', 'medium', 'low'].includes(String(args.priority))) {
    return false
  }

  if (hasArgument(args.responseFormat) && !['count', 'list'].includes(String(args.responseFormat))) {
    return false
  }

  if (hasArgument(args.category) && !isSafeCategoryName(args.category)) {
    return false
  }

  if (['searchQuickActions', 'searchConversations', 'searchConversationMessages', 'searchOrderUpdates'].includes(tool)) {
    return typeof args.query === 'string'
  }

  if (['getQuickActionDetails', 'getConversationDetails', 'getOrderDetails'].includes(tool)) {
    return typeof args.id === 'string'
  }

  if (tool === 'trackResponseFromPerson') {
    return typeof args.personName === 'string'
  }

  if (tool === 'calculateMerchantSpend' || tool === 'calculateRefundTotals') {
    return !hasArgument(args.merchantNames) || Array.isArray(args.merchantNames)
  }

  return true
}

function hasArgument(value: unknown) {
  return value !== undefined && value !== null
}

async function executeToolCall(
  call: AssistantToolCall,
  context: AssistantContext,
  options: ToolAgentOptions,
) {
  const args = call.arguments

  if (call.tool === 'listQuickActions') {
    const status = getStatusArg(args.status)
    const priority = getPriorityArg(args.priority)
    const actions = listQuickActionsByStatus(status, context.dateRange, context)
      .filter((action) => !priority || action.priority === priority)

    return {
      actions: actions.map(compactAction),
      count: actions.length,
      priority: priority ?? null,
      responseFormat: args.responseFormat ?? 'list',
      status,
    }
  }

  if (call.tool === 'searchQuickActions') {
    const actions = searchQuickActions(String(args.query), context.dateRange, context)
    return {
      actions: actions.slice(0, 5).map(compactAction),
      count: actions.length,
    }
  }

  if (call.tool === 'getQuickActionDetails') {
    const action = getQuickActionDetails(String(args.id), context.dateRange, context)
    return action ? compactAction(action) : null
  }

  if (call.tool === 'searchConversations') {
    const threads = searchConversations(String(args.query), context.dateRange, context)
    return {
      count: threads.length,
      conversations: threads.slice(0, 5).map((thread) => ({
        detailedSummaryBullets: thread.detailedSummaryBullets,
        id: thread.id,
        latestMessage: compactEmail(thread.latestEmail),
        needsReply: thread.needsReply,
        participants: thread.participants,
        subject: thread.subject,
        summary: thread.shortSummary,
      })),
    }
  }

  if (call.tool === 'searchConversationMessages') {
    const matches = searchConversationMessages(String(args.query), context.dateRange, context)
    return {
      count: matches.length,
      messages: matches.slice(0, 5).map((match) => ({
        conversationId: match.thread.id,
        conversationSubject: match.thread.subject,
        message: compactEmail(match.email),
      })),
    }
  }

  if (call.tool === 'getConversationDetails') {
    const thread = getConversationDetails(String(args.id), context.dateRange, context)
    return thread
      ? {
          detailedSummaryBullets: thread.detailedSummaryBullets,
          emails: thread.emails.map(compactEmail),
          id: thread.id,
          needsReply: thread.needsReply,
          participants: thread.participants,
          subject: thread.subject,
          summary: thread.shortSummary,
        }
      : null
  }

  if (call.tool === 'searchOrderUpdates') {
    const orders = searchOrderUpdates(String(args.query), context.dateRange, context)
    return {
      count: orders.length,
      orders: orders.slice(0, 5).map(compactOrder),
    }
  }

  if (call.tool === 'getOrderDetails') {
    const order = getOrderDetails(String(args.id), context.dateRange, context)
    return order ? compactOrder(order) : null
  }

  if (call.tool === 'calculateMerchantSpend') {
    const category = getSpendCategoryArg(args.category)
    const classifiedOrders = category
      ? await classifySpendCategoryOrders(category, context, options)
      : undefined
    const merchantNames = getMerchantNamesArg(args.merchantNames)
    return {
      category: category ?? null,
      classifications: classifiedOrders?.classifications ?? [],
      includedOrders: classifiedOrders?.orders.map(compactOrder) ?? [],
      merchantNames: classifiedOrders
        ? dedupe(classifiedOrders.orders.map((order) => order.merchantName))
        : merchantNames,
      totalSpend: classifiedOrders
        ? roundCurrency(
            classifiedOrders.orders.reduce(
              (total, order) => total + (order.orderTotal ?? 0),
              0,
            ),
          )
        : calculateMerchantSpend(merchantNames, context.dateRange, context),
    }
  }

  if (call.tool === 'calculateRefundTotals') {
    const category = getSpendCategoryArg(args.category)
    const classifiedOrders = category
      ? await classifySpendCategoryOrders(category, context, options)
      : undefined
    const merchantNames = getMerchantNamesArg(args.merchantNames)
    return {
      category: category ?? null,
      classifications: classifiedOrders?.classifications ?? [],
      includedOrders: classifiedOrders?.orders.map(compactOrder) ?? [],
      merchantNames: classifiedOrders
        ? dedupe(classifiedOrders.orders.map((order) => order.merchantName))
        : merchantNames,
      refundTotal: classifiedOrders
        ? roundCurrency(
            classifiedOrders.orders.reduce(
              (total, order) => total + (order.refundTotal ?? 0),
              0,
            ),
          )
        : calculateRefundTotals(merchantNames, context.dateRange, context),
    }
  }

  const matches = trackResponseFromPerson(
    String(args.personName),
    typeof args.topic === 'string' ? args.topic : undefined,
    context.dateRange,
    context,
  )
  const topic = typeof args.topic === 'string' ? args.topic : ''
  const actionMatches = listQuickActionsByStatus(
    'suggested',
    context.dateRange,
    context,
  )
    .filter((action) => action.reason === 'No response received yet.')
    .filter((action) =>
      includesTerms(
        `${action.title} ${action.sourceSender} ${action.sourceSubject} ${action.sourceSnippet}`,
        [String(args.personName), topic],
      ),
    )

  return {
    actionMatches: actionMatches.map(compactAction),
    matches: matches.map((match) => ({
      latestReply: match.latestReply ? compactEmail(match.latestReply) : null,
      relevantReply: match.relevantReply ? compactEmail(match.relevantReply) : null,
      thread: {
        id: match.thread.id,
        subject: match.thread.subject,
        summary: match.thread.shortSummary,
      },
    })),
    personName: String(args.personName),
    topic: topic || null,
  }
}

function createAnswerFromToolResults(toolResults: AssistantToolResult[]): AssistantAnswer | undefined {
  const first = toolResults[0]

  if (!first) {
    return undefined
  }

  if (first.tool === 'listQuickActions') {
    const result = first.result as {
      actions: ReturnType<typeof compactAction>[]
      count: number
      priority: ActionItem['priority'] | null
      responseFormat: unknown
    }
    const priorityLabel = result.priority ? `${result.priority} priority ` : ''

    if (result.responseFormat === 'count') {
      return {
        grounding: `Quick actions${result.priority ? `: ${priorityLabel.trim()}` : ''}`,
        message: `You have ${result.count} ${priorityLabel}${pluralizeTask(result.count)}.`,
        type: 'answer',
      }
    }

    return {
      grounding: `Quick actions${result.priority ? `: ${priorityLabel.trim()}` : ''}`,
      message: result.count
        ? `${capitalize(priorityLabel || 'quick actions')}: ${result.actions
            .map((action) => action.title)
            .join(', ')}.`
        : `You don’t have any ${priorityLabel}tasks.`,
      type: 'answer',
    }
  }

  if (first.tool === 'searchQuickActions') {
    const result = first.result as {
      actions: ReturnType<typeof compactAction>[]
      count: number
    }
    const dueAction = result.actions.find((action) => action.dueDate)

    return {
      grounding: dueAction ? `Task: ${dueAction.title}` : 'Quick actions',
      message: dueAction
        ? `${dueAction.title} is due ${dueAction.dueDate}.`
        : result.count
          ? `I found ${result.count} matching ${pluralizeTask(result.count)}: ${result.actions
              .map((action) => action.title)
              .join(', ')}.`
          : 'I didn’t find matching data in the selected date range.',
      type: result.count ? 'answer' : 'no-data',
    }
  }

  if (first.tool === 'trackResponseFromPerson') {
    const result = first.result as {
      actionMatches: ReturnType<typeof compactAction>[]
      matches: Array<{
        latestReply: ReturnType<typeof compactEmail> | null
        relevantReply: ReturnType<typeof compactEmail> | null
        thread: { subject: string }
      }>
      personName: string
      topic: string | null
    }
    const match = result.matches[0]
    const actionMatch = result.actionMatches[0]

    if (!match && !actionMatch) {
      return {
        message: 'I didn’t find matching data in the selected date range.',
        type: 'no-data',
      }
    }

    if (actionMatch && !match) {
      return {
        grounding: `Quick action: ${actionMatch.sourceSubject}`,
        message: `No, I don’t see a response from ${result.personName}${result.topic ? ` about ${result.topic}` : ''} yet.`,
        type: 'answer',
      }
    }

    if (match.relevantReply) {
      return {
        grounding: `Conversation: ${match.thread.subject}`,
        message: `Yes, ${result.personName} responded about ${result.topic ?? 'that'}: ${match.relevantReply.snippet}`,
        type: 'answer',
      }
    }

    if (match.latestReply) {
      return {
        grounding: `Conversation: ${match.thread.subject}`,
        message: `${result.personName} replied in ${match.thread.subject}, but I don’t see a response about ${result.topic ?? 'that'}.`,
        type: 'answer',
      }
    }

    return {
      grounding: `Conversation: ${match.thread.subject}`,
      message: `No, I don’t see a response from ${result.personName}${result.topic ? ` about ${result.topic}` : ''} yet.`,
      type: 'answer',
    }
  }

  if (first.tool === 'searchConversations' || first.tool === 'searchConversationMessages') {
    const result = first.result as {
      conversations?: Array<{ detailedSummaryBullets?: string[]; subject: string; summary: string }>
      messages?: Array<{ conversationSubject: string; message: ReturnType<typeof compactEmail> }>
    }
    const conversation = result.conversations?.[0]
    const message = result.messages?.[0]

    if (conversation) {
      return {
        grounding: `Conversation: ${conversation.subject}`,
        message: `${conversation.subject}: ${
          conversation.detailedSummaryBullets?.join(' ') || conversation.summary
        }`,
        type: 'answer',
      }
    }

    if (message) {
      return {
        grounding: `Conversation: ${message.conversationSubject}`,
        message: `${message.conversationSubject}: ${message.message.snippet}`,
        type: 'answer',
      }
    }
  }

  if (first.tool === 'searchOrderUpdates') {
    const result = first.result as {
      orders: ReturnType<typeof compactOrder>[]
    }
    const order = result.orders[0]

    if (!order) {
      return {
        message: 'I didn’t find matching data in the selected date range.',
        type: 'no-data',
      }
    }

    return {
      grounding: `Order: ${order.merchantName}`,
      message: `${order.merchantName} order is ${formatOrderStatus(order)}.`,
      type: 'answer',
    }
  }

  if (first.tool === 'calculateMerchantSpend') {
    const result = first.result as {
      category: string | null
      includedOrders: ReturnType<typeof compactOrder>[]
      merchantNames: string[]
      totalSpend: number
    }
    return {
      grounding: result.category
        ? `Order totals: ${result.category} category`
        : result.merchantNames.length
        ? `Merchant: ${result.merchantNames.join(', ')}`
        : 'Order totals',
      message:
        result.totalSpend > 0
          ? `You spent ${formatCurrency(result.totalSpend)}${
              result.category
                ? ` on ${result.category}`
                : result.merchantNames.length
                  ? ` on ${result.merchantNames.join(', ')}`
                  : ''
            } in the requested period.${
              result.category && result.merchantNames.length
                ? ` Included merchants: ${result.merchantNames.join(', ')}.`
                : ''
            }`
          : `I didn’t find matching spend data${
              result.category ? ` for ${result.category}` : ''
            } in the requested period.`,
      type: result.totalSpend > 0 ? 'answer' : 'no-data',
    }
  }

  if (first.tool === 'calculateRefundTotals') {
    const result = first.result as {
      category: string | null
      includedOrders: ReturnType<typeof compactOrder>[]
      merchantNames: string[]
      refundTotal: number
    }
    return {
      grounding: result.category
        ? `Refund totals: ${result.category} category`
        : 'Refund totals',
      message: `You received ${formatCurrency(result.refundTotal)} in refunds${
        result.category
          ? ` from ${result.category}`
          : result.merchantNames.length
            ? ` from ${result.merchantNames.join(', ')}`
            : ''
      } in the selected date range.${
        result.category && result.merchantNames.length
          ? ` Included merchants: ${result.merchantNames.join(', ')}.`
          : ''
      }`,
      type: result.refundTotal > 0 ? 'answer' : 'no-data',
    }
  }

  return undefined
}

function sanitizeArguments(args: ToolArguments) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined && value !== null),
  )
}

function compactAction(action: ActionItem) {
  return {
    dueDate: action.dueDate ?? null,
    id: action.id,
    priority: action.priority,
    reason: action.reason,
    sourceSubject: action.sourceSubject,
    status: action.status,
    title: action.title,
  }
}

function compactEmail(email: { body: string; date: string; direction: string; sender: string; subject: string }) {
  return {
    date: email.date,
    direction: email.direction,
    sender: email.sender,
    snippet: summarize(email.body),
    subject: email.subject,
  }
}

function compactOrder(order: OrderUpdate) {
  return {
    deliveredTime: order.deliveredTime ?? null,
    deliveryStatus: order.deliveryStatus ?? null,
    expectedDeliveryTime: order.expectedDeliveryTime ?? null,
    finalChargedAmount: order.finalChargedAmount ?? null,
    merchantName: order.merchantName,
    orderDate: order.orderDate,
    orderTotal: order.orderTotal ?? null,
    refundTotal: order.refundTotal ?? null,
    status: order.status,
    trackingNumber: order.trackingNumber ?? null,
  }
}

function getStatusArg(value: unknown): ActionItem['status'] {
  return value === 'completed' || value === 'dismissed' ? value : 'suggested'
}

function getPriorityArg(value: unknown): ActionItem['priority'] | undefined {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : undefined
}

function getMerchantNamesArg(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function getSpendCategoryArg(value: unknown): string | undefined {
  return isSafeCategoryName(value) ? normalizeCategoryName(String(value)) : undefined
}

async function classifySpendCategoryOrders(
  category: string,
  context: AssistantContext,
  options: ToolAgentOptions,
) {
  const orders = filterOrdersByDateRange(context.orders, context.dateRange)
  const classifications = await requestSpendClassifications(category, orders, options)
  const classificationById = new Map(
    classifications.map((classification) => [classification.orderId, classification]),
  )

  return {
    classifications,
    orders: orders.filter((order) => {
      const classification = classificationById.get(order.id)

      return (
        classification?.include === true &&
        classification.confidence >= 0.6
      )
    }),
  }
}

async function requestSpendClassifications(
  category: string,
  orders: OrderUpdate[],
  options: ToolAgentOptions,
) {
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher('/api/assistant/classify-spend', {
    body: JSON.stringify({
      category,
      orders: orders.map((order) => ({
        id: order.id,
        items: order.items?.map((item) => item.name) ?? [],
        merchantName: order.merchantName,
        orderDate: order.orderDate,
        orderTotal: order.orderTotal ?? null,
        source: 'structured_order_update',
      })),
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Spend classifier unavailable')
  }

  const data = (await response.json()) as {
    classifications?: SpendClassification[]
  }

  return validateSpendClassifications(data.classifications, orders)
}

function validateSpendClassifications(
  classifications: SpendClassification[] | undefined,
  orders: OrderUpdate[],
) {
  if (!Array.isArray(classifications)) {
    return []
  }

  const orderIds = new Set(orders.map((order) => order.id))

  return classifications
    .filter((classification) => orderIds.has(classification.orderId))
    .filter((classification) => isSafeCategoryName(classification.category))
    .filter((classification) => typeof classification.include === 'boolean')
    .filter((classification) => typeof classification.confidence === 'number')
    .map((classification) => ({
      category: normalizeCategoryName(classification.category),
      confidence: Math.max(0, Math.min(1, classification.confidence)),
      include: classification.include,
      orderId: classification.orderId,
      reason: String(classification.reason ?? ''),
    }))
}

function isSafeCategoryName(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[a-z][a-z\s-]{1,40}$/i.test(value.trim()) &&
    normalizeCategoryName(value) !== 'other'
  )
}

function normalizeCategoryName(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

function filterOrdersByDateRange(
  orders: OrderUpdate[],
  dateRange: AssistantDateRange | undefined,
) {
  if (!dateRange) {
    return orders
  }

  return orders.filter((order) => {
    const time = new Date(order.orderDate).getTime()

    return (
      time >= new Date(`${dateRange.startDate}T00:00:00.000`).getTime() &&
      time <= new Date(`${dateRange.endDate}T23:59:59.999`).getTime()
    )
  })
}

function dedupe(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function pluralizeTask(count: number) {
  return count === 1 ? 'task' : 'tasks'
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

function summarize(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 180 ? `${normalized.slice(0, 177).trim()}...` : normalized
}

function includesTerms(value: string, terms: string[]) {
  const normalized = value.toLowerCase()

  return terms
    .flatMap((term) => term.toLowerCase().split(/\s+/))
    .filter(Boolean)
    .every((term) => normalized.includes(term))
}

function formatOrderStatus(order: ReturnType<typeof compactOrder>) {
  if (order.deliveryStatus === 'delivered' || order.status === 'delivered') {
    return `delivered${order.deliveredTime ? ` at ${order.deliveredTime}` : ''}`
  }

  if (order.trackingNumber) {
    return `${String(order.status).replaceAll('_', ' ')} with tracking ${order.trackingNumber}`
  }

  return String(order.status).replaceAll('_', ' ')
}
