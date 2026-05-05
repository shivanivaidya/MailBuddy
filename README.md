# MailBuddy

React + TypeScript + Tailwind web app scaffolded with Vite.

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run build` type-checks and builds for production.
- `npm run lint` runs ESLint.
- `npm run preview` serves the production build locally.

## Assistant LLM planner and finalizer

MailBuddy uses an LLM to plan tool calls and write the final natural-language
answer, while deterministic app code still retrieves facts and performs all
calculations. Deploy the serverless routes with:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to `gpt-4.1-mini`

The browser never receives the OpenAI key.

- `/api/assistant/plan` receives the user question, selected date range, and a
  compact tool schema. It returns a validated tool-call plan.
- The frontend executes approved deterministic MailBuddy tools locally.
- `/api/assistant/classify-spend` can classify compact order summaries into
  allowed spend categories such as `groceries`. The frontend validates returned
  order IDs/categories/confidence and still performs all totals locally.
- `/api/assistant/finalize` receives only the original question and compact tool
  results. It formats the final answer without doing retrieval or math.

If either route or OpenAI call fails, MailBuddy keeps the deterministic template
response.

`npm run dev` serves these API routes through a Vite dev middleware so local
testing uses the same `/api/assistant/*` paths. Set `OPENAI_API_KEY` in your
local shell before starting the dev server.

Do not commit `.env` files.

## Structure

- `src/components` reusable UI components.
- `src/layouts` app-level layout components.
- `src/pages` route-level screens.
- `src/hooks` React hooks.
- `src/services` data access and API clients.
- `src/types` shared TypeScript types.
- `src/utils` shared utility functions.
- `src/styles` app-level style modules.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
