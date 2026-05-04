import { useMemo, useState } from 'react'
import type { ActionItem, ActionItemEdit } from '@/types/mail'

type SuggestedTodoListProps = {
  actions: ActionItem[]
  onDismiss: (actionId: string) => void
  onEdit: (actionId: string, updates: ActionItemEdit) => void
  onMarkDone: (actionId: string) => void
  onRestore: (actionId: string) => void
  onToggleSource: (actionId: string) => void
  selectedActionId: string | null
}

const priorityStyles: Record<ActionItem['priority'], string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  medium: 'border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
}

const archiveCopy: Record<ActionItem['status'], string> = {
  suggested: '',
  completed: 'No completed tasks yet.',
  dismissed: 'No dismissed tasks yet.',
}

type TaskCardProps = {
  action: ActionItem
  index?: number
  onDismiss?: (actionId: string) => void
  onEdit?: (actionId: string, updates: ActionItemEdit) => void
  onMarkDone?: (actionId: string) => void
  onRestore?: (actionId: string) => void
  onToggleSource?: (actionId: string) => void
  onToggleSelected?: (actionId: string) => void
  readonly?: boolean
  selected?: boolean
  selectedForBulk?: boolean
}

type ActionGroups = {
  completed: ActionItem[]
  dismissed: ActionItem[]
  suggested: ActionItem[]
}

export function SuggestedTodoList({
  actions,
  onDismiss,
  onEdit,
  onMarkDone,
  onRestore,
  onToggleSource,
  selectedActionId,
}: SuggestedTodoListProps) {
  const actionGroups = useMemo(() => groupActionsByStatus(actions), [actions])
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  )
  const selectedSuggestedIds = actionGroups.suggested
    .filter((action) => selectedTaskIds.has(action.id))
    .map((action) => action.id)

  function toggleSelectedTask(actionId: string) {
    setSelectedTaskIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(actionId)) {
        nextIds.delete(actionId)
      } else {
        nextIds.add(actionId)
      }

      return nextIds
    })
  }

  function markDoneAndClearSelection(actionId: string) {
    onMarkDone(actionId)
    setSelectedTaskIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.delete(actionId)
      return nextIds
    })
  }

  function dismissAndClearSelection(actionId: string) {
    onDismiss(actionId)
    setSelectedTaskIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.delete(actionId)
      return nextIds
    })
  }

  function markSelectedDone() {
    selectedSuggestedIds.forEach((actionId) => onMarkDone(actionId))
    setSelectedTaskIds(new Set())
  }

  function dismissSelected() {
    selectedSuggestedIds.forEach((actionId) => onDismiss(actionId))
    setSelectedTaskIds(new Set())
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">Quick actions</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
            Suggested by MailBuddy from your sample emails. Review before
            acting.
          </p>
        </div>
        <span className="rounded-md bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950">
          {actionGroups.suggested.length} active suggestions
        </span>
      </div>

      <div className="space-y-5 bg-white p-4 sm:p-5">
        {selectedSuggestedIds.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              {selectedSuggestedIds.length} selected
            </p>
            <div className="flex gap-2">
              <IconButton
                label="Mark selected done"
                onClick={markSelectedDone}
                tone="done"
              >
                <CheckIcon />
              </IconButton>
              <IconButton
                label="Dismiss selected"
                onClick={dismissSelected}
                tone="dismiss"
              >
                <XIcon />
              </IconButton>
            </div>
          </div>
        ) : null}

        {actionGroups.suggested.length > 0 ? (
          actionGroups.suggested.map((action, index) => (
            <ActionItemCard
              action={action}
              index={index}
              key={action.id}
              onDismiss={dismissAndClearSelection}
              onEdit={onEdit}
              onMarkDone={markDoneAndClearSelection}
              onToggleSource={onToggleSource}
              onToggleSelected={toggleSelectedTask}
              selected={selectedActionId === action.id}
              selectedForBulk={selectedTaskIds.has(action.id)}
            />
          ))
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

        <ArchiveSection
          actions={actionGroups.completed}
          label="Completed"
          onRestore={onRestore}
          status="completed"
        />
        <ArchiveSection
          actions={actionGroups.dismissed}
          label="Dismissed"
          onRestore={onRestore}
          status="dismissed"
        />
      </div>
    </section>
  )
}

