import type {
  ActionItem,
  AssistantAnswer,
  Email,
  EmailThread,
  MerchantSpendSummary,
  OrderUpdate,
} from '@/types/mail'
import { formatCurrency } from '@/utils/updateProcessing'

export type AssistantDateRange = {
  endDate: string
  startDate: string
}

type AssistantDomain =
  | 'quick_actions'
  | 'conversations'
  | 'order_updates'
  | 'spend'

type ClarificationCandidate = {
  domain: AssistantDomain
  id: string
  label: string
}

export type AssistantRecentTurn = {
  answer: string
  domain?: AssistantDomain
  entities: {
    category?: string
    conversationId?: string
    merchantName?: string
    orderId?: string
    orderNumber?: string
    personName?: string
    subject?: string
  }
  query: string
  type: AssistantAnswer['type']
}

export type AssistantChatHistoryTurn = {
  answer: string
  domain?: AssistantDomain
  entities: AssistantRecentTurn['entities']
  question: string
  type: AssistantAnswer['type']
}

export type AssistantContext = {
  actions: ActionItem[]
  dateRange?: AssistantDateRange
  emails: Email[]
  merchantSpend: MerchantSpendSummary[]
  orders: OrderUpdate[]
  threads: EmailThread[]
}

export type AssistantMemory = {
  clarification?: {
    candidates: ClarificationCandidate[]
    originalQuery: string
  }
  lastSuccessfulDomain?: AssistantDomain
  orderContext?: {
    merchantName: string
    orderId: string
    orderNumber: string
  }
  spendContext?: {
    category?: string
    merchantNames?: string[]
  }
  threadContext?: {
    conversationId: string
    referencedPerson?: string
    subject: string
  }
  recentTurns?: AssistantRecentTurn[]
}

export type AssistantTurnResult = {
  answer: AssistantAnswer
  memory: AssistantMemory
}

export function getAssistantChatHistory(
  memory: AssistantMemory,
): AssistantChatHistoryTurn[] {
  return (memory.recentTurns ?? []).map((turn) => ({
    answer: turn.answer,
    domain: turn.domain,
    entities: turn.entities,
    question: turn.query,
    type: turn.type,
  }))
}

type QueryUnderstanding = {
  domains: AssistantDomain[]
  merchantNames: string[]
  orderDate?: string
  orderNumbers: string[]
  personName?: string
  terms: string[]
  topicTerms: string[]
}

type ConversationMessageMatch = {
  email: Email
  thread: EmailThread
}

const unsupportedAnswer: AssistantAnswer = {
  message:
    'I don’t support that yet. I can help with quick actions, conversations, and order updates.',
  type: 'unsupported',
}

const noDataAnswer: AssistantAnswer = {
  message: 'I didn’t find matching data in the selected date range.',
  type: 'no-data',
}

export function answerAssistantQuery(
  query: string,
  context: AssistantContext,
): AssistantAnswer {
  return answerAssistantTurn(query, context).answer
}

export function answerAssistantTurn(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory = {},
): AssistantTurnResult {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery) {
    return {
      answer: {
        message: 'What would you like to check?',
        type: 'clarification',
      },
      memory: recordAssistantTurn(query, {
        message: 'What would you like to check?',
        type: 'clarification',
      }, memory),
    }
  }

  const clarificationTurn = resolveClarification(normalizedQuery, context, memory)

  if (clarificationTurn) {
    return {
      ...clarificationTurn,
      memory: recordAssistantTurn(query, clarificationTurn.answer, clarificationTurn.memory),
    }
  }

  const result = runBoundedAssistant(normalizedQuery, context, memory)

  return {
    ...result,
    memory: recordAssistantTurn(query, result.answer, result.memory),
  }
}

export function searchQuickActions(
  query: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const terms = getMeaningfulTerms(query)
  const actions = filterActionsByDateRange(context.actions, context.emails, dateRange)

  if (!terms.length) {
    return actions
  }

  return rankMatches(actions, terms, getActionSearchText)
}

export function getQuickActionDetails(
  id: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  return filterActionsByDateRange(context.actions, context.emails, dateRange).find(
    (action) => action.id === id,
  )
}

export function listQuickActionsByStatus(
  status: ActionItem['status'],
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  return filterActionsByDateRange(context.actions, context.emails, dateRange).filter(
    (action) => action.status === status,
  )
}

export function searchConversations(
  query: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const terms = getMeaningfulTerms(query)
  const threads = filterThreadsByDateRange(context.threads, dateRange)

  if (!terms.length) {
    return threads
  }

  return rankMatches(threads, terms, getThreadSearchText)
}

export function searchConversationMessages(
  query: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const terms = getMeaningfulTerms(query)
  const matches = filterThreadsByDateRange(context.threads, dateRange).flatMap(
    (thread) =>
      thread.emails.map((email) => ({
        email,
        thread,
      })),
  )

  if (!terms.length) {
    return matches
  }

  return rankMatches(
    matches,
    terms,
    (match) => `${match.thread.subject} ${match.email.sender} ${match.email.subject} ${match.email.body}`,
  )
}

export function getConversationDetails(
  id: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  return filterThreadsByDateRange(context.threads, dateRange).find(
    (thread) => thread.id === id,
  )
}

export function searchOrderUpdates(
  query: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const terms = getMeaningfulTerms(query)
  const orders = filterOrdersByDateRange(context.orders, dateRange)

  if (!terms.length) {
    return orders
  }

  return rankMatches(orders, terms, (order) => getOrderSearchText(order, context))
}

export function getOrderDetails(
  id: string,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  return filterOrdersByDateRange(context.orders, dateRange).find(
    (order) => order.id === id,
  )
}

export function calculateMerchantSpend(
  merchantNames: string[] | string | undefined,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const names = normalizeMerchantNames(merchantNames)
  const orders = filterOrdersByMerchant(
    filterOrdersByDateRange(context.orders, dateRange),
    names,
  )

  return roundCurrency(
    orders.reduce((total, order) => total + (order.orderTotal ?? 0), 0),
  )
}

export function calculateRefundTotals(
  merchantNames: string[] | string | undefined,
  dateRange: AssistantDateRange | undefined,
  context: AssistantContext,
) {
  const names = normalizeMerchantNames(merchantNames)
  const orders = filterOrdersByMerchant(
    filterOrdersByDateRange(context.orders, dateRange),
    names,
  )

  return roundCurrency(
    orders.reduce((total, order) => total + (order.refundTotal ?? 0), 0),
  )
}

