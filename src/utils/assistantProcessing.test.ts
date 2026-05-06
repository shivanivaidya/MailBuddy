import { describe, expect, it } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import {
  answerAssistantQuery,
  answerAssistantTurn,
  calculateMerchantSpend,
  calculateRefundTotals,
  searchQuickActions,
  searchConversationMessages,
  trackResponseFromPerson,
  type AssistantMemory,
} from '@/utils/assistantProcessing'
import { extractActionItems } from '@/utils/mailProcessing'
import { groupEmailsIntoThreads } from '@/utils/threadProcessing'
import {
  extractOrderUpdates,
  generateMerchantSpendSummaries,
} from '@/utils/updateProcessing'

function createContext(emails = sampleEmails) {
  const actions = extractActionItems(emails)
  const orders = extractOrderUpdates(emails)

  return {
    actions,
    dateRange: {
      endDate: '2026-05-01',
      startDate: '2026-04-27',
    },
    emails,
    merchantSpend: generateMerchantSpendSummaries(orders),
    orders,
    threads: groupEmailsIntoThreads(emails),
  }
}

describe('answerAssistantQuery', () => {
  it('answers quick action questions from structured tasks', () => {
    const context = createContext()

    expect(
      answerAssistantQuery('When is the permission slip due?', context),
    ).toMatchObject({
      grounding: 'Task: Sign and return permission slip',
      message: 'Sign and return permission slip is due friday.',
      type: 'answer',
    })
    expect(answerAssistantQuery('What is urgent?', context).message).toContain(
      'Pay upcoming bill',
    )
    expect(
      answerAssistantQuery('list the high priority quick actions', context),
    ).toMatchObject({
      grounding: 'Quick actions: high priority',
      message:
        'High priority: Pay upcoming bill, Submit registration before deadline.',
      type: 'answer',
    })

    const mediumPriorityCount = context.actions.filter(
      (action) => action.priority === 'medium' && action.status === 'suggested',
    ).length

    expect(
      answerAssistantQuery(
        'how many medium priority of quick actions are there',
        context,
      ),
    ).toMatchObject({
      grounding: 'Quick actions: medium priority',
      message: `You have ${mediumPriorityCount} medium priority ${mediumPriorityCount === 1 ? 'task' : 'tasks'}.`,
      type: 'answer',
    })
    expect(
      answerAssistantQuery('Who do I need to follow up with?', context).message,
    ).toContain('Dana Repairs about Kitchen repair estimate')
  })

  it('uses exported tool functions for deterministic lookup and math', () => {
    const context = createContext()

    expect(searchQuickActions('permission slip', context.dateRange, context)[0])
      .toMatchObject({
        title: 'Sign and return permission slip',
      })
    expect(
      calculateMerchantSpend('Whole Foods', context.dateRange, context),
    ).toBe(128.57)
    expect(
      trackResponseFromPerson('Priya', context.dateRange, context),
    ).toHaveLength(2)
    expect(searchConversationMessages('Olive House', context.dateRange, context)[0])
      .toMatchObject({
        thread: expect.objectContaining({ subject: 'Friday dinner reservation' }),
      })
    expect(calculateRefundTotals(['Instacart'], context.dateRange, context)).toBe(12.49)
  })

  it('answers response tracking and no-data cases without guessing', () => {
    const context = createContext()

    expect(
      answerAssistantQuery('Has Priya responded about team retreat?', context),
    ).toMatchObject({
      type: 'answer',
    })
    expect(
      answerAssistantQuery('Has Mary responded to my email?', context),
    ).toEqual({
      message: 'I didn’t find matching data in the selected date range.',
      type: 'no-data',
    })
  })

  it('answers natural response questions from unanswered follow-up actions', () => {
    expect(
      answerAssistantQuery(
        'Has Dana given an estimate on kitchen repairs?',
        createContext(),
      ),
    ).toMatchObject({
      grounding: 'Quick action: Kitchen repair estimate',
      message:
        'No, I don’t see an estimate from Dana Repairs about estimate kitchen repair yet.',
      type: 'answer',
    })
  })

  it('handles a person who replied but not about the requested topic', () => {
    expect(
      answerAssistantQuery('Has Priya sent the budget?', createContext()),
    ).toMatchObject({
      grounding: 'Conversation: Team retreat agenda',
      message:
        'Priya Shah has replied in the Team retreat agenda thread, but I don’t see a response about budget.',
      type: 'answer',
    })
  })

  it('answers conversation decision lookup by inspecting candidate messages', () => {
    expect(
      answerAssistantQuery(
        'Have we finalized the restaurant for the team outing?',
        createContext(),
      ),
    ).toMatchObject({
      grounding: 'Conversation: Friday dinner reservation',
      message: expect.stringContaining('It still needs confirmation.'),
      type: 'answer',
    })
    expect(
      answerAssistantQuery(
        'Have we finalized the restaurant for the team outing?',
        createContext(),
      ).message,
    ).toContain('table for six at 7 PM')
  })

  it('answers conversation status with confirmation and next action', () => {
    expect(
      answerAssistantQuery(
        'what is the status on friday dinner reservation?',
        createContext(),
      ),
    ).toMatchObject({
      grounding: 'Conversation: Friday dinner reservation',
      message: expect.stringContaining('It still needs confirmation.'),
      type: 'answer',
    })
    expect(
      answerAssistantQuery(
        'what is the status on friday dinner reservation?',
        createContext(),
      ).message,
    ).toContain('Mona Patel needs to confirm the reservation')
  })

  it('answers Portland trip status questions from the matching conversation', () => {
    expect(
      answerAssistantQuery("what's the status on the Portland trip", createContext()),
    ).toMatchObject({
      grounding: 'Conversation: Portland trip planning',
      message: expect.stringContaining('Portland trip planning:'),
      type: 'answer',
    })
    expect(
      answerAssistantQuery("what's the status on the Portland trip", createContext())
        .message,
    ).toContain('latest message from Maya Chen needs a reply')
  })

  it('returns no-data for structured questions with no matching data', () => {
    expect(
      answerAssistantQuery('Where is the invoice from River Cafe?', createContext()),
    ).toEqual({
      message: 'I didn’t find matching data in the selected date range.',
      type: 'no-data',
    })
  })

  it('answers conversation questions and stores thread follow-up memory', () => {
    const context = createContext()
    const firstTurn = answerAssistantTurn('Summarize Portland trip', context)
    const secondTurn = answerAssistantTurn(
      "What's the latest?",
      context,
      firstTurn.memory,
    )

    expect(firstTurn.answer).toMatchObject({
      grounding: 'Conversation: Portland trip planning',
      type: 'answer',
    })
    expect(secondTurn.answer).toMatchObject({
      message: expect.stringContaining('Latest: Maya Chen said'),
      type: 'answer',
    })
  })

  it('uses previous thread context for natural follow-up questions', () => {
    const context = createContext()
    const firstTurn = answerAssistantTurn('Summarize Friday dinner reservation', context)
    const secondTurn = answerAssistantTurn('What about Mona?', context, firstTurn.memory)

    expect(secondTurn.answer).toMatchObject({
      grounding: 'Conversation: Friday dinner reservation',
      message: expect.stringContaining('Mona Patel said:'),
      type: 'answer',
    })
  })

  it('asks for clarification and resolves the next turn', () => {
    const context = createContext()
    const firstTurn = answerAssistantTurn('What did we decide?', context)

    expect(firstTurn.answer).toMatchObject({
      type: 'clarification',
    })
    expect(firstTurn.answer.message).toContain('Do you mean')

    const secondTurn = answerAssistantTurn(
      'The Portland trip',
      context,
      firstTurn.memory,
    )

    expect(secondTurn.answer).toMatchObject({
      message: expect.stringContaining('Portland trip'),
      type: 'answer',
    })
  })

  it('answers order and spend questions from order updates', () => {
    const context = createContext()

    expect(
      answerAssistantQuery('Was my Whole Foods order delivered?', context).message,
    ).toContain('Whole Foods Market order placed on May 1, 2026 is out for delivery')
    const wholeFoodsTurn = answerAssistantTurn(
      'Was my Whole Foods order delivered?',
      context,
    )
    const aprilWholeFoodsTurn = answerAssistantTurn(
      'What about the one placed on April 30th?',
      context,
      wholeFoodsTurn.memory,
    )
    expect(aprilWholeFoodsTurn.answer.message).toContain(
      'Whole Foods Market order placed on April 30, 2026 is delivered',
    )
    expect(
      answerAssistantTurn(
        'Was anything replaced or refunded?',
        context,
        aprilWholeFoodsTurn.memory,
      ).answer.message,
    ).toContain(
      'Whole Foods Market order placed on April 30, 2026: Replacements: Organic strawberries were replaced with organic blueberries. No refunds found.',
    )
    expect(
      answerAssistantQuery('What is the tracking number for Amazon?', context),
    ).toMatchObject({
      message:
        'Tracking number for Amazon.com order #113-7429931-0056208 is TBA92837465.',
      type: 'answer',
    })
    expect(
      answerAssistantQuery('How much did I spend this month?', context),
    ).toMatchObject({
      message: expect.stringContaining('You spent $42.15 this month.'),
      type: 'answer',
    })
    expect(
      answerAssistantQuery('how much did I spend on shopping this month', context),
    ).toMatchObject({
      message: 'I didn’t find matching data in the selected date range.',
      type: 'no-data',
    })

    const currentMonthTurn = answerAssistantTurn(
      'how much did I spend on Whole Foods this month',
      context,
    )

    expect(
      answerAssistantTurn('what about last month', context, currentMonthTurn.memory)
        .answer,
    ).toMatchObject({
      message:
        'You spent $86.42 on Whole Foods Market in April. Included merchants: Whole Foods Market.',
      type: 'answer',
    })

    expect(
      answerAssistantQuery(
        'in this year which month did I spend the most',
        context,
      ),
    ).toMatchObject({
      grounding: 'Order totals by month',
      message:
        'April had the highest spend in 2026 at $557.52. Included merchants: Whole Foods Market, Chewy, Instacart, Sephora, Ulta Beauty, Target, Gap, Amazon.com, Etsy, Thai Garden.',
      type: 'answer',
    })
  })

  it('uses the unsupported fallback for out-of-scope requests', () => {
    expect(answerAssistantQuery('Write a poem about my inbox', createContext()))
      .toEqual({
        message:
          'I don’t support that yet. I can help with quick actions, conversations, and order updates.',
        type: 'unsupported',
      })
  })

  it('keeps a compact rolling history of the last five turns', () => {
    const context = createContext()
    const queries = [
      'What do I need to do today?',
      'Was my Whole Foods order delivered?',
      'What about the one placed on April 30th?',
      'Was anything replaced or refunded?',
      'How much did I spend this month?',
      'How much did I spend on Whole Foods this month?',
    ]
    const memory = queries.reduce<AssistantMemory>(
      (currentMemory, query) =>
        answerAssistantTurn(query, context, currentMemory).memory,
      {},
    )

    expect(memory.recentTurns).toHaveLength(5)
    expect(memory.recentTurns?.[0].query).toBe('Was my Whole Foods order delivered?')
    expect(memory.recentTurns?.at(-1)).toMatchObject({
      domain: 'spend',
      entities: {
        category: undefined,
      },
      query: 'How much did I spend on Whole Foods this month?',
      type: 'answer',
    })
  })
})
