const plannerPrompt = [
  'You are the tool planner for MailBuddy.',
  'Read the user question and choose deterministic MailBuddy tools to execute.',
  'Do not answer the user. Do not calculate totals. Do not invent facts.',
  'Use only tool names and argument shapes from the provided tool schema.',
  'Return clarification mode only when the question has multiple plausible meanings.',
  'Return unsupported mode only when the request is outside quick actions, conversations, order updates, or spend.',
  'For priority counts or lists, use listQuickActions with status suggested, priority, and responseFormat count or list.',
  'For money questions, use calculateMerchantSpend or calculateRefundTotals.',
  'For category spend questions, pass a concise category string in calculateMerchantSpend or calculateRefundTotals, such as clothing, groceries, beauty, pets, restaurant, electronics, household, or gifts.',
  'For person response questions, use trackResponseFromPerson.',
  'Return JSON matching the required schema.',
].join(' ')

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    response.status(503).json({ error: 'Assistant planner is not configured' })
    return
  }

  const body = typeof request.body === 'string'
    ? parseJson(request.body)
    : request.body

  if (!isValidPlanRequest(body)) {
    response.status(400).json({ error: 'Invalid assistant planner request' })
    return
  }

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: [{ text: plannerPrompt, type: 'input_text' }],
            role: 'system',
          },
          {
            content: [
              {
                text: JSON.stringify({
                  dateRange: body.dateRange ?? null,
                  question: body.question,
                  tools: body.tools,
                }),
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        max_output_tokens: 500,
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        temperature: 0,
        text: {
          format: {
            name: 'mailbuddy_tool_plan',
            schema: {
              additionalProperties: false,
              properties: {
                clarificationQuestion: { type: ['string', 'null'] },
                fallbackReason: { type: ['string', 'null'] },
                mode: {
                  enum: ['tool_calls', 'clarification', 'unsupported'],
                  type: 'string',
                },
                toolCalls: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      arguments: {
                        additionalProperties: false,
                        properties: {
                          id: { type: ['string', 'null'] },
                          category: {
                            type: ['string', 'null'],
                          },
                          merchantNames: {
                            items: { type: 'string' },
                            type: ['array', 'null'],
                          },
                          personName: { type: ['string', 'null'] },
                          priority: {
                            enum: ['high', 'medium', 'low', null],
                          },
                          query: { type: ['string', 'null'] },
                          responseFormat: {
                            enum: ['count', 'list', null],
                          },
                          status: {
                            enum: ['suggested', 'completed', 'dismissed', null],
                          },
                          topic: { type: ['string', 'null'] },
                        },
                        required: [
                          'id',
                          'category',
                          'merchantNames',
                          'personName',
                          'priority',
                          'query',
                          'responseFormat',
                          'status',
                          'topic',
                        ],
                        type: 'object',
                      },
                      id: { type: ['string', 'null'] },
                      tool: { type: 'string' },
                    },
                    required: ['arguments', 'id', 'tool'],
                    type: 'object',
                  },
                  type: 'array',
                },
              },
              required: [
                'clarificationQuestion',
                'fallbackReason',
                'mode',
                'toolCalls',
              ],
              type: 'object',
            },
            strict: true,
            type: 'json_schema',
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!openAiResponse.ok) {
      response.status(502).json({ error: 'Assistant planner request failed' })
      return
    }

    const data = await openAiResponse.json()
    const plan = parseJsonOutput(data)

    if (!plan) {
      response.status(502).json({ error: 'Assistant planner returned no plan' })
      return
    }

    response.status(200).json({ plan })
  } catch {
    response.status(502).json({ error: 'Assistant planner is unavailable' })
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function isValidPlanRequest(body) {
  return (
    body &&
    typeof body.question === 'string' &&
    Array.isArray(body.tools) &&
    (!body.dateRange ||
      (typeof body.dateRange.startDate === 'string' &&
        typeof body.dateRange.endDate === 'string'))
  )
}

function parseJsonOutput(data) {
  const rawText =
    data.output_text ??
    data.output
      ?.flatMap((output) => output.content ?? [])
      .map((content) => content.text)
      .find((text) => Boolean(text)) ??
    data.choices?.[0]?.message?.content

  if (!rawText) {
    return undefined
  }

  return parseJson(rawText)
}
