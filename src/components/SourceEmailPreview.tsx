import type { ActionItem, Email, EmailThread } from '@/types/mail'

type SourceEmailPreviewProps = {
  action?: ActionItem | null
  email?: Email
  mode?: 'source' | 'thread'
  thread?: EmailThread | null
}

export function SourceEmailPreview({
  action,
  email,
  mode = 'source',
  thread,
}: SourceEmailPreviewProps) {
  if (thread) {
    return <ThreadPreview thread={thread} />
  }

  if (!action || !email) {
    const isThreadMode = mode === 'thread'

    return (
      <aside className="rounded-lg border border-dashed border-slate-200 bg-white/80 shadow-sm xl:sticky xl:top-6 xl:self-start">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">
            {isThreadMode ? 'Conversation context' : 'Source email preview'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isThreadMode
              ? 'Select a conversation to view the summarized context.'
              : 'Every suggested task can be traced back to the email that produced it.'}
          </p>
        </div>
        <div className="p-5">
          <div className="rounded-lg bg-slate-50 px-5 py-10 text-center">
            <p className="font-semibold text-slate-950">
              {isThreadMode
                ? 'Select a conversation to view its context.'
                : 'Select a task to view its source email.'}
            </p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white/90 shadow-sm xl:sticky xl:top-6 xl:self-start">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">
          Source email preview
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Trace this suggested task back to the original email.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Sender</p>
              <p className="mt-1 font-semibold text-slate-950">
                {email.sender}
              </p>
            </div>
            <span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold capitalize text-cyan-700">
              {action.priority}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-500">Subject</p>
            <p className="mt-1 font-semibold text-slate-950">
              {email.subject}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-500">Date</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {formatEmailDate(email.date)}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            Source snippet that triggered this task
          </p>
          <p className="mt-2 text-sm leading-6 text-cyan-950">
            {action.sourceSnippet}
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Full email body
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
            {email.body}
          </p>
        </div>
      </div>
    </aside>
  )
}

function ThreadPreview({ thread }: { thread: EmailThread }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white/90 shadow-sm xl:sticky xl:top-6 xl:self-start">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">
          Conversation context
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Summarized context from related emails.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Conversation
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {thread.subject}
              </p>
            </div>
            {thread.needsReply ? (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                Needs reply
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            MailBuddy summary
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-cyan-950">
            {thread.detailedSummaryBullets.map((bullet) => (
              <li className="flex gap-2" key={bullet}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {thread.emails.map((threadEmail) => {
            const isLatest = threadEmail.id === thread.latestEmail.id

            return (
              <article
                className={`rounded-md border p-4 ${
                  isLatest
                    ? 'border-cyan-200 bg-cyan-50/60'
                    : 'border-slate-200 bg-white'
                }`}
                key={threadEmail.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {threadEmail.sender}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatEmailDate(threadEmail.date)}
                    </p>
                  </div>
                  {isLatest ? (
                    <span className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-700">
                      Latest
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {threadEmail.body}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
