const conversationPrompt = [
  'You answer MailBuddy conversation questions using only provided candidate conversations.',
  'First choose the single candidate conversation that best matches the full user question.',
  'Consider subject, summary, labels, participants, detailed summary bullets, and message bodies together.',
  'Match the whole user question to the whole candidate conversation, not just the strongest overlapping noun.',
  'Treat group and context qualifiers such as team, work, school, family, neighborhood, project, vendor, client, and friend as high-salience matching signals.',
  'Do not ignore a group/context qualifier just because another candidate has a concrete object keyword such as restaurant, dinner, date, payment, or order.',
  'Then answer the question strictly from the selected conversation.',
  'If the selected conversation does not contain the requested fact, say that MailBuddy does not see that detail in the conversation.',
  'If no candidate clearly matches the question, return conversationId null and a no-data answer.',
  'Do not use outside knowledge. Do not invent people, dates, decisions, statuses, or next steps.',
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
    response.status(503).json({ error: 'Assistant conversation answerer is not configured' })
    return
  }

  const body = typeof request.body === 'string'
    ? parseJson(request.body)
    : request.body

  if (!isValidConversationRequest(body)) {
    response.status(400).json({ error: 'Invalid assistant conversation request' })
    return
  }

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: [{ text: conversationPrompt, type: 'input_text' }],
            role: 'system',
          },
          {
            content: [
              {
                text: JSON.stringify({
                  candidates: body.candidates,
                  question: body.question,
                }),
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        max_output_tokens: 420,
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        temperature: 0,
        text: {
          format: {
            name: 'mailbuddy_conversation_answer',
            schema: {
              additionalProperties: false,
              properties: {
                answer: { type: 'string' },
                conversationId: { type: ['string', 'null'] },
                reason: { type: ['string', 'null'] },
                type: {
                  enum: ['answer', 'no-data'],
                  type: 'string',
                },
              },
              required: ['answer', 'conversationId', 'reason', 'type'],
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
      response.status(502).json({ error: 'Assistant conversation answer request failed' })
      return
    }

    const data = await openAiResponse.json()
    const answer = parseJsonOutput(data)

    if (!answer) {
      response.status(502).json({ error: 'Assistant conversation answerer returned no answer' })
      return
    }

    response.status(200).json({ answer })
  } catch {
    response.status(502).json({ error: 'Assistant conversation answerer is unavailable' })
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function isValidConversationRequest(body) {
  return (
    body &&
    typeof body.question === 'string' &&
    Array.isArray(body.candidates) &&
    body.candidates.every(
      (candidate) =>
        candidate &&
        typeof candidate.id === 'string' &&
        typeof candidate.subject === 'string',
    )
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