export function trackResponseFromPerson(
  personName: string,
  topicOrDateRange: string | string[] | AssistantDateRange | undefined,
  dateRangeOrContext?: AssistantDateRange | AssistantContext,
  maybeContext?: AssistantContext,
) {
  const context = maybeContext ?? (dateRangeOrContext as AssistantContext)
  const dateRange = maybeContext
    ? (dateRangeOrContext as AssistantDateRange | undefined)
    : (topicOrDateRange as AssistantDateRange | undefined)
  const topic = maybeContext ? topicOrDateRange : undefined
  const topicTerms = Array.isArray(topic)
    ? topic.map(normalize).filter(Boolean)
    : typeof topic === 'string'
      ? getMeaningfulTerms(topic)
      : []
  const threads = filterThreadsByDateRange(context.threads, dateRange).filter(
    (thread) =>
      mentionsPerson(getThreadSearchText(thread), personName) &&
      (!topicTerms.length || scoreText(getThreadSearchText(thread), topicTerms) > 0),
  )

  return threads.map((thread) => {
    const latestReply = findLatestInboundFromPerson(thread, personName)
    const relevantReply = latestReply
      ? findRelevantInboundFromPerson(thread, personName, topicTerms)
      : undefined

    return {
      latestReply,
      relevantReply,
      thread,
    }
  })
}

function runBoundedAssistant(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult {
  const understanding = understandQuery(query, context, memory)

  for (const domain of understanding.domains) {
    const result = inspectDomain(domain, query, understanding, context, memory)

    if (result) {
      return result
    }
  }

  if (looksLikeUnsupportedCreativeRequest(query)) {
    return {
      answer: unsupportedAnswer,
      memory: remember(memory, undefined),
    }
  }

  if (looksLikeStructuredQuestion(query, understanding)) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, undefined),
    }
  }

  return {
    answer: unsupportedAnswer,
    memory: remember(memory, undefined),
  }
}

function inspectDomain(
  domain: AssistantDomain,
  query: string,
  understanding: QueryUnderstanding,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  if (domain === 'spend') {
    return answerSpendQuestion(query, understanding, context, memory)
  }

  if (domain === 'quick_actions') {
    return answerQuickActionQuestion(query, context, memory)
  }

  if (domain === 'order_updates') {
    return answerOrderQuestion(query, understanding, context, memory)
  }

  return answerConversationQuestion(query, understanding, context, memory)
}

