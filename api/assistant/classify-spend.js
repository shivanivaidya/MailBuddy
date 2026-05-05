const classifierPrompt = [
  'You classify MailBuddy order summaries into spend categories.',
  'Use only the provided order merchant and item names.',
  'Do not calculate totals. Do not invent missing items.',
  'The target category is provided by the request, for example clothing, groceries, beauty, pets, restaurant, electronics, household, or gifts.',
  'For each order, set category to the exact target category only when the merchant/items clearly match that target category.',
  'Otherwise set category to other and include false.',
  'Exclude orders unless the provided merchant/items clearly indicate the requested category.',
  'Return one classification for every provided order id.',
  'Return JSON matching the schema.',
].join(' ')

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    response.status(503).json({ error: 'Spend classifier is not configured' })
    return
  }

  const body = typeof request.body === 'string'
    ? parseJson(request.body)
    : request.body

  if (!isValidClassifyRequest(body)) {
    response.status(400).json({ error: 'Invalid spend classifier request' })
    return
  }

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: [{ text: classifierPrompt, type: 'input_text' }],
            role: 'system',
          },
          {
            content: [
              {
                text: JSON.stringify({
                  category: body.category,
                  orders: body.orders,
                }),
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        max_output_tokens: 900,
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        temperature: 0,
        text: {
          format: {
            name: 'mailbuddy_spend_classification',
            schema: {
              additionalProperties: false,
              properties: {
                classifications: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      category: {
                        type: 'string',
                      },
                      confidence: {
                        maximum: 1,
                        minimum: 0,
                        type: 'number',
                      },
                      include: { type: 'boolean' },
                      orderId: { type: 'string' },
                      reason: { type: 'string' },
                    },
                    required: [
                      'category',
                      'confidence',
                      'include',
                      'orderId',
                      'reason',
                    ],
                    type: 'object',
                  },
                  type: 'array',
                },
              },
              required: ['classifications'],
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
      response.status(502).json({ error: 'Spend classifier request failed' })
      return
    }

    const data = await openAiResponse.json()
    const parsed = parseJsonOutput(data)

    if (!Array.isArray(parsed?.classifications)) {
      response.status(502).json({ error: 'Spend classifier returned no classifications' })
      return
    }

    response.status(200).json({ classifications: parsed.classifications })
  } catch {
    response.status(502).json({ error: 'Spend classifier is unavailable' })
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function isValidClassifyRequest(body) {
  return (
    body &&
    isSafeCategoryName(body.category) &&
    Array.isArray(body.orders) &&
    body.orders.every(
      (order) =>
        order &&
        typeof order.id === 'string' &&
        typeof order.merchantName === 'string' &&
        Array.isArray(order.items),
    )
  )
}

function isSafeCategoryName(value) {
  return (
    typeof value === 'string' &&
    /^[a-z][a-z\s-]{1,40}$/i.test(value.trim()) &&
    value.toLowerCase().trim() !== 'other'
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
