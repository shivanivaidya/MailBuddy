import { describe, expect, it, vi } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import {
  answerAssistantWithToolPlanning,
  finalizeAssistantToolResults,
} from '@/utils/assistantToolAgent'
import { extractActionItems } from '@/utils/mailProcessing'
import { groupEmailsIntoThreads } from '@/utils/threadProcessing'
import {
  extractOrderUpdates,
  generateMerchantSpendSummaries,
} from '@/utils/updateProcessing'

function createContext() {
  const actions = extractActionItems(sampleEmails)
  const orders = extractOrderUpdates(sampleEmails)

  return {
    actions,
    dateRange: {
      endDate: '2026-05-01',
      startDate: '2026-04-27',
    },
    emails: sampleEmails,
    merchantSpend: generateMerchantSpendSummaries(orders),
    orders,
    threads: groupEmailsIntoThreads(sampleEmails),
  }
}

function createPlannerFetch(plan: unknown) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ plan }),
    ok: true,
  })
}

function createPlannerAndClassifierFetch(plan: unknown) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/assistant/plan') {
      return Promise.resolve({
        json: () => Promise.resolve({ plan }),
        ok: true,
      })
    }

    if (url === '/api/assistant/classify-spend') {
      const requestBody = JSON.parse(
        typeof init?.body === 'string' ? init.body : '{}',
      ) as { category?: string }

      return Promise.resolve({
        json: () =>
          Promise.resolve({
            classifications:
              requestBody.category === 'clothing'
                ? clothingClassifications
                : requestBody.category?.includes('beauty') ||
                    requestBody.category === 'makeup'
                  ? beautyClassifications
                  : requestBody.category === 'sports'
                    ? sportsClassifications
                : groceryClassifications,
          }),
        ok: true,
      })
    }

    return Promise.resolve({ ok: false })
  }) as unknown as typeof fetch
}

function createPlannerAndConversationAnswerFetch(
  plan: unknown,
  answer: {
    answer: string
    conversationId: string | null
    type: 'answer' | 'no-data'
  },
  onAnswerRequest?: (body: unknown) => void,
) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/assistant/plan') {
      return Promise.resolve({
        json: () => Promise.resolve({ plan }),
        ok: true,
      })
    }

    if (url === '/api/assistant/answer-conversation') {
      onAnswerRequest?.(
        JSON.parse(typeof init?.body === 'string' ? init.body : '{}'),
      )

      return Promise.resolve({
        json: () =>
          Promise.resolve({
            answer: {
              ...answer,
              reason: answer.conversationId
                ? 'Answered from the best matching candidate conversation.'
                : null,
            },
          }),
        ok: true,
      })
    }

    return Promise.resolve({ ok: false })
  }) as unknown as typeof fetch
}

const groceryClassifications = [
  {
    category: 'groceries',
    confidence: 0.98,
    include: true,
    orderId: 'order_whole-foods-market_wf-1048',
    reason: 'Whole Foods grocery items and pantry staples.',
  },
  {
    category: 'groceries',
    confidence: 0.95,
    include: true,
    orderId: 'order_instacart_ic-8831',
    reason: 'Instacart order contains groceries.',
  },
  {
    category: 'other',
    confidence: 0.96,
    include: false,
    orderId: 'order_amazon-com_113-7429931-0056208',
    reason: 'Electronics items.',
  },
  {
    category: 'other',
    confidence: 0.96,
    include: false,
    orderId: 'order_target_tg-6621',
    reason: 'Retail household items and notebook.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_etsy_et-5938',
    reason: 'Gift/home item.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_chewy_ch-7715',
    reason: 'Pet supplies.',
  },
  {
    category: 'other',
    confidence: 0.98,
    include: false,
    orderId: 'order_thai-garden_dd-4102',
    reason: 'Restaurant meal.',
  },
  {
    category: 'groceries',
    confidence: 0.96,
    include: true,
    orderId: 'order_whole-foods-market_wf-20491',
    reason: 'Whole Foods grocery pickup.',
  },
]

const clothingClassifications = [
  {
    category: 'clothing',
    confidence: 0.98,
    include: true,
    orderId: 'order_gap_gp-4482',
    reason: 'Gap order contains jeans and a cotton tee.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_whole-foods-market_wf-20491',
    reason: 'Grocery pickup.',
  },
  {
    category: 'other',
    confidence: 0.96,
    include: false,
    orderId: 'order_ulta-beauty_ul-2209',
    reason: 'Beauty products.',
  },
  {
    category: 'other',
    confidence: 0.96,
    include: false,
    orderId: 'order_sephora_se-7816',
    reason: 'Beauty products.',
  },
]

