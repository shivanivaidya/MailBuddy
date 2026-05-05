const finalizerPrompt = [
  'You are the final response writer for MailBuddy.',
  'The app has already executed deterministic tools and calculations.',
  'Use only the provided tool results.',
  'Do not add, infer, invent, or estimate any person, merchant, date, status, amount, order detail, decision, or next step.',
  'Do not do math. If a number is needed, use the provided deterministic result.',
  'If the tool results lack a fact, say that MailBuddy does not have that detail.',
  'Keep the answer natural, concise, and useful. One to three sentences is enough unless the user asked what is included.',
  'Return JSON with exactly one field: message.',
].join(' ')

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    response.status(503).json({ error: 'Assistant finalizer is not configured' })
    return
  }

  const body = typeof request.body === 'string'
    ? parseJson(request.body)
    : request.body

  if (!isValidFinalizeRequest(body)) {
    response.status(400).json({ error: 'Invalid assistant finalizer request' })
    return
  }

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: [{ text: finalizerPrompt, type: 'input_text' }],
            role: 'system',
          },
          {
            content: [
              {
                text: JSON.stringify({
                  formatting: body.formatting,
                  question: body.question,
                  toolResults: body.toolResults,
                }),
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        max_output_tokens: 320,
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        temperature: 0.1,
        text: {
          format: {
            name: 'mailbuddy_final_answer',
            schema: {
              additionalProperties: false,
              properties: {
                message: { type: 'string' },
              },
              required: ['message'],
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
      response.status(502).json({ error: 'Assistant finalizer request failed' })
      return
    }

    const data = await openAiResponse.json()
    const parsed = parseJsonOutput(data)
    const message = parsed?.message

    if (typeof message !== 'string' || !message.trim()) {
      response.status(502).json({ error: 'Assistant finalizer returned no message' })
      return
    }

    response.status(200).json({ message: message.trim() })
  } catch {
    response.status(502).json({ error: 'Assistant finalizer is unavailable' })
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function isValidFinalizeRequest(body) {
  return (
    body &&
    typeof body.question === 'string' &&
    Array.isArray(body.toolResults)
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