function answerQuickActionQuestion(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  const priority = getPriorityMention(query)

  if (isTodayTaskSummaryQuery(query)) {
    const actions = sortActionsByPriority(
      listQuickActionsByStatus('suggested', context.dateRange, context),
    )
    const highestPriority = actions[0]?.priority
    const highestPriorityActions = highestPriority
      ? actions.filter((action) => action.priority === highestPriority)
      : []

    return {
      answer: {
        grounding: highestPriority
          ? `Quick actions: ${highestPriority} priority`
          : 'Quick actions',
        message: highestPriorityActions.length
          ? `${capitalize(highestPriority)} priority: ${highestPriorityActions
              .map((action) => action.title)
              .join(', ')}.`
          : noDataAnswer.message,
        type: highestPriorityActions.length ? 'answer' : 'no-data',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  if (query.includes('completed')) {
    const count = listQuickActionsByStatus('completed', context.dateRange, context).length

    return {
      answer: {
        grounding: 'Quick actions',
        message:
          count > 0
            ? `Yes, you have ${count} completed ${pluralizeTask(count)}.`
            : 'No, you don’t have any completed tasks.',
        type: 'answer',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  if (priority) {
    const priorityActions = listQuickActionsByStatus(
      'suggested',
      context.dateRange,
      context,
    ).filter((action) => action.priority === priority)

    const priorityLabel = `${priority} priority`
    const displayPriorityLabel = `${priority[0].toUpperCase()}${priority.slice(
      1,
    )} priority`
    const isCountQuery = /\bhow many|count|number of\b/.test(query)

    return {
      answer: {
        grounding: `Quick actions: ${priorityLabel}`,
        message: isCountQuery
          ? `You have ${priorityActions.length} ${priorityLabel} ${pluralizeTask(
              priorityActions.length,
            )}.`
          : priorityActions.length
            ? `${displayPriorityLabel}: ${priorityActions
                .map((action) => action.title)
                .join(', ')}.`
            : `You don’t have any ${priorityLabel} tasks.`,
        type: 'answer',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  if (query.includes('urgent')) {
    const highPriorityActions = listQuickActionsByStatus(
      'suggested',
      context.dateRange,
      context,
    ).filter((action) => action.priority === 'high')

    if (!highPriorityActions.length) {
      return undefined
    }

    return {
      answer: {
        grounding: 'Quick actions: high priority',
        message: `High priority: ${highPriorityActions
          .map((action) => action.title)
          .join(', ')}.`,
        type: 'answer',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  const actions = query.includes('follow up')
    ? listQuickActionsByStatus('suggested', context.dateRange, context).filter(
        (action) => action.reason === 'No response received yet.',
      )
    : searchQuickActions(query, context.dateRange, context)

  if (!actions.length) {
    return undefined
  }

  const dueAction = actions.find((action) => action.dueDate)

  if (query.includes('due') && dueAction) {
    return {
      answer: {
        grounding: `Task: ${dueAction.title}`,
        message: `${dueAction.title} is due ${dueAction.dueDate}.`,
        type: 'answer',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  if (query.includes('follow up')) {
    return {
      answer: {
        grounding: 'Quick actions: follow-ups',
        message: `You need to follow up with ${actions
          .map(formatFollowUpTarget)
          .join('; ')}.`,
        type: 'answer',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  if (isTaskLikeQuery(query)) {
    const activeActions = actions.filter((action) => action.status === 'suggested')

    return {
      answer: {
        grounding: 'Quick actions',
        message: activeActions.length
          ? `In the selected date range, I found ${activeActions.length} matching ${pluralizeTask(
              activeActions.length,
            )}: ${activeActions
              .slice(0, 5)
              .map((action) => action.title)
              .join(', ')}${activeActions.length > 5 ? `, and ${activeActions.length - 5} more` : ''}.`
          : noDataAnswer.message,
        type: activeActions.length ? 'answer' : 'no-data',
      },
      memory: remember(memory, 'quick_actions'),
    }
  }

  return undefined
}

const priorityRank: Record<ActionItem['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function sortActionsByPriority(actions: ActionItem[]) {
  return [...actions].sort(
    (firstAction, secondAction) =>
      priorityRank[firstAction.priority] - priorityRank[secondAction.priority],
  )
}

function answerConversationQuestion(
  query: string,
  understanding: QueryUnderstanding,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  const threadFromMemory = memory.threadContext
    ? getConversationDetails(memory.threadContext.conversationId, context.dateRange, context)
    : undefined

  if (threadFromMemory && isConversationFollowUp(query, understanding)) {
    return answerThreadFollowUp(query, understanding, threadFromMemory, memory)
  }

  if (understanding.personName && isResponseQuestion(query)) {
    const taskResponse = answerUnansweredFollowUp(
      query,
      understanding,
      context,
      memory,
    )

    if (taskResponse) {
      return taskResponse
    }

    const responseMatches = trackResponseFromPerson(
      understanding.personName,
      understanding.topicTerms,
      context.dateRange,
      context,
    )

    if (responseMatches.length === 1) {
      return answerTrackedResponse(
        query,
        understanding,
        responseMatches[0],
        memory,
      )
    }

    if (responseMatches.length > 1) {
      return createClarification(
        query,
        responseMatches.map(({ thread }) => ({
          domain: 'conversations',
          id: thread.id,
          label: thread.subject,
        })),
        memory,
      )
    }

    return undefined
  }

  if (isDecisionQuestion(query) && !understanding.topicTerms.length) {
    const threads = filterThreadsByDateRange(context.threads, context.dateRange)

    if (threads.length > 1) {
      return createClarification(
        query,
        threads.map((thread) => ({
          domain: 'conversations',
          id: thread.id,
          label: thread.subject,
        })),
        memory,
      )
    }
  }

  if (query.includes('anyone') && isResponseQuestion(query)) {
    const message = searchConversationMessages(
      understanding.topicTerms.join(' '),
      context.dateRange,
      context,
    ).find((match) => match.email.direction === 'inbound')

    if (!message) {
      return {
        answer: {
          grounding: 'Processed conversations',
          message: `Based on processed conversations, I don’t see anyone providing ${formatTopicLabel(
            understanding.topicTerms,
          )}.`,
          type: 'answer',
        },
        memory: remember(memory, 'conversations'),
      }
    }

    return answerMessageMatch(message, memory)
  }

  const threads = searchConversations(query, context.dateRange, context)

  if (!threads.length) {
    return undefined
  }

  if (isDecisionQuestion(query) && threads.length > 1 && understanding.topicTerms.length < 2) {
    return createClarification(
      query,
      threads.map((thread) => ({
        domain: 'conversations',
        id: thread.id,
        label: thread.subject,
      })),
      memory,
    )
  }

  if (!isLikelyConversationQuery(query, understanding)) {
    const bestScore = scoreText(getThreadSearchText(threads[0]), understanding.terms)

    if (bestScore < Math.min(2, understanding.terms.length)) {
      return undefined
    }
  }

  if (threads.length > 1 && shouldClarifyConversation(query, threads)) {
    return createClarification(
      query,
      threads.map((thread) => ({
        domain: 'conversations',
        id: thread.id,
        label: thread.subject,
      })),
      memory,
    )
  }

  const thread = chooseBestThread(threads, understanding)

  if (isDecisionQuestion(query)) {
    return {
      answer: {
        grounding: `Conversation: ${thread.subject}`,
        message: detectOutcome(thread, understanding.topicTerms),
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: thread.id,
          subject: thread.subject,
        },
      }),
    }
  }

  if (isConversationStatusQuestion(query)) {
    return {
      answer: {
        grounding: `Conversation: ${thread.subject}`,
        message: describeConversationStatus(thread),
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: thread.id,
          subject: thread.subject,
        },
      }),
    }
  }

  if (query.includes('need') && query.includes('reply')) {
    const needingReply = filterThreadsByDateRange(
      context.threads,
      context.dateRange,
    ).filter((candidate) => candidate.needsReply)

    if (!needingReply.length) {
      return undefined
    }

    return {
      answer: {
        grounding: 'Conversations',
        message: `Needs reply: ${needingReply
          .map((candidate) => candidate.subject)
          .join(', ')}.`,
        type: 'answer',
      },
      memory: remember(memory, 'conversations'),
    }
  }

  return {
    answer: {
      grounding: `Conversation: ${thread.subject}`,
      message: `${thread.subject}: ${thread.shortSummary}`,
      type: 'answer',
    },
    memory: remember(memory, 'conversations', {
      threadContext: {
        conversationId: thread.id,
        subject: thread.subject,
      },
    }),
  }
}

function answerOrderQuestion(
  query: string,
  understanding: QueryUnderstanding,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  const scopedQuery = [
    query,
    ...understanding.merchantNames,
    ...understanding.orderNumbers,
  ].join(' ')
  let orders = searchOrderUpdates(scopedQuery, context.dateRange, context)

  if (understanding.merchantNames.length) {
    orders = filterOrdersByMerchant(orders, understanding.merchantNames)
  }

  if (understanding.orderNumbers.length) {
    orders = orders.filter((order) =>
      understanding.orderNumbers.some((orderNumber) =>
        normalize(order.orderNumber).includes(normalize(orderNumber)),
      ),
    )
  }

  if (understanding.orderDate) {
    orders = orders.filter((order) =>
      order.orderDate.startsWith(understanding.orderDate ?? ''),
    )
  }

  if (
    !understanding.orderNumbers.length &&
    !understanding.orderDate &&
    memory.orderContext &&
    isOrderDetailFollowUp(query)
  ) {
    orders = orders.filter((order) => order.id === memory.orderContext?.orderId)
  }

  if (understanding.merchantNames.length && !understanding.orderNumbers.length) {
    orders = sortOrdersByMostRecent(orders)
  }

  if (!orders.length) {
    return undefined
  }

  if (orders.length > 1 && !understanding.merchantNames.length && !understanding.orderNumbers.length) {
    return createClarification(
      query,
      orders.map((order) => ({
        domain: 'order_updates',
        id: order.id,
        label: `${order.merchantName} #${order.orderNumber}`,
      })),
      memory,
    )
  }

  const order = orders[0]

  return {
    answer: {
      grounding: `Order: ${order.merchantName} #${order.orderNumber}`,
      message: createOrderAnswer(query, order),
      type: 'answer',
    },
    memory: remember(memory, 'order_updates', {
      orderContext: {
        merchantName: order.merchantName,
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    }),
  }
}

function sortOrdersByMostRecent(orders: OrderUpdate[]) {
  return [...orders].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder.orderDate).getTime() -
      new Date(firstOrder.orderDate).getTime(),
  )
}

function answerSpendQuestion(
  query: string,
  understanding: QueryUnderstanding,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult {
  if (isTopSpendMonthQuery(query)) {
    return answerTopSpendMonthQuestion(query, context, memory)
  }

  if (isUnresolvedCategorySpendQuery(query, understanding)) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, undefined),
    }
  }

  const spendDateRange = getSpendDateRange(query, context)
  const merchantNames = understanding.merchantNames.length
    ? understanding.merchantNames
    : memory.spendContext?.merchantNames ?? []
  const refundTotal = query.includes('refund')
    ? calculateRefundTotals(merchantNames, spendDateRange, context)
    : undefined
  const totalSpend = calculateMerchantSpend(merchantNames, spendDateRange, context)
  const amount = refundTotal ?? totalSpend

  if (amount === 0) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, undefined),
    }
  }

  const merchantLabel = merchantNames.join(', ')
  const rangeLabel = getSpendRangeLabel(query, spendDateRange)
  const includedOrders = filterOrdersByMerchant(
    filterOrdersByDateRange(context.orders, spendDateRange),
    merchantNames,
  )
  const includedMerchants = dedupe(includedOrders.map((order) => order.merchantName))
  const includedSummary = includedOrders.length
    ? ` Included merchants: ${includedMerchants.join(', ')}.`
    : ''

  return {
    answer: {
      grounding: merchantLabel
        ? `Merchant: ${merchantLabel}`
        : 'Order totals',
      message: refundTotal !== undefined
        ? `You received ${formatCurrency(amount)} in refunds ${
            merchantLabel ? `from ${merchantLabel} ` : ''
          }${rangeLabel}.${includedSummary}`
        : `You spent ${formatCurrency(amount)} ${
            merchantLabel
              ? `on ${merchantLabel} `
              : ''
          }${rangeLabel}.${includedSummary}`,
      type: 'answer',
    },
    memory: remember(memory, 'spend', {
      spendContext: {
        merchantNames,
      },
    }),
  }
}

function answerTopSpendMonthQuestion(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult {
  const year = getSpendYear(query, context)
  const orders = context.orders.filter(
    (order) => order.orderDate.startsWith(`${year}-`) && order.orderTotal,
  )

  if (!orders.length) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, undefined),
    }
  }

  const monthlyTotals = new Map<
    string,
    { merchants: string[]; totalCents: number }
  >()

  for (const order of orders) {
    const month = order.orderDate.slice(0, 7)
    const current = monthlyTotals.get(month) ?? {
      merchants: [],
      totalCents: 0,
    }

    current.totalCents += Math.round((order.orderTotal ?? 0) * 100)
    current.merchants.push(order.merchantName)
    monthlyTotals.set(month, current)
  }

  const [topMonth, topSummary] = Array.from(monthlyTotals.entries()).sort(
    ([firstMonth, first], [secondMonth, second]) =>
      second.totalCents - first.totalCents ||
      firstMonth.localeCompare(secondMonth),
  )[0]

  return {
    answer: {
      grounding: 'Order totals by month',
      message: `${formatMonthName(`${topMonth}-01`)} had the highest spend in ${year} at ${formatCurrency(
        topSummary.totalCents / 100,
      )}. Included merchants: ${dedupe(topSummary.merchants).join(', ')}.`,
      type: 'answer',
    },
    memory: remember(memory, 'spend'),
  }
}

function answerUnansweredFollowUp(
  query: string,
  understanding: QueryUnderstanding,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  if (!understanding.personName) {
    return undefined
  }

  const actions = listQuickActionsByStatus('suggested', context.dateRange, context)
    .filter((action) => action.reason === 'No response received yet.')
    .filter((action) =>
      mentionsPerson(getActionSearchText(action), understanding.personName ?? ''),
    )
    .filter(
      (action) =>
        !understanding.topicTerms.length ||
        scoreText(getActionSearchText(action), understanding.topicTerms) > 0,
    )

  if (!actions.length) {
    return undefined
  }

  const action = actions[0]

  return {
    answer: {
      grounding: `Quick action: ${action.sourceSubject}`,
      message: `No, I don’t see ${formatResponseObject(query)} from ${extractPersonDisplayName(
        action,
        understanding.personName,
      )}${formatAbout(understanding.topicTerms)} yet.`,
      type: 'answer',
    },
    memory: remember(memory, 'quick_actions'),
  }
}

function answerTrackedResponse(
  query: string,
  understanding: QueryUnderstanding,
  match: ReturnType<typeof trackResponseFromPerson>[number],
  memory: AssistantMemory,
): AssistantTurnResult {
  const displayName =
    match.thread.participants.find((participant) =>
      mentionsPerson(participant, understanding.personName ?? ''),
    ) ?? understanding.personName ?? 'that person'
  const shouldValidateTopic = isInformationRequest(query)

  if (match.relevantReply) {
    return {
      answer: {
        grounding: `Conversation: ${match.thread.subject}`,
        message: `Yes, ${displayName} provided this: ${summarizeText(
          match.relevantReply.body,
        )}`,
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: match.thread.id,
          referencedPerson: displayName,
          subject: match.thread.subject,
        },
      }),
    }
  }

  if (match.latestReply && shouldValidateTopic) {
    return {
      answer: {
        grounding: `Conversation: ${match.thread.subject}`,
        message: `${displayName} has replied in the ${match.thread.subject} thread, but I don’t see ${formatResponseObject(
          query,
        )}${formatAbout(understanding.topicTerms)}.`,
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: match.thread.id,
          referencedPerson: displayName,
          subject: match.thread.subject,
        },
      }),
    }
  }

  if (match.latestReply) {
    return {
      answer: {
        grounding: `Conversation: ${match.thread.subject}`,
        message: `Yes, ${displayName} replied ${formatReplyDate(match.latestReply.date)}.`,
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: match.thread.id,
          referencedPerson: displayName,
          subject: match.thread.subject,
        },
      }),
    }
  }

  return {
    answer: {
      grounding: `Conversation: ${match.thread.subject}`,
      message: `No, I don’t see a response from ${displayName}${formatAbout(
        understanding.topicTerms,
      )} yet.`,
      type: 'answer',
    },
    memory: remember(memory, 'conversations', {
      threadContext: {
        conversationId: match.thread.id,
        referencedPerson: displayName,
        subject: match.thread.subject,
      },
    }),
  }
}