const beautyClassifications = [
  {
    category: 'beauty',
    confidence: 0.98,
    include: true,
    orderId: 'order_ulta-beauty_ul-2209',
    reason: 'Ulta order contains mascara and cleanser.',
  },
  {
    category: 'beauty',
    confidence: 0.98,
    include: true,
    orderId: 'order_sephora_se-7816',
    reason: 'Sephora order contains moisturizer, lip balm, and sunscreen.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_gap_gp-4482',
    reason: 'Clothing order.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_whole-foods-market_wf-20491',
    reason: 'Grocery pickup.',
  },
]

const sportsClassifications = [
  {
    category: 'sports gear',
    confidence: 0.91,
    include: true,
    orderId: 'order_target_tg-6621',
    reason: 'The classifier matched this order to the user-requested sports category.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_gap_gp-4482',
    reason: 'Clothing order.',
  },
  {
    category: 'other',
    confidence: 0.97,
    include: false,
    orderId: 'order_whole-foods-market_wf-20491',
    reason: 'Grocery pickup.',
  },
]

describe('answerAssistantWithToolPlanning', () => {
  it('uses a planned quick-action priority count', async () => {
    const result = await answerAssistantWithToolPlanning(
      'How many medium priority quick actions are there?',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: {
                priority: 'medium',
                responseFormat: 'count',
                status: 'suggested',
              },
              tool: 'listQuickActions',
            },
          ],
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Quick actions: medium priority',
      message: expect.stringMatching(/^You have \d+ medium priority tasks\.$/),
      type: 'answer',
    })
  })

  it('uses a planned high-priority quick-action list', async () => {
    const result = await answerAssistantWithToolPlanning(
      'List the high priority quick actions',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: {
                priority: 'high',
                responseFormat: 'list',
                status: 'suggested',
              },
              tool: 'listQuickActions',
            },
          ],
        }),
      },
    )

    expect(result.answer.message).toContain('Pay upcoming bill')
    expect(result.answer.message).toContain('Submit registration before deadline')
  })

  it('uses planned tool calls for due dates, responses, orders, and spend', async () => {
    await expect(
      answerAssistantWithToolPlanning(
        'When is the permission slip due?',
        createContext(),
        {},
        {
          fetcher: createPlannerFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { query: 'permission slip' },
                tool: 'searchQuickActions',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        message: 'Sign and return permission slip is due friday.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'Has Dana given an estimate on kitchen repairs?',
        createContext(),
        {},
        {
          fetcher: createPlannerFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: {
                  personName: 'Dana',
                  topic: 'estimate kitchen repairs',
                },
                tool: 'trackResponseFromPerson',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        message: expect.stringContaining('No, I don’t see a response from Dana'),
        type: 'answer',
      },
    })

    const wholeFoodsResult = await answerAssistantWithToolPlanning(
      'Was my Whole Foods order delivered?',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: { query: 'Whole Foods delivered' },
              tool: 'searchOrderUpdates',
            },
          ],
        }),
      },
    )

    expect(wholeFoodsResult).toMatchObject({
      answer: {
        message: expect.stringContaining(
          'Whole Foods Market order placed on May 1, 2026 is out for delivery',
        ),
        type: 'answer',
      },
    })

    const aprilWholeFoodsResult = await answerAssistantWithToolPlanning(
      'What about the one placed on April 30th?',
      createContext(),
      wholeFoodsResult.memory,
      {
        fetcher: createPlannerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: { query: 'budget review notes' },
              tool: 'searchConversations',
            },
          ],
        }),
      },
    )

    expect(aprilWholeFoodsResult).toMatchObject({
      answer: {
        message: expect.stringContaining(
          'Whole Foods Market order placed on April 30, 2026 is delivered',
        ),
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'Was anything replaced or refunded?',
        createContext(),
        aprilWholeFoodsResult.memory,
        {
          fetcher: createPlannerFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'refunds' },
                tool: 'calculateRefundTotals',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        message: expect.stringContaining(
          'Whole Foods Market order placed on April 30, 2026: Replacements: Organic strawberries were replaced with organic blueberries. No refunds found.',
        ),
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on groceries?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'groceries' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: groceries category',
        message:
          'You spent $192.75 on groceries in the requested period. Included merchants: Whole Foods Market, Instacart.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on clothes this month?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'clothing' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: clothes category',
        message:
          'You spent $79.90 on clothes in the requested period. Included merchants: Gap.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on beauty this month?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'beauty' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: beauty category',
        message:
          'You spent $115.07 on beauty in the requested period. Included merchants: Sephora, Ulta Beauty.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on beauty and skin care this month?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'beauty and skin care' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: beauty and skin care category',
        message:
          'You spent $115.07 on beauty and skin care in the requested period. Included merchants: Sephora, Ulta Beauty.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on makeup this month?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'beauty' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: makeup category',
        message:
          'You spent $115.07 on makeup in the requested period. Included merchants: Sephora, Ulta Beauty.',
        type: 'answer',
      },
    })

    await expect(
      answerAssistantWithToolPlanning(
        'How much did I spend on sports this month?',
        createContext(),
        {},
        {
          fetcher: createPlannerAndClassifierFetch({
            mode: 'tool_calls',
            toolCalls: [
              {
                arguments: { category: 'sports' },
                tool: 'calculateMerchantSpend',
              },
            ],
          }),
        },
      ),
    ).resolves.toMatchObject({
      answer: {
        grounding: 'Order totals: sports category',
        message:
          'You spent $29.34 on sports in the requested period. Included merchants: Target.',
        type: 'answer',
      },
    })
  })

  it('answers spend questions when the planner asks an unnecessary date clarification', async () => {
    const mayContext = {
      ...createContext(),
      dateRange: {
        endDate: '2026-05-31',
        startDate: '2026-05-01',
      },
    }
    const result = await answerAssistantWithToolPlanning(
      'How much did I spend on makeup this month?',
      mayContext,
      {},
      {
        fetcher: createPlannerAndClassifierFetch({
          clarificationQuestion:
            'Do you mean April 2026 or the requested period?',
          mode: 'clarification',
          toolCalls: [],
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Order totals: makeup category',
      message:
        'I didn’t find matching spend data for makeup in the requested period.',
      type: 'no-data',
    })

    const aprilContext = {
      ...createContext(),
      dateRange: {
        endDate: '2026-04-30',
        startDate: '2026-04-01',
      },
    }
    const followUpResult = await answerAssistantWithToolPlanning(
      'How about last month?',
      aprilContext,
      result.memory,
      {
        fetcher: createPlannerAndClassifierFetch({
          clarificationQuestion:
            'Are you asking for a summary of quick actions from last month?',
          mode: 'clarification',
          toolCalls: [],
        }),
      },
    )

    expect(followUpResult).toMatchObject({
      answer: {
        grounding: 'Order totals: makeup category',
        message:
          'You spent $115.07 on makeup in the requested period. Included merchants: Sephora, Ulta Beauty.',
        type: 'answer',
      },
    })
    expect(followUpResult.memory.recentTurns?.at(-1)).toMatchObject({
      domain: 'spend',
      entities: {
        category: 'makeup',
      },
      query: 'How about last month?',
      type: 'answer',
    })
  })

  it('answers task due-date questions when the planner asks an unnecessary clarification', async () => {
    const result = await answerAssistantWithToolPlanning(
      'When is the permission slip due?',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          clarificationQuestion:
            'Do you mean a specific permission slip?',
          mode: 'clarification',
          toolCalls: [],
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Task: Sign and return permission slip',
      message: 'Sign and return permission slip is due friday.',
      type: 'answer',
    })
  })

  it('answers response-tracking questions when the planner asks an unnecessary clarification', async () => {
    const result = await answerAssistantWithToolPlanning(
      'Has Dana given an estimate on kitchen repairs?',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          clarificationQuestion:
            'Do you mean quick actions or conversations?',
          mode: 'clarification',
          toolCalls: [],
        }),
      },
    )

    expect(result.answer).toMatchObject({
      message: expect.stringContaining('No, I don’t see an estimate from Dana Repairs'),
      type: 'answer',
    })
  })

  it('answers conversation message questions with the LLM when the planner asks an unnecessary clarification', async () => {
    const result = await answerAssistantWithToolPlanning(
      'What did Sam say in the outing thread?',
      createContext(),
      {},
      {
        fetcher: createPlannerAndConversationAnswerFetch({
          clarificationQuestion:
            "Do you mean the thread named 'outing'?",
          mode: 'clarification',
          toolCalls: [],
        }, {
          answer: 'I don’t see a message from Sam in the Neighborhood outing thread.',
          conversationId: 'thread_neighborhood-outing',
          type: 'no-data',
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Conversation: Neighborhood outing',
      message: 'I don’t see a message from Sam in the Neighborhood outing thread.',
      type: 'no-data',
    })
  })

  it('answers conversation questions with the LLM when the planner asks an unnecessary clarification', async () => {
    const result = await answerAssistantWithToolPlanning(
      'Have we finalized the restaurant for the team outing?',
      createContext(),
      {},
      {
        fetcher: createPlannerAndConversationAnswerFetch({
          clarificationQuestion:
            "Do you mean the neighborhood outing or dinner reservation?",
          mode: 'clarification',
          toolCalls: [],
        }, {
          answer:
            'Not yet. In the Team retreat agenda thread, dinner options still need confirmation.',
          conversationId: 'thread_team-retreat-agenda',
          type: 'answer',
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Conversation: Team retreat agenda',
      message:
        'Not yet. In the Team retreat agenda thread, dinner options still need confirmation.',
      type: 'answer',
    })
    expect(result.answer.message).not.toContain('table for six at 7 PM')
  })

  it('answers planned conversation lookups with full candidate context', async () => {
    let answerRequest: unknown
    const result = await answerAssistantWithToolPlanning(
      'Have we finalized the restaurant for the team outing?',
      createContext(),
      {},
      {
        fetcher: createPlannerAndConversationAnswerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: { query: 'restaurant team outing finalized' },
              tool: 'searchConversations',
            },
          ],
        }, {
          answer:
            'Not yet. In the Team retreat agenda thread, dinner options still need confirmation.',
          conversationId: 'thread_team-retreat-agenda',
          type: 'answer',
        }, (body) => {
          answerRequest = body
        }),
      },
    )

    expect(result.answer).toMatchObject({
      grounding: 'Conversation: Team retreat agenda',
      message:
        'Not yet. In the Team retreat agenda thread, dinner options still need confirmation.',
      type: 'answer',
    })
    expect(JSON.stringify(answerRequest)).toContain('"Work"')
    expect(JSON.stringify(answerRequest)).toContain('Can someone confirm dinner options')
    expect(JSON.stringify(answerRequest)).not.toContain('Friday dinner reservation')
    expect(JSON.stringify(answerRequest)).not.toContain('they can hold a table for six')
  })

  it('falls back if the planner returns an invalid or unsupported tool call', async () => {
    const result = await answerAssistantWithToolPlanning(
      'Write a poem about my inbox',
      createContext(),
      {},
      {
        fetcher: createPlannerFetch({
          mode: 'tool_calls',
          toolCalls: [
            {
              arguments: {},
              tool: 'writePoem',
            },
          ],
        }),
      },
    )

    expect(result.answer).toMatchObject({
      message:
        'I don’t support that yet. I can help with quick actions, conversations, and order updates.',
      type: 'unsupported',
    })
  })
})