function ActionItemCard({
  action,
  index,
  onDismiss,
  onEdit,
  onMarkDone,
  onRestore,
  onToggleSource,
  onToggleSelected,
  readonly = false,
  selected = false,
  selectedForBulk = false,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showEmailMeta, setShowEmailMeta] = useState(false)
  const [draftDueDate, setDraftDueDate] = useState('')
  const [draftPriority, setDraftPriority] = useState<ActionItem['priority']>(
    action.priority,
  )
  const [draftTitle, setDraftTitle] = useState('')

  function saveEdit() {
    const nextTitle = draftTitle.trim()

    if (nextTitle) {
      onEdit?.(action.id, {
        dueDate: draftDueDate,
        priority: draftPriority,
        title: nextTitle,
      })
    }

    setDraftTitle(nextTitle || action.title)
    setIsEditing(false)
  }

  return (
    <article
      className={`rounded-lg bg-white px-4 py-5 shadow-sm ring-1 transition sm:px-5 ${
        readonly
          ? action.status === 'completed'
            ? 'bg-emerald-50/35 ring-emerald-100'
            : 'bg-slate-50/70 opacity-70 ring-slate-100'
          : selected
            ? 'ring-4 ring-cyan-100'
            : 'ring-slate-100 hover:ring-slate-200'
      }`}
      onClick={() => {
        setShowEmailMeta((isVisible) => !isVisible)
        onToggleSource?.(action.id)
      }}
    >
      <div
        className={`flex flex-col gap-4 ${
          isEditing ? '' : 'md:flex-row md:items-center md:justify-between'
        }`}
      >
        <div className="flex min-w-0 flex-1 gap-4 md:items-center">
          {!readonly ? (
            <input
              aria-label={`Select ${action.title}`}
              checked={selectedForBulk}
              className="mt-1 size-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 md:mt-0"
              onChange={() => onToggleSelected?.(action.id)}
              onClick={(event) => event.stopPropagation()}
              type="checkbox"
            />
          ) : null}
          {typeof index === 'number' ? (
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500 md:mt-0">
              {index + 1}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div
                className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_170px_auto]"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  autoFocus
                  className="min-w-0 rounded-md border border-cyan-300 px-3 py-2 text-base font-semibold text-slate-950 outline-none ring-cyan-100 focus:ring-4"
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      saveEdit()
                    }

                    if (event.key === 'Escape') {
                      setDraftTitle(action.title)
                      setIsEditing(false)
                    }
                  }}
                  value={draftTitle}
                />
                <select
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) =>
                    setDraftPriority(event.target.value as ActionItem['priority'])
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
                  action.status === 'completed'
                    ? 'text-slate-700 line-through decoration-emerald-500 decoration-2'
                    : action.status === 'dismissed'
                      ? 'text-slate-500'
                      : 'text-slate-950'
                }`}
              >
                {action.title}
              </h4>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${priorityStyles[action.priority]}`}
              >
                {action.priority}
              </span>
              {action.dueDate ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white"
                  title={
                    action.dueDateSource === 'user'
                      ? 'Due date set by user'
                      : 'Due date generated from email'
                  }
                >
                  {action.dueDateSource === 'user' ? (
                    <UserDateIcon />
                  ) : (
                    <GeneratedDateIcon />
                  )}
                  Due {action.dueDate}
                </span>
              ) : null}
              {readonly ? (
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${
                    action.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  }`}
                >
                  {action.status}
                </span>
              ) : null}
              {action.reason === 'No response received yet.' ? (
                <span className="rounded-md border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                  {action.reason}
                </span>
              ) : null}
            </div>

            {showEmailMeta && !isEditing ? (
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-100">
                <p>
                  <span className="font-medium text-slate-500">From:</span>{' '}
                  {formatSenderName(action.sourceSender)}
                </p>
                <p className="mt-1">
                  <span className="font-medium text-slate-500">Subject:</span>{' '}
                  {action.sourceSubject}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {!readonly && !isEditing ? (
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            <IconButton
              label="Mark done"
              onClick={(event) => {
                event.stopPropagation()
                onMarkDone?.(action.id)
              }}
              tone="done"
            >
              <CheckIcon />
            </IconButton>
            <IconButton
              label="Dismiss"
              onClick={(event) => {
                event.stopPropagation()
                onDismiss?.(action.id)
              }}
              tone="dismiss"
            >
              <XIcon />
            </IconButton>
            <IconButton
              label="Edit"
              onClick={(event) => {
                event.stopPropagation()
                setDraftTitle(action.title)
                setDraftPriority(action.priority)
                setDraftDueDate(action.dueDate ?? '')
                setIsEditing(true)
              }}
              tone="neutral"
            >
              <EditIcon />
            </IconButton>
          </div>
        ) : (
          <button
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
            onClick={(event) => {
              event.stopPropagation()
              onRestore?.(action.id)
            }}
            type="button"
          >
            Move Back
          </button>
        )}
      </div>
    </article>
  )
}

function formatSenderName(sender: string) {
  return sender.replace(/\s*<[^>]+>\s*$/, '').trim()
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
  tone: 'dismiss' | 'done' | 'neutral'
}) {
  const toneClass = {
    dismiss: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
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

function XIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

function ArchiveSection({
  actions,
  label,
  onRestore,
  status,
}: {
  actions: ActionItem[]
  label: string
  onRestore: (actionId: string) => void
  status: Extract<ActionItem['status'], 'completed' | 'dismissed'>
}) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
        {label} ({actions.length})
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3">
        {actions.length > 0 ? (
          actions.map((action) => (
            <ActionItemCard
              action={action}
              key={action.id}
              onRestore={onRestore}
              readonly
            />
          ))
        ) : (
          <p className="px-2 py-3 text-sm text-slate-500">
            {archiveCopy[status]}
          </p>
        )}
      </div>
    </details>
  )
}

function groupActionsByStatus(actions: ActionItem[]): ActionGroups {
  return actions.reduce<ActionGroups>(
    (groups, action) => {
      groups[action.status].push(action)
      return groups
    },
    {
      completed: [],
      dismissed: [],
      suggested: [],
    },
  )
}