function answerThreadFollowUp(
  query: string,
  understanding: QueryUnderstanding,
  thread: EmailThread,
  memory: AssistantMemory,
): AssistantTurnResult {
  if (query.includes('latest')) {
    return {
      answer: {
        grounding: `Conversation: ${thread.subject}`,
        message: `Latest: ${formatName(thread.latestEmail.sender)} said ${summarizeText(
          thread.latestEmail.body,
        )}`,
        type: 'answer',
      },
      memory: remember(memory, 'conversations', {
        threadContext: {
          conversationId: thread.id,
          referencedPerson: formatName(thread.latestEmail.sender),
          subject: thread.subject,
        },
      }),
    }
  }

  if (query.includes('who else responded')) {
    const senders = dedupe(
      thread.emails
        .filter((email) => email.direction === 'inbound')
        .map((email) => formatName(email.sender)),
    )

    return {
      answer: {
        grounding: `Conversation: ${thread.subject}`,
        message: senders.length ? `${senders.join(', ')} responded.` : noDataAnswer.message,
        type: senders.length ? 'answer' : 'no-data',
      },
      memory: remember(memory, 'conversations'),
    }
  }

  const personName =
    understanding.personName ?? memory.threadContext?.referencedPerson
  const message = personName
    ? findLatestInboundFromPerson(thread, personName)
    : undefined

  if (!message) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, 'conversations'),
    }
  }

  return {
    answer: {
      grounding: `Conversation: ${thread.subject}`,
      message: `${formatName(message.sender)} said: ${summarizeText(message.body)}`,
      type: 'answer',
    },
    memory: remember(memory, 'conversations', {
      threadContext: {
        conversationId: thread.id,
        referencedPerson: formatName(message.sender),
        subject: thread.subject,
      },
    }),
  }
}

function answerMessageMatch(
  match: ConversationMessageMatch,
  memory: AssistantMemory,
): AssistantTurnResult {
  return {
    answer: {
      grounding: `Conversation: ${match.thread.subject}`,
      message: `${formatName(match.email.sender)} said: ${summarizeText(match.email.body)}`,
      type: 'answer',
    },
    memory: remember(memory, 'conversations', {
      threadContext: {
        conversationId: match.thread.id,
        referencedPerson: formatName(match.email.sender),
        subject: match.thread.subject,
      },
    }),
  }
}

