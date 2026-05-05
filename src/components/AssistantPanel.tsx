import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AssistantAnswer } from '@/types/mail'

type AssistantPanelProps = {
  answer: AssistantAnswer | null
  isFinalizingAnswer: boolean
  isListening: boolean
  onAsk: (query: string) => void
  onListeningChange: (isListening: boolean) => void
}

type SpeechRecognitionLike = {
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onstart: (() => void) | null
  start: () => void
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const suggestedQueries = [
  'What do I need to do today?',
  'Has Mary responded to my email?',
  'Was my Whole Foods order delivered?',
  'When is the permission slip due?',
  'How much did I spend this month?',
]

export function AssistantPanel({
  answer,
  isFinalizingAnswer,
  isListening,
  onAsk,
  onListeningChange,
}: AssistantPanelProps) {
  const [query, setQuery] = useState('')
  const speechRecognition = getSpeechRecognitionConstructor()
  const voiceSupported = Boolean(speechRecognition)
  const voiceLabel = useMemo(() => {
    if (!voiceSupported) {
      return 'Voice unavailable'
    }

    return isListening ? 'Listening' : 'Start voice input'
  }, [isListening, voiceSupported])

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAsk(query)
  }

  function askSuggestedQuery(suggestedQuery: string) {
    setQuery(suggestedQuery)
    onAsk(suggestedQuery)
  }

  function startVoiceInput() {
    if (!speechRecognition) {
      return
    }

    const recognition = new speechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => onListeningChange(true)
    recognition.onerror = () => onListeningChange(false)
    recognition.onend = () => onListeningChange(false)
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()

      if (transcript) {
        setQuery(transcript)
        onAsk(transcript)
      }
    }
    recognition.start()
  }

  function speakAnswer() {
    if (!answer || !('speechSynthesis' in window)) {
      return
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer.message))
  }

  return (
    <section className="rounded-lg bg-white/80 p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">Ask MailBuddy</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask about tasks, conversations, orders, and spend.
          </p>
        </div>

        <form
          className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
          onSubmit={submitQuery}
        >
          <button
            aria-label={voiceLabel}
            className={`flex size-10 shrink-0 items-center justify-center rounded-md border text-sm transition ${
              isListening
                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={!voiceSupported}
            onClick={startVoiceInput}
            title={voiceLabel}
            type="button"
          >
            <MicIcon />
          </button>
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about tasks, conversations, or orders"
            value={query}
          />
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            type="submit"
          >
            Ask
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestedQueries.map((suggestedQuery) => (
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            key={suggestedQuery}
            onClick={() => askSuggestedQuery(suggestedQuery)}
            type="button"
          >
            {suggestedQuery}
          </button>
        ))}
      </div>

      {answer || isFinalizingAnswer ? (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            answer?.type === 'clarification'
              ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
              : answer?.type === 'answer' || !answer
                ? 'bg-cyan-50 text-cyan-900 ring-1 ring-cyan-100'
                : 'bg-slate-50 text-slate-600 ring-1 ring-slate-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p>{answer?.message ?? 'Checking MailBuddy data...'}</p>
              {answer?.grounding ? (
                <p className="mt-1 text-xs opacity-75">{answer.grounding}</p>
              ) : null}
              {isFinalizingAnswer ? (
                <p className="mt-1 text-xs opacity-75">
                  {answer ? 'Writing final answer...' : 'Planning tool calls...'}
                </p>
              ) : null}
            </div>
            {answer && 'speechSynthesis' in window ? (
              <button
                aria-label="Speak answer"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-current/10 bg-white/40 text-current transition hover:bg-white/70"
                onClick={speakAnswer}
                title="Speak answer"
                type="button"
              >
                <VolumeIcon />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return undefined
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}
