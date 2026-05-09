import { useEffect, useRef, useState } from 'react'
import type { EmailThread, EmailThreadEdit } from '@/types/mail'

type ThreadsSectionProps = {
  onEditThread: (threadId: string, updates: EmailThreadEdit) => void
  onMarkReviewed: (threadId: string) => void
  onRestoreThread: (threadId: string) => void
  onToggleThread: (threadId: string) => void
  selectedThreadId: string | null
  threads: EmailThread[]
}

export function ThreadsSection({
  onEditThread,
  onMarkReviewed,
  onRestoreThread,
  onToggleThread,
  selectedThreadId,
  threads,
}: ThreadsSectionProps) {
  const threadGroups = groupThreadsByStatus(threads)

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 p-6 shadow-sm">
      <div className="flex flex-col gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold">Conversations</h3>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300">
          Context-heavy email discussions summarized for review and reply.
          </p>
        </div>
        <span className="rounded-md bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3 text-base font-semibold text-white">
          {threadGroups.suggested.length} active conversations
        </span>
      </div>

      <div className="mt-4 space-y-5">
        {threadGroups.suggested.length > 0 ? (
          threadGroups.suggested.map((thread, index) => {
            const isExpanded = selectedThreadId === thread.id

            return (
              <ThreadCard
                index={index}
                key={thread.id}
                onEditThread={onEditThread}
                onMarkReviewed={onMarkReviewed}
                onToggleThread={onToggleThread}
                selected={isExpanded}
                thread={thread}
              />
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-cyan-300 bg-cyan-50 p-8 text-center">
            <p className="font-semibold text-slate-950">
              No data found for this date range
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Adjust the global date range to broaden results.
            </p>
          </div>
        )}
        <ThreadArchiveSection
          label="Reviewed"
          onRestoreThread={onRestoreThread}
          onToggleThread={onToggleThread}
          selectedThreadId={selectedThreadId}
          threads={threadGroups.reviewed}
        />
      </div>
    </section>
  )
}

function ThreadCard({
  index,
  onEditThread,
  onMarkReviewed,
  onRestoreThread,
  onToggleThread,
  readonly = false,
  selected,
  thread,
}: {
  index: number
  onEditThread: (threadId: string, updates: EmailThreadEdit) => void
  onMarkReviewed: (threadId: string) => void
  onRestoreThread?: (threadId: string) => void
  onToggleThread: (threadId: string) => void
  readonly?: boolean
  selected: boolean
  thread: EmailThread
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftDueDate, setDraftDueDate] = useState('')
  const [draftPriority, setDraftPriority] =
    useState<EmailThread['priority']>(thread.priority)
  const [draftSubject, setDraftSubject] = useState('')
  const editFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isEditing) {
      return undefined
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!editFormRef.current?.contains(event.target as Node)) {
        setDraftSubject(thread.subject)
        setDraftPriority(thread.priority)
        setDraftDueDate(thread.dueDate ?? '')
        setIsEditing(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isEditing, thread.dueDate, thread.priority, thread.subject])

  function saveEdit() {
    const nextSubject = draftSubject.trim()

    if (!nextSubject) {
      return
    }

    onEditThread(thread.id, {
      dueDate: draftDueDate.trim(),
      priority: draftPriority,
      subject: nextSubject,
    })
    setDraftSubject(nextSubject)
    setIsEditing(false)
  }

  return (
    <article
      className={`rounded-2xl bg-white px-7 py-6 text-left shadow-sm ring-1 transition ${
        readonly
          ? 'bg-emerald-50/35 ring-emerald-100'
          : selected
            ? 'ring-4 ring-pink-400'
            : 'ring-slate-100 hover:ring-slate-200'
      }`}
      onClick={() => {
        if (isEditing) {
          return
        }

        onToggleThread(thread.id)
      }}
    >
      <div
        className={`flex flex-col gap-4 ${
          isEditing ? '' : 'md:flex-row md:items-center md:justify-between'
        }`}
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-lg font-medium text-slate-500">
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div
                className="w-full max-w-full"
                onClick={(event) => event.stopPropagation()}
                ref={editFormRef}
              >
                <div className="grid w-full max-w-full items-end gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)]">
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Title
                    </span>
                    <input
                      autoFocus
                      className={`${editControlClass} border-cyan-300 text-base text-slate-950 ring-cyan-100`}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          saveEdit()
                        }

                        if (event.key === 'Escape') {
                          setDraftSubject(thread.subject)
                          setDraftPriority(thread.priority)
                          setDraftDueDate(thread.dueDate ?? '')
                          setIsEditing(false)
                        }
                      }}
                      value={draftSubject}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Priority
                    </span>
                    <select
                      className={`${editControlClass} bg-white capitalize`}
                      onChange={(event) =>
                        setDraftPriority(event.target.value as EmailThread['priority'])
                      }
                      value={draftPriority}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due date
                    </span>
                    <input
                      className={editControlClass}
                      onChange={(event) => setDraftDueDate(event.target.value)}
                      placeholder="Due date"
                      value={draftDueDate}
                    />
                  </label>
                </div>
                <button
                  className="mt-3 h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
                  onClick={(event) => {
                    event.stopPropagation()
                    saveEdit()
                  }}
                  type="button"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-md border px-3 py-1 text-lg font-semibold capitalize ${priorityStyles[thread.priority]}`}
                >
                  {thread.priority}
                </span>
                {thread.dueDate ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-4 py-2 text-lg font-semibold text-white"
                    title={
                      thread.dueDateSource === 'user'
                        ? 'Due date set by user'
                        : 'Due date generated from email'
                    }
                  >
                    Due {thread.dueDate}
                  </span>
                ) : null}
                {selected && thread.needsReply ? (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-lg font-semibold text-amber-700">
                    Needs reply
                  </span>
                ) : null}
                {readonly ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-lg font-semibold capitalize text-emerald-700">
                    {thread.status}
                  </span>
                ) : null}
              </div>
            )}

            {!isEditing ? (
              <h4
                className={`mt-4 text-base font-semibold leading-snug ${
                  thread.status === 'reviewed'
                    ? 'text-slate-700 line-through decoration-emerald-500 decoration-2'
                    : 'text-slate-950'
                }`}
              >
                {thread.subject}
              </h4>
            ) : null}

            {!isEditing ? (
              <div className="mt-2 space-y-2 text-base leading-7 text-slate-500">
                <p className="leading-6">
                  <span className={selected ? detailLabelClass : undefined}>
                    Summary:
                  </span>{' '}
                  {thread.shortSummary}
                </p>
                {!selected ? (
                  <p className="leading-6">
                    <span>Participants:</span>{' '}
                    {formatCollapsedParticipants(thread.participants)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selected && !isEditing ? (
              <div className="mt-3 grid gap-2 rounded-md bg-violet-50 px-4 py-3 text-base leading-7 text-slate-500 ring-1 ring-violet-100">
                <p>
                  <span className={detailLabelClass}>Participants:</span>{' '}
                  {thread.participants.join(', ')}
                </p>
                <p>
                  <span className={detailLabelClass}>From:</span>{' '}
                  {formatSenderName(thread.latestEmail.sender)}
                </p>
                {thread.latestEmail.recipients?.length ? (
                  <p>
                    <span className={detailLabelClass}>To:</span>{' '}
                    {thread.latestEmail.recipients.map(formatSenderName).join(', ')}
                  </p>
                ) : null}
                <p>
                  <span className={detailLabelClass}>Subject:</span>{' '}
                  {thread.subject}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {!readonly && !isEditing ? (
          <div className="flex shrink-0 flex-wrap gap-5 md:justify-end">
            <IconButton
              label="Mark as reviewed"
              onClick={(event) => {
                event.stopPropagation()
                onMarkReviewed(thread.id)
              }}
              tone="done"
            >
              <CheckIcon />
            </IconButton>
            <a
              aria-label="Reply"
              className="flex size-10 items-center justify-center rounded-md bg-white text-lg text-slate-600 transition hover:bg-slate-50"
              href={createReplyHref(thread)}
              onClick={(event) => event.stopPropagation()}
              title="Reply"
            >
              <ReplyIcon />
            </a>
            <IconButton
              label="Edit thread"
              onClick={(event) => {
                event.stopPropagation()
                setDraftSubject(thread.subject)
                setDraftPriority(thread.priority)
                setDraftDueDate(thread.dueDate ?? '')
                setIsEditing(true)
              }}
              tone="neutral"
            >
              <EditIcon />
            </IconButton>
          </div>
        ) : null}

        {readonly ? (
          <button
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
            onClick={(event) => {
              event.stopPropagation()
              onRestoreThread?.(thread.id)
            }}
            type="button"
          >
            Move Back
          </button>
        ) : null}
      </div>
    </article>
  )
}

type ThreadGroups = {
  reviewed: EmailThread[]
  suggested: EmailThread[]
}

const archiveCopy: Record<EmailThread['status'], string> = {
  suggested: '',
  reviewed: 'No reviewed conversations yet.',
}

function ThreadArchiveSection({
  label,
  onRestoreThread,
  onToggleThread,
  selectedThreadId,
  threads,
}: {
  label: string
  onRestoreThread: (threadId: string) => void
  onToggleThread: (threadId: string) => void
  selectedThreadId: string | null
  threads: EmailThread[]
}) {
  return (
    <details className="rounded-lg border-t border-white/20 bg-transparent">
      <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-slate-300">
        {label} ({threads.length})
      </summary>
      <div className="space-y-3 border-t border-white/10 p-3">
        {threads.length > 0 ? (
          threads.map((thread, index) => (
            <ThreadCard
              index={index}
              key={thread.id}
              onEditThread={() => undefined}
              onMarkReviewed={() => undefined}
              onRestoreThread={onRestoreThread}
              onToggleThread={onToggleThread}
              readonly
              selected={selectedThreadId === thread.id}
              thread={thread}
            />
          ))
        ) : (
          <p className="px-2 py-3 text-lg text-slate-400">
            {archiveCopy.reviewed}
          </p>
        )}
      </div>
    </details>
  )
}

function groupThreadsByStatus(threads: EmailThread[]): ThreadGroups {
  return threads.reduce<ThreadGroups>(
    (groups, thread) => {
      groups[thread.status].push(thread)
      return groups
    },
    {
      reviewed: [],
      suggested: [],
    },
  )
}

const priorityStyles: Record<EmailThread['priority'], string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  medium: 'border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
}

const editControlClass =
  'h-11 w-full min-w-0 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100'

const detailLabelClass =
  'font-medium text-slate-600 underline decoration-slate-300 decoration-1 underline-offset-4'

function formatCollapsedParticipants(participants: string[]) {
  const visibleParticipants = participants.slice(0, 3)
  const hiddenCount = participants.length - visibleParticipants.length

  if (hiddenCount <= 0) {
    return visibleParticipants.join(', ')
  }

  return `${visibleParticipants.join(', ')} +${hiddenCount}`
}

function formatSenderName(sender: string) {
  return sender.replace(/\s*<[^>]+>\s*$/, '').trim()
}

function createReplyHref(thread: EmailThread) {
  const latestEmail = thread.latestEmail
  const recipientCandidates =
    latestEmail.direction === 'inbound'
      ? [latestEmail.sender]
      : (latestEmail.recipients ?? [])
  const recipients = recipientCandidates
    .map(extractEmailAddress)
    .filter((recipient) => recipient && !recipient.includes('me@'))

  const subject = latestEmail.subject.toLowerCase().startsWith('re:')
    ? latestEmail.subject
    : `Re: ${latestEmail.subject}`
  const query = new URLSearchParams({
    subject,
    body: `\n\nOn ${new Date(latestEmail.date).toLocaleString()}, ${formatSenderName(
      latestEmail.sender,
    )} wrote:\n${latestEmail.body}`,
  })

  return `mailto:${recipients.join(',')}?${query.toString()}`
}

function extractEmailAddress(value: string) {
  const emailMatch = value.match(/<([^>]+)>/)
  return (emailMatch?.[1] ?? value).trim()
}

function IconButton({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode
  label: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
  tone: 'done' | 'neutral'
}) {
  const toneClass = {
    done: 'text-emerald-600 hover:bg-emerald-50',
    neutral: 'text-slate-600 hover:bg-slate-50',
  }[tone]

  return (
    <button
      aria-label={label}
      className={`flex size-10 items-center justify-center rounded-md bg-white text-lg transition ${toneClass}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function CheckIcon() {
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
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function EditIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function ReplyIcon() {
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
      <path d="m9 17-5-5 5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}