function resolveClarification(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
): AssistantTurnResult | undefined {
  if (!memory.clarification) {
    return undefined
  }

  const candidate = memory.clarification.candidates.find((item) =>
    normalize(item.label).includes(stripLeadingArticle(query)),
  )

  if (!candidate) {
    return undefined
  }

  if (candidate.domain === 'conversations') {
    const thread = getConversationDetails(candidate.id, context.dateRange, context)

    if (!thread) {
      return {
        answer: noDataAnswer,
        memory: remember(memory, undefined),
      }
    }

    return answerConversationQuestion(
      memory.clarification.originalQuery,
      understandQuery(memory.clarification.originalQuery, context, memory),
      {
        ...context,
        threads: [thread],
      },
      remember(memory, undefined),
    )
  }

  if (candidate.domain === 'order_updates') {
    const order = getOrderDetails(candidate.id, context.dateRange, context)

    if (!order) {
      return {
        answer: noDataAnswer,
        memory: remember(memory, undefined),
      }
    }

    return {
      answer: {
        grounding: `Order: ${order.merchantName} #${order.orderNumber}`,
        message: createOrderAnswer(memory.clarification.originalQuery, order),
        type: 'answer',
      },
      memory: remember(memory, 'order_updates', {
        orderContext: {
          merchantName: order.merchantName,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      }),
    }
  }

  const action = getQuickActionDetails(candidate.id, context.dateRange, context)

  if (!action) {
    return {
      answer: noDataAnswer,
      memory: remember(memory, undefined),
    }
  }

  return {
    answer: {
      grounding: `Quick action: ${action.sourceSubject}`,
      message: `${action.title}${action.dueDate ? ` is due ${action.dueDate}` : ''}.`,
      type: 'answer',
    },
    memory: remember(memory, 'quick_actions'),
  }
}

function understandQuery(
  query: string,
  context: AssistantContext,
  memory: AssistantMemory,
): QueryUnderstanding {
  const terms = getMeaningfulTerms(query)
  const personName = findPersonMention(query, context, memory)
  const merchantNames = extractMerchantNames(query, context.orders, memory)
  const orderDate = extractOrderDate(query, context)
  const orderNumbers = extractOrderNumbers(query)
  const topicTerms = terms.filter((term) =>
    ![
      ...normalize(personName ?? '').split(' '),
      ...merchantNames.flatMap((merchant) => normalize(merchant).split(' ')),
      ...orderNumbers.map(normalize),
      'anyone',
      'email',
      'gave',
      'given',
      'provided',
      'confirmed',
      'estimated',
      'sent',
      'response',
      'decide',
      'decided',
      'decision',
      'finalized',
      'finalised',
    ].includes(term),
  )
  const domains = identifyLikelyDomains(query, {
    merchantNames,
    orderNumbers,
    personName,
    terms,
    topicTerms,
  }, memory)

  return {
    domains,
    merchantNames,
    orderDate,
    orderNumbers,
    personName,
    terms,
    topicTerms,
  }
}

function identifyLikelyDomains(
  query: string,
  partial: Omit<QueryUnderstanding, 'domains'>,
  memory: AssistantMemory,
): AssistantDomain[] {
  const domains: AssistantDomain[] = []

  if (memory.orderContext && isOrderDetailFollowUp(query)) {
    domains.push('order_updates')
  }

  if (isSpendQuery(query)) {
    domains.push('spend')
  }

  if (isTaskLikeQuery(query)) {
    domains.push('quick_actions')
  }

  if (
    partial.merchantNames.length ||
    partial.orderNumbers.length ||
    /\border|delivered|shipping|shipped|tracking|refund|replaced|pickup\b/.test(query)
  ) {
    domains.push('order_updates')
  }

  if (
    partial.personName ||
    /\bconversation|thread|reply|respond|replied|finalized|finalised|decided|latest|said|restaurant|outing\b/.test(query)
  ) {
    domains.push('conversations')
  }

  if (memory.lastSuccessfulDomain) {
    domains.push(memory.lastSuccessfulDomain)
  }

  domains.push('quick_actions', 'conversations', 'order_updates')

  return dedupe(domains) as AssistantDomain[]
}

function createClarification(
  query: string,
  candidates: ClarificationCandidate[],
  memory: AssistantMemory,
): AssistantTurnResult {
  return {
    answer: {
      message: `Do you mean ${candidates
        .slice(0, 4)
        .map((candidate) => candidate.label)
        .join(' or ')}?`,
      type: 'clarification',
    },
    memory: {
      ...remember(memory, undefined),
      clarification: {
        candidates,
        originalQuery: query,
      },
    },
  }
}

function createOrderAnswer(query: string, order: OrderUpdate) {
  if (query.includes('tracking')) {
    return order.trackingNumber
      ? `Tracking number for ${order.merchantName} order #${order.orderNumber} is ${order.trackingNumber}.`
      : `I didn’t find a tracking number for ${order.merchantName} order #${order.orderNumber}.`
  }

  if (query.includes('replaced') && query.includes('refund')) {
    const replacements = order.replacedItems?.length
      ? `Replacements: ${order.replacedItems
          .map((item) => `${item.originalItem} were replaced with ${item.replacementItem}`)
          .join(', ')}.`
      : 'No replacements found.'
    const refunds = order.refundedItems?.length
      ? ` Refunds: ${order.refundedItems
          .map((item) => `${item.name} (${formatCurrency(item.amount)})`)
          .join(', ')}.`
      : ' No refunds found.'

    return `${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)}: ${replacements}${refunds}`
  }

  if (query.includes('refund')) {
    return order.refundedItems?.length
      ? `${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)} had refunds for ${order.refundedItems
          .map((item) => `${item.name} (${formatCurrency(item.amount)})`)
          .join(', ')}.`
      : `I didn’t find any refunds for the ${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)}.`
  }

  if (query.includes('replaced')) {
    return order.replacedItems?.length
      ? `${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)} had replacements: ${order.replacedItems
          .map((item) => `${item.originalItem} were replaced with ${item.replacementItem}`)
          .join(', ')}.`
      : `I didn’t find any replacements for the ${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)}.`
  }

  return `${order.merchantName} order placed on ${formatOrderPlacedDate(order.orderDate)} is ${formatStatus(
    order.status,
  )}.`
}

function formatOrderPlacedDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function detectOutcome(thread: EmailThread, topicTerms: string[]) {
  const proposal = findProposal(thread, topicTerms)
  const decision = findDecisionText(thread, topicTerms)
  const pendingAsk = findPendingAsk(thread, topicTerms)

  if (decision) {
    return decision
  }

  if (proposal) {
    return `${proposal} It still needs confirmation.`
  }

  if (pendingAsk) {
    return `It still needs confirmation. ${pendingAsk}`
  }

  return 'It looks like the decision is still in progress.'
}

function describeConversationStatus(thread: EmailThread) {
  const proposal = findProposal(thread, [])
  const pendingAsk = findPendingAsk(thread)
  const latestSender = formatName(thread.latestEmail.sender)
  const status = pendingAsk
    ? `${proposal ? `${proposal} ` : ''}It still needs confirmation. ${pendingAsk}`
    : thread.shortSummary
  const pending = thread.needsReply
    ? ` The latest message from ${latestSender} needs a reply.`
    : ''

  return `${thread.subject}: ${status}${pending}`
}

function findLatestInboundFromPerson(thread: EmailThread, personName: string) {
  return [...thread.emails]
    .reverse()
    .find(
      (email) =>
        email.direction === 'inbound' && mentionsPerson(email.sender, personName),
    )
}

function findRelevantInboundFromPerson(
  thread: EmailThread,
  personName: string,
  topicTerms: string[],
) {
  if (!topicTerms.length) {
    return undefined
  }

  return [...thread.emails]
    .reverse()
    .find(
      (email) =>
        email.direction === 'inbound' &&
        mentionsPerson(email.sender, personName) &&
        scoreText(email.body, topicTerms) > 0,
    )
}

function findDecisionText(thread: EmailThread, topicTerms: string[]) {
  const expandedTopicTerms = expandTopicTerms(topicTerms)
  const decisionSignals = [
    /(?:let us|let's)\s+go with\s+([^.!?]+)/i,
    /(?:we decided|decided|agreed|confirmed|finalized|finalised|booked)\s+([^.!?]+)/i,
    /that works[^.!?]*/i,
  ]
  const candidates = [
    ...thread.detailedSummaryBullets,
    ...thread.emails.map((email) => email.body),
  ]

  for (const candidate of candidates) {
    if (expandedTopicTerms.length && scoreText(candidate, expandedTopicTerms) === 0) {
      continue
    }

    const matchedSignal = decisionSignals.find((signal) => signal.test(candidate))

    if (matchedSignal) {
      return summarizeText(candidate)
    }
  }

  return undefined
}

function findProposal(thread: EmailThread, topicTerms: string[]) {
  const expandedTopicTerms = expandTopicTerms(topicTerms)
  const proposalPatterns = [
    /(?:they can hold|can hold)\s+([^.!?]+)/i,
    /([^.!?]+\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)[^.!?]*)/i,
    /(?:leaning toward|proposed|proposal is|option is)\s+([^.!?]+)/i,
  ]
  const candidates = [
    ...thread.emails.map((email) => email.body),
    thread.shortSummary,
    ...thread.detailedSummaryBullets,
  ]

  for (const candidate of candidates) {
    if (expandedTopicTerms.length && scoreText(candidate, expandedTopicTerms) === 0) {
      continue
    }

    const matchedPattern = proposalPatterns.find((pattern) => pattern.test(candidate))
    const proposal = matchedPattern?.exec(candidate)?.[0]

    if (proposal) {
      return summarizeText(proposal)
    }
  }

  return undefined
}

function findPendingAsk(thread: EmailThread, topicTerms: string[] = []) {
  const latestSent = [...thread.emails]
    .reverse()
    .find((email) => email.direction === 'sent')

  if (!latestSent) {
    return undefined
  }

  const questionClauses = latestSent.body.includes('?')
    ? latestSent.body
        .split('?')
        .map((clause) => clause.trim())
        .filter(Boolean)
        .map((clause) => `${clause.split(/[.!]\s+/).pop() ?? clause}?`)
    : [latestSent.body]
  const expandedTopicTerms = expandTopicTerms(topicTerms)
  const askMatches = questionClauses.flatMap((clause) => {
    const askMatch = clause.match(/(?:can|could|please)\s+(.+?)(?:\?|$)/i)

    return askMatch ? [{ ask: askMatch[1].trim(), clause }] : []
  })
  const selectedAsk = expandedTopicTerms.length
    ? askMatches.find(({ clause }) => scoreText(clause, expandedTopicTerms) > 0)
    : askMatches[0]

  if (!selectedAsk) {
    return undefined
  }

  const recipient = formatName(latestSent.recipients?.[0] ?? 'the recipient')
  const ask = selectedAsk.ask.replace(/^you\s+/i, '')

  if (/^someone\s+/i.test(ask)) {
    return `${ask.charAt(0).toUpperCase()}${ask.slice(1)}.`
  }

  return `${recipient} needs to ${ask}.`
}

function chooseBestThread(threads: EmailThread[], understanding: QueryUnderstanding) {
  return [...threads].sort(
    (first, second) =>
      scoreThreadForTopic(second, understanding.topicTerms) -
      scoreThreadForTopic(first, understanding.topicTerms),
  )[0]
}

function scoreThreadForTopic(thread: EmailThread, topicTerms: string[]) {
  const expandedTerms = expandTopicTerms(topicTerms)
  return scoreText(getThreadSearchText(thread), expandedTerms)
}

function shouldClarifyConversation(query: string, threads: EmailThread[]) {
  if (isDecisionQuestion(query)) {
    return false
  }

  return threads.length > 1 && getMeaningfulTerms(query).length < 3
}

function filterActionsByDateRange(
  actions: ActionItem[],
  emails: Email[],
  dateRange: AssistantDateRange | undefined,
) {
  if (!dateRange) {
    return actions
  }

  const emailIds = new Set(
    emails
      .filter((email) => isWithinDateRange(email.date, dateRange))
      .map((email) => email.id),
  )

  return actions.filter((action) => emailIds.has(action.emailId))
}

function filterThreadsByDateRange(
  threads: EmailThread[],
  dateRange: AssistantDateRange | undefined,
) {
  if (!dateRange) {
    return threads
  }

  return threads.filter((thread) =>
    thread.emails.some((email) => isWithinDateRange(email.date, dateRange)),
  )
}

function filterOrdersByDateRange(
  orders: OrderUpdate[],
  dateRange: AssistantDateRange | undefined,
) {
  if (!dateRange) {
    return orders
  }

  return orders.filter((order) => isWithinDateRange(order.orderDate, dateRange))
}

function filterOrdersByMerchant(orders: OrderUpdate[], merchantNames: string[]) {
  if (!merchantNames.length) {
    return orders
  }

  return orders.filter((order) =>
    merchantNames.some((merchant) =>
      normalize(order.merchantName).includes(normalize(merchant)),
    ),
  )
}

function isWithinDateRange(value: string, dateRange: AssistantDateRange) {
  const time = new Date(value).getTime()
  return (
    time >= new Date(`${dateRange.startDate}T00:00:00.000`).getTime() &&
    time <= new Date(`${dateRange.endDate}T23:59:59.999`).getTime()
  )
}

function findPersonMention(
  query: string,
  context: AssistantContext,
  memory?: AssistantMemory,
) {
  const explicitName = query.match(
    /(?:has|did|from|about|what about|did)\s+([a-z][a-z\s]+?)\s+(?:respond|reply|replied|sent|given|provided|confirmed|estimated|say|said)/,
  )?.[1]

  if (explicitName) {
    return titleCase(explicitName)
  }

  if (/\bshe\b|\bhe\b|\bthey\b/.test(query)) {
    return memory?.threadContext?.referencedPerson
  }

  return getKnownPeople(context).find((person) =>
    normalize(person)
      .split(' ')
      .filter((term) => term.length > 2)
      .some((term) => normalize(query).includes(term)),
  )
}

function getKnownPeople(context: AssistantContext) {
  return dedupe([
    ...context.threads.flatMap((thread) => thread.participants),
    ...context.emails.flatMap((email) => [
      email.sender,
      ...(email.recipients ?? []),
    ]),
    ...context.actions.flatMap((action) => [
      action.sourceSender,
      action.title.match(/^follow up with (.+?) about/i)?.[1] ?? '',
    ]),
  ])
    .map(formatName)
    .filter((person) => person && normalize(person) !== 'me')
}

function extractMerchantNames(
  query: string,
  orders: OrderUpdate[],
  memory: AssistantMemory,
) {
  const normalizedQuery = normalize(query)
  const merchants = dedupe(
    orders
      .filter((order) => {
        const merchantName = normalize(order.merchantName)
        const terms = merchantName.split(' ').filter((term) => term.length > 2)

        return (
          normalizedQuery.includes(merchantName) ||
          terms.some((term) => normalizedQuery.includes(term))
        )
      })
      .map((order) => order.merchantName),
  )

  if (!merchants.length && /\b(it|that|this|one)\b/.test(query) && memory.orderContext) {
    return [memory.orderContext.merchantName]
  }

  return merchants
}

function extractOrderDate(query: string, context: AssistantContext) {
  const normalizedQuery = normalize(query)
  const monthMatch = normalizedQuery.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(20\d{2}))?\b/,
  )

  if (!monthMatch) {
    return undefined
  }

  const monthIndex = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(monthMatch[1])
  const day = Number(monthMatch[2])
  const year = monthMatch[3] ?? getLatestOrderDate(context.orders)?.slice(0, 4)

  if (monthIndex < 0 || !day || !year) {
    return undefined
  }

  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractOrderNumbers(query: string) {
  return query
    .match(/\b[A-Z]{1,4}-?\d{3,}|\b\d{3}-\d{7}-\d{7}\b/gi)
    ?.map((value) => value.toUpperCase()) ?? []
}

