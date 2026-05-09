import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AssistantAnswer } from '@/types/mail'

type AssistantPanelProps = {
  answer: AssistantAnswer | null
  isFinalizingAnswer: boolean
  isListening: boolean
  onAsk: (query: string) => void
  onListeningChange: (isListening: boolean) => void
  onSessionReset: () => void
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

type ChatMessage = {
  grounding?: string
  id: number
  message: string
  pending?: boolean
  role: 'assistant' | 'user'
  type?: AssistantAnswer['type']
}

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
  onSessionReset,
}: AssistantPanelProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingMessageId, setPendingMessageId] = useState<number | null>(null)
  const nextMessageId = useRef(1)
  const speechRecognition = getSpeechRecognitionConstructor()
  const voiceSupported = Boolean(speechRecognition)
  const voiceLabel = useMemo(() => {
    if (!voiceSupported) {
      return 'Voice unavailable'
    }

    return isListening ? 'Listening' : 'Start voice input'
  }, [isListening, voiceSupported])
  const visibleMessages = useMemo(
    () => materializeAssistantAnswer(messages, pendingMessageId, answer),
    [answer, messages, pendingMessageId],
  )

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askQuery(query)
  }

  function askSuggestedQuery(suggestedQuery: string) {
    setIsChatOpen(true)
    askQuery(suggestedQuery)
  }

  function askQuery(rawQuery: string) {
    const nextQuery = rawQuery.trim()

    if (!nextQuery) {
      return
    }

    const userMessageId = nextMessageId.current
    const assistantMessageId = userMessageId + 1
    nextMessageId.current = assistantMessageId + 1

    setMessages((currentMessages) => [
      ...materializeAssistantAnswer(currentMessages, pendingMessageId, answer),
      { id: userMessageId, message: nextQuery, role: 'user' },
      {
        id: assistantMessageId,
        message: 'Checking MailBuddy data...',
        pending: true,
        role: 'assistant',
        type: 'answer',
      },
    ])
    setPendingMessageId(assistantMessageId)
    setQuery('')
    onAsk(nextQuery)
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
        askQuery(transcript)
      }
    }
    recognition.start()
  }

  function closeChat() {
    setIsChatOpen(false)
    setQuery('')
    setMessages([])
    setPendingMessageId(null)
    nextMessageId.current = 1
    onSessionReset()
  }

  function speakMessage(message: string) {
    if (!('speechSynthesis' in window)) {
      return
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(message))
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-3 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700"
        onClick={() => setIsChatOpen(true)}
        type="button"
      >
        <ChatIcon />
        Ask MailBuddy
      </button>

      {isChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6">
          <section
            aria-modal="true"
            className="flex h-[78vh] w-full max-w-5xl flex-col overflow-hidden rounded-b-3xl bg-white shadow-2xl ring-1 ring-slate-200"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-6 py-5">
              <div className="flex items-center gap-6">
                <div className="flex size-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20">
                  <ChatIcon large />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    MailBuddy Assistant
                  </h3>
                  <p className="mt-2 text-lg font-medium text-emerald-700">
                    Ask about tasks, emails, and orders
                  </p>
                </div>
              </div>
              <button
                aria-label="Close chat"
                className="flex size-12 items-center justify-center text-slate-500 transition hover:text-slate-950"
                onClick={closeChat}
                type="button"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
              {visibleMessages.length > 0 || isFinalizingAnswer ? (
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                  {visibleMessages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      onSpeak={speakMessage}
                    />
                  ))}
                </div>
              ) : (
                <div className="m-auto text-center">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <ChatIcon large />
                  </div>
                  <p className="mt-4 text-lg text-slate-600">
                    Start a conversation with MailBuddy
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                    {suggestedQueries.slice(0, 3).map((suggestedQuery) => (
                      <button
                        className="rounded-full border border-slate-200 bg-white px-5 py-3 text-lg font-semibold text-slate-700 transition hover:bg-slate-50"
                        key={suggestedQuery}
                        onClick={() => askSuggestedQuery(suggestedQuery)}
                        type="button"
                      >
                        {suggestedQuery}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              className="flex items-center gap-6 border-t border-slate-200 px-6 py-5"
              onSubmit={submitQuery}
            >
              <button
                aria-label={voiceLabel}
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition ${
                  isListening ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={!voiceSupported}
                onClick={startVoiceInput}
                title={voiceLabel}
                type="button"
              >
                <MicIcon />
              </button>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-lg text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask MailBuddy anything..."
                value={query}
              />
              <button
                aria-label="Send message"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-500"
                type="submit"
              >
                <SendIcon />
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

function ChatBubble({
  message,
  onSpeak,
}: {
  message: ChatMessage
  onSpeak: (message: string) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl bg-slate-950 px-5 py-4 text-base font-medium leading-7 text-white">
        {message.message}
      </div>
    )
  }

  return (
    <div
      className={`mr-auto w-full max-w-4xl rounded-2xl px-6 py-5 text-base leading-7 ${
        getAssistantBubbleClasses(message)
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p>{message.message}</p>
          {message.grounding ? (
            <p className="mt-2 text-base opacity-75">{message.grounding}</p>
          ) : null}
        </div>
        {!message.pending && 'speechSynthesis' in window ? (
          <button
            aria-label="Speak answer"
            className="flex size-10 shrink-0 items-center justify-center rounded-md border border-current/10 bg-white/40 text-current transition hover:bg-white/70"
            onClick={() => onSpeak(message.message)}
            title="Speak answer"
            type="button"
          >
            <VolumeIcon />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function getAssistantBubbleClasses(message: ChatMessage) {
  if (message.type === 'clarification') {
    return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
  }

  if (message.type === 'answer' || message.pending) {
    return 'bg-cyan-50 text-cyan-900 ring-1 ring-cyan-100'
  }

  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-100'
}

function materializeAssistantAnswer(
  messages: ChatMessage[],
  pendingMessageId: number | null,
  answer: AssistantAnswer | null,
): ChatMessage[] {
  if (!answer || pendingMessageId === null) {
    return messages
  }

  return messages.map((message) =>
    message.id === pendingMessageId
      ? {
          grounding: answer.grounding,
          id: message.id,
          message: answer.message,
          role: 'assistant' as const,
          type: answer.type,
        }
      : message,
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
      className="size-9"
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
      className="size-5"
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

function ChatIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={large ? 'size-12' : 'size-6'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
