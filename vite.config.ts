import { defineConfig } from 'vitest/config'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const assistantApiRoutes = {
  '/api/assistant/classify-spend': new URL(
    './api/assistant/classify-spend.js',
    import.meta.url,
  ).href,
  '/api/assistant/finalize': new URL(
    './api/assistant/finalize.js',
    import.meta.url,
  ).href,
  '/api/assistant/plan': new URL('./api/assistant/plan.js', import.meta.url).href,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [assistantApiDevServer(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})

function assistantApiDevServer(): Plugin {
  return {
    apply: 'serve',
    configureServer(server) {
      for (const [route, handlerUrl] of Object.entries(assistantApiRoutes)) {
        server.middlewares.use(route, (request, response) => {
          void handleAssistantApiRequest(request, response, handlerUrl)
        })
      }
    },
    name: 'mailbuddy-assistant-api-dev-server',
  }
}

async function handleAssistantApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handlerUrl: string,
) {
  try {
    const body = await readRequestBody(request)
    const { default: handler } = await import(handlerUrl)

    await handler(
      {
        body,
        method: request.method,
      },
      createJsonResponse(response),
    )
  } catch {
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Assistant API route failed' }))
  }
}

function createJsonResponse(response: ServerResponse) {
  return {
    json(payload: unknown) {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(payload))
    },
    setHeader(name: string, value: string) {
      response.setHeader(name, value)
    },
    status(code: number) {
      response.statusCode = code
      return this
    },
  }
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')

  if (!rawBody) {
    return undefined
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}