describe('finalizeAssistantToolResults', () => {
  it('sends executed tool results only to the finalizer endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          message: 'You have 3 medium-priority quick actions.',
        }),
      ok: true,
    })

    const answer = await finalizeAssistantToolResults(
      'How many medium priority quick actions are there?',
      {
        grounding: 'Quick actions: medium priority',
        message: 'You have 3 medium priority tasks.',
        type: 'answer',
      },
      [
        {
          arguments: {
            priority: 'medium',
            responseFormat: 'count',
            status: 'suggested',
          },
          result: { count: 3 },
          tool: 'listQuickActions',
        },
      ],
      { fetcher },
    )

    const requestBody = JSON.parse(fetcher.mock.calls[0][1].body as string)

    expect(fetcher).toHaveBeenCalledWith('/api/assistant/finalize', expect.any(Object))
    expect(requestBody).toMatchObject({
      baselineAnswer: 'You have 3 medium priority tasks.',
      question: 'How many medium priority quick actions are there?',
      toolResults: [
        {
          result: { count: 3 },
          tool: 'listQuickActions',
        },
      ],
    })
    expect(JSON.stringify(requestBody)).not.toContain('OPENAI_API_KEY')
    expect(answer.message).toBe('You have 3 medium-priority quick actions.')
  })

  it('keeps order numbers out of the finalizer payload', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          message:
            'Whole Foods Market order placed on May 1, 2026 is out for delivery.',
        }),
      ok: true,
    })

    await finalizeAssistantToolResults(
      'Was my Whole Foods order delivered?',
      {
        grounding: 'Order: Whole Foods Market #WF-20491',
        message: 'Whole Foods Market order placed on May 1, 2026 is out for delivery.',
        type: 'answer',
      },
      [
        {
          arguments: { query: 'Whole Foods delivered' },
          result: {
            count: 1,
            orders: [
              {
                merchantName: 'Whole Foods Market',
                orderDate: '2026-05-01T16:15:00.000Z',
                orderNumber: 'WF-20491',
                status: 'out_for_delivery',
              },
            ],
          },
          tool: 'searchOrderUpdates',
        },
      ],
      { fetcher },
    )

    const requestBody = JSON.parse(fetcher.mock.calls[0][1].body as string)

    expect(requestBody.baselineAnswer).toBe(
      'Whole Foods Market order placed on May 1, 2026 is out for delivery.',
    )
    expect(JSON.stringify(requestBody.toolResults)).not.toContain('WF-20491')
  })
})
