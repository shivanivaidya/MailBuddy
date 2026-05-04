import { useState } from 'react'
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
    <section className="rounded-lg bg-white/80 shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">
          Conversations
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Context-heavy email discussions summarized for review and reply.
        </p>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
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
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            No data found for this date range.
          </div>
        )}
        <ThreadArchiveSection
          label="Reviewed"
          onRestoreThread={onRestoreThread}
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

  function saveEdit() {
    onEditThread(thread.id, {
      dueDate: draftDueDate.trim(),
      priority: draftPriority,
    })
    setIsEditing(false)
  }

  return (
    <article
      className={`rounded-lg bg-white px-4 py-5 text-left shadow-sm ring-1 transition sm:px-5 ${
        readonly
          ? 'bg-slate-50/70 opacity-75 ring-slate-100'
          : selected
            ? 'ring-4 ring-cyan-100'
            : 'ring-slate-100 hover:ring-slate-200'
      }`}
      onClick={() => {
        if (!readonly) {
          onToggleThread(thread.id)
        }
      }}
    >
      <div
        className={`flex flex-col gap-4 ${
          isEditing ? '' : 'md:flex-row md:items-center md:justify-between'
        }`}
      >
        <div className="flex min-w-0 flex-1 gap-4 md:items-center">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 md:mt-0">
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div
                className="grid gap-3 lg:grid-cols-[150px_170px_auto]"
                onClick={(event) => event.stopPropagation()}
              >
                <select
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) =>
                    setDraftPriority(event.target.value as EmailThread['priority'])
                  }
                  value={draftPriority}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setDraftDueDate(event.target.value)}
                  placeholder="Due date"
                  value={draftDueDate}
                />
                <button
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
              <h4
                className={`text-lg font-semibold leading-snug sm:text-xl ${
                  thread.status === 'reviewed'
                    ? 'text-slate-500'
                    : 'text-slate-950'
                }`}
              >
                {thread.subject}
              </h4>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${priorityStyles[thread.priority]}`}
              >
                {thread.priority}
              </span>
              {thread.dueDate ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white"
                  title={
                    thread.dueDateSource === 'user'
                      ? 'Due date set by user'
                      : 'Due date generated from email'
                  }
                >
                  {thread.dueDateSource === 'user' ? (
                    <UserDateIcon />
                  ) : (
                    <GeneratedDateIcon />
                  )}
                  Due {thread.dueDate}
                </span>
              ) : null}
              {selected && thread.needsReply ? (
                <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                  Needs reply
                </span>
              ) : null}
              {readonly ? (
                <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-500">
                  {thread.status}
                </span>
              ) : null}
            </div>

            {!isEditing ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="leading-6">
                  <span className="font-medium text-slate-500">Summary:</span>{' '}
                  {thread.shortSummary}
                </p>
                {!selected ? (
                  <p className="leading-6">
                    <span className="font-medium text-slate-500">
                      Participants:
                    </span>{' '}
                    {formatCollapsedParticipants(thread.participants)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selected && !isEditing ? (
              <div className="mt-3 grid gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">
                <p>
                  <span className="font-medium text-slate-500">
                    Participants:
                  </span>{' '}
                  {thread.participants.join(', ')}
                </p>
                <p>
                  <span className="font-medium text-slate-500">From:</span>{' '}
                  {formatSenderName(thread.latestEmail.sender)}
                </p>
                <p>
                  <span className="font-medium text-slate-500">Subject:</span>{' '}
                  {thread.subject}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {!readonly && !isEditing ? (
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
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
              className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
              href={createReplyHref(thread)}
              onClick={(event) => event.stopPropagation()}
              title="Reply"
            >
              <ReplyIcon />
              Reply
            </a>
            <IconButton
              label="Edit thread"
              onClick={(event) => {
                event.stopPropagation()
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
  threads,
}: {
  label: string
  onRestoreThread: (threadId: string) => void
  threads: EmailThread[]
}) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
        {label} ({threads.length})
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3">
        {threads.length > 0 ? (
          threads.map((thread, index) => (
            <ThreadCard
              index={index}
              key={thread.id}
              onEditThread={() => undefined}
              onMarkReviewed={() => undefined}
              onRestoreThread={onRestoreThread}
              onToggleThread={() => undefined}
              readonly
              selected={false}
              thread={thread}
            />
          ))
        ) : (
          <p className="px-2 py-3 text-sm text-slate-500">
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
    done: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    neutral: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  }[tone]

  return (
    <button
      aria-label={label}
      className={`flex size-9 items-center justify-center rounded-md border transition ${toneClass}`}
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

function GeneratedDateIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  )
}

function UserDateIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3"
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