function normalizeMerchantNames(merchantNames: string[] | string | undefined) {
  if (!merchantNames) {
    return []
  }

  return Array.isArray(merchantNames) ? merchantNames : [merchantNames]
}

function rankMatches<T>(items: T[], terms: string[], getText: (item: T) => string) {
  return items
    .map((item) => ({
      item,
      score: scoreText(getText(item), terms),
    }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item)
}

function scoreText(value: string, terms: string[]) {
  const tokens = new Set(normalize(value).split(' ').map(singularize))
  return terms.map(singularize).filter((term) => tokens.has(term)).length
}

function getMeaningfulTerms(query: string) {
  return normalize(query)
    .split(' ')
    .filter((term) => term.length > 2)
    .filter(
      (term) =>
        ![
          'and',
          'any',
          'are',
          'about',
          'did',
          'does',
          'for',
          'from',
          'has',
          'have',
          'how',
          'much',
          'need',
          'order',
          'reply',
          'respond',
          'responded',
          'replied',
          'status',
          'the',
          'there',
          'this',
          'today',
          'was',
          'what',
          'when',
          'where',
          'which',
          'with',
          'list',
        ].includes(term),
    )
    .map(singularize)
}

function expandTopicTerms(topicTerms: string[]) {
  const expansions: Record<string, string[]> = {
    restaurant: ['restaurant', 'reservation', 'dinner', 'table'],
    outing: ['outing'],
  }

  return dedupe(topicTerms.flatMap((term) => expansions[term] ?? [term]))
}

function getActionSearchText(action: ActionItem) {
  return `${action.priority} priority ${action.title} ${action.sourceSubject} ${action.sourceSnippet} ${
    action.reason
  } ${action.dueDate ?? ''}`
}

function getThreadSearchText(thread: EmailThread) {
  return [
    thread.subject,
    thread.shortSummary,
    ...thread.participants,
    ...thread.detailedSummaryBullets,
    ...thread.emails.map((email) => `${email.sender} ${email.subject} ${email.body}`),
  ].join(' ')
}

function getOrderSearchText(order: OrderUpdate, context: AssistantContext) {
  const sourceEmails = context.emails.filter((email) =>
    order.relatedEmailIds.includes(email.id),
  )

  return [
    order.merchantName,
    order.orderNumber,
    order.status,
    order.deliveryStatus ?? '',
    order.trackingNumber ?? '',
    ...(order.items?.map((item) => item.name) ?? []),
    ...(order.refundedItems?.map((item) => item.name) ?? []),
    ...(order.replacedItems?.flatMap((item) => [
      item.originalItem,
      item.replacementItem,
    ]) ?? []),
    ...sourceEmails.map((email) => `${email.sender} ${email.subject} ${email.body}`),
  ].join(' ')
}

function isSpendQuery(query: string) {
  return /\bspend|spent|cost|total|how much|refund total\b/.test(query)
}

function isOrderDetailFollowUp(query: string) {
  return /\b(refund|refunded|replaced|replacement|tracking|delivered|delivery|shipped|shipping|pickup|anything)\b/.test(query)
}

function getPriorityMention(query: string): ActionItem['priority'] | undefined {
  if (/\bhigh priority\b/.test(query)) {
    return 'high'
  }

  if (/\bmedium priority\b/.test(query)) {
    return 'medium'
  }

  if (/\blow priority\b/.test(query)) {
    return 'low'
  }

  return undefined
}

function isTopSpendMonthQuery(query: string) {
  return (
    /\bwhich month\b/.test(query) &&
    /\bspend|spent\b/.test(query) &&
    /\bmost|highest|largest|biggest\b/.test(query)
  )
}

function isUnresolvedCategorySpendQuery(
  query: string,
  understanding: QueryUnderstanding,
) {
  return (
    /\bspend|spent|cost|total|how much\b/.test(query) &&
    /\bon\s+[a-z][a-z\s-]+/.test(query) &&
    !understanding.merchantNames.length
  )
}

function isTaskLikeQuery(query: string) {
  return /\btask|quick action|urgent|priority|due|need to do|follow up|form|permission|renew|submit|complete\b/.test(query)
}

function isResponseQuestion(query: string) {
  return /\brespond|reply|replied|sent|given|provided|confirmed|estimated|estimate|quote\b/.test(query)
}

function isInformationRequest(query: string) {
  return /\bsent|given|provided|confirmed|estimated|estimate|quote\b/.test(query)
}

function isDecisionQuestion(query: string) {
  return /\bfinalized|finalised|decided|decision|what did we decide\b/.test(query)
}

function isConversationFollowUp(query: string, understanding: QueryUnderstanding) {
  return (
    query.includes('latest') ||
    query.includes('what did') ||
    query.includes('what about') ||
    query.includes('who else responded') ||
    Boolean(understanding.personName)
  )
}

function isConversationStatusQuestion(query: string) {
  return /\bstatus|where do things stand|what needs to be done|next step|next steps\b/.test(query)
}

function isLikelyConversationQuery(
  query: string,
  understanding: QueryUnderstanding,
) {
  return (
    Boolean(understanding.personName) ||
    /\bconversation|thread|reply|respond|replied|finalized|finalised|decided|latest|said|restaurant|outing|dinner\b/.test(query)
  )
}

function looksLikeUnsupportedCreativeRequest(query: string) {
  return /\bwrite|draft|compose|poem|story|joke|summarize this text\b/.test(query)
}

function looksLikeStructuredQuestion(
  query: string,
  understanding: QueryUnderstanding,
) {
  return (
    Boolean(understanding.personName) ||
    understanding.merchantNames.length > 0 ||
    understanding.orderNumbers.length > 0 ||
    /\bemail|message|invoice|receipt|delivery|appointment|task|thread|conversation\b/.test(query)
  )
}

function mentionsPerson(value: string, personName: string) {
  const tokens = new Set(normalize(value).split(' '))

  return normalize(personName)
    .split(' ')
    .filter((term) => term.length > 2)
    .some((term) => tokens.has(term))
}

function formatFollowUpTarget(action: ActionItem) {
  return action.title.replace(/^follow up with /i, '').replace(/^follow up on /i, '')
}

function extractPersonDisplayName(action: ActionItem, personName: string) {
  return action.title.match(/^follow up with (.+?) about/i)?.[1] ?? personName
}

function formatResponseObject(query: string) {
  if (query.includes('estimate')) {
    return 'an estimate'
  }

  if (query.includes('quote')) {
    return 'a quote'
  }

  if (query.includes('confirmation') || query.includes('confirmed')) {
    return 'a confirmation'
  }

  return 'a response'
}

function formatAbout(topicTerms: string[]) {
  const label = formatTopicLabel(topicTerms)
  return label ? ` about ${label}` : ''
}

function formatTopicLabel(topicTerms: string[]) {
  return topicTerms
    .filter(
      (term) =>
        ![
          'anyone',
          'email',
          'gave',
          'given',
          'provided',
          'confirmed',
          'estimated',
          'sent',
        ].includes(term),
    )
    .join(' ')
}

function remember(
  memory: AssistantMemory,
  domain: AssistantDomain | undefined,
  nextMemory: Partial<AssistantMemory> = {},
): AssistantMemory {
  return {
    lastSuccessfulDomain: domain ?? memory.lastSuccessfulDomain,
    orderContext: nextMemory.orderContext ?? memory.orderContext,
    recentTurns: nextMemory.recentTurns ?? memory.recentTurns,
    spendContext: nextMemory.spendContext ?? memory.spendContext,
    threadContext: nextMemory.threadContext ?? memory.threadContext,
  }
}

export function recordAssistantTurn(
  query: string,
  answer: AssistantAnswer,
  memory: AssistantMemory,
): AssistantMemory {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return memory
  }

  const recentTurn: AssistantRecentTurn = {
    answer: answer.message,
    domain: answer.type === 'answer' ? memory.lastSuccessfulDomain : undefined,
    entities: {
      category: memory.spendContext?.category,
      conversationId: memory.threadContext?.conversationId,
      merchantName: memory.orderContext?.merchantName,
      orderId: memory.orderContext?.orderId,
      orderNumber: memory.orderContext?.orderNumber,
      personName: memory.threadContext?.referencedPerson,
      subject: memory.threadContext?.subject,
    },
    query: trimmedQuery,
    type: answer.type,
  }
  const recentTurns = [
    ...(memory.recentTurns ?? []).filter((turn) => turn.query !== trimmedQuery),
    recentTurn,
  ].slice(-5)

  return {
    ...memory,
    recentTurns,
  }
}

function formatReplyDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatName(value: string) {
  return value.replace(/\s*<[^>]+>\s*$/, '').trim()
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ')
}

function summarizeText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 140 ? `${normalized.slice(0, 137).trim()}...` : normalized
}

function pluralizeTask(count: number) {
  return count === 1 ? 'task' : 'tasks'
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function getLatestOrderDate(orders: OrderUpdate[]) {
  return orders
    .map((order) => order.orderDate)
    .sort((firstDate, secondDate) => secondDate.localeCompare(firstDate))[0]
}

function getSpendDateRange(
  query: string,
  context: AssistantContext,
): AssistantDateRange | undefined {
  const anchorDate = getSpendAnchorDate(context)

  if (query.includes('this month')) {
    return getMonthDateRange(anchorDate)
  }

  if (query.includes('last month')) {
    return getPreviousMonthDateRange(anchorDate)
  }

  return context.dateRange
}

function getSpendAnchorDate(context: AssistantContext) {
  const candidates = [
    context.dateRange?.endDate,
    getLatestOrderDate(context.orders),
  ].filter((value): value is string => Boolean(value))

  return candidates.sort((firstDate, secondDate) =>
    secondDate.localeCompare(firstDate),
  )[0]
}

function getMonthDateRange(value: string | undefined): AssistantDateRange | undefined {
  if (!value) {
    return undefined
  }

  const month = value.slice(0, 7)
  const [year, monthIndex] = month.split('-').map(Number)
  const lastDay = new Date(year, monthIndex, 0).getDate()

  return {
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
    startDate: `${month}-01`,
  }
}

function getPreviousMonthDateRange(
  value: string | undefined,
): AssistantDateRange | undefined {
  if (!value) {
    return undefined
  }

  const [year, monthIndex] = value.slice(0, 7).split('-').map(Number)
  const previousMonthDate = new Date(Date.UTC(year, monthIndex - 2, 1))

  return getMonthDateRange(previousMonthDate.toISOString().slice(0, 10))
}

function getSpendYear(query: string, context: AssistantContext) {
  const explicitYear = query.match(/\b(20\d{2})\b/)?.[1]

  if (explicitYear) {
    return explicitYear
  }

  return (context.dateRange?.endDate ?? getLatestOrderDate(context.orders)).slice(0, 4)
}

function getSpendRangeLabel(
  query: string,
  dateRange: AssistantDateRange | undefined,
) {
  if (query.includes('this month')) {
    return 'this month'
  }

  if (query.includes('last month') && dateRange) {
    return `in ${formatMonthName(dateRange.startDate)}`
  }

  return 'in this date range'
}

function formatMonthName(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`))
}

function stripLeadingArticle(value: string) {
  return value.replace(/^(the|a|an)\s+/i, '')
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function capitalize(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function isTodayTaskSummaryQuery(query: string) {
  return /\b(today|to do|need to do|tasks?|quick actions?)\b/.test(query) &&
    /\b(today|to do|need to do)\b/.test(query) &&
    !/\b(order|spend|spent|refund|delivered|delivery|conversation|thread|reply|respond)\b/.test(query)
}

function singularize(term: string) {
  if (term.endsWith('ies')) {
    return `${term.slice(0, -3)}y`
  }

  return term.endsWith('s') ? term.slice(0, -1) : term
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values))
}
