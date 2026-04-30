import { useMemo, useState } from 'react'
import type { ActionItem } from '@/types/mail'

type SuggestedTodoListProps = {
  actions: ActionItem[]
  onDismiss: (actionId: string) => void
  onEdit: (actionId: string, newTitle: string) => void
  onMarkDone: (actionId: string) => void
  onViewSource: (actionId: string) => void
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
  onEdit?: (actionId: string, newTitle: string) => void
  onMarkDone?: (actionId: string) => void
  onViewSource?: (actionId: string) => void
  readonly?: boolean
  selected?: boolean
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
  onViewSource,
  selectedActionId,
}: SuggestedTodoListProps) {
  const actionGroups = useMemo(() => groupActionsByStatus(actions), [actions])

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Suggested to-do list</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
            Suggested by MailBuddy from your sample emails. Review before
            acting.
          </p>
        </div>
        <span className="rounded-md bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950">
          {actionGroups.suggested.length} active suggestions
        </span>
      </div>

      <div className="space-y-4 bg-white p-4">
        {actionGroups.suggested.length > 0 ? (
          actionGroups.suggested.map((action, index) => (
            <ActionItemCard
              action={action}
              index={index}
              key={action.id}
              onDismiss={onDismiss}
              onEdit={onEdit}
              onMarkDone={onMarkDone}
              onViewSource={onViewSource}
              selected={selectedActionId === action.id}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-cyan-300 bg-cyan-50 p-8 text-center">
            <p className="font-semibold text-slate-950">
              No suggested tasks remaining
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Refresh the demo to restore the original sample task list.
            </p>
          </div>
        )}

        <ArchiveSection
          actions={actionGroups.completed}
          label="Completed"
          status="completed"
        />
        <ArchiveSection
          actions={actionGroups.dismissed}
          label="Dismissed"
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
  onViewSource,
  readonly = false,
  selected = false,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  function saveEdit() {
    const nextTitle = draftTitle.trim()

    if (nextTitle) {
      onEdit?.(action.id, nextTitle)
    }

    setDraftTitle(nextTitle || action.title)
    setIsEditing(false)
  }

  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition ${
        readonly
          ? action.status === 'completed'
            ? 'border-emerald-100 bg-emerald-50/40'
            : 'border-slate-100 bg-slate-50/70 opacity-75'
          : selected
            ? 'border-cyan-300 ring-4 ring-cyan-100 hover:border-cyan-300 hover:shadow-md'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          {typeof index === 'number' ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-sm font-semibold text-cyan-700">
              {index + 1}
            </div>
          ) : null}
          <div className="min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-2 sm:flex-row">
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
                <button
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={saveEdit}
                  type="button"
                >
                  Save
                </button>
              </div>
            ) : (
              <h4
                className={`text-base font-semibold ${
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

            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${priorityStyles[action.priority]}`}
              >
                {action.priority}
              </span>
              {action.dueDate ? (
                <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
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
            </div>
          </div>
        </div>

        {!readonly ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              onClick={() => onMarkDone?.(action.id)}
              type="button"
            >
              Mark Done
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                setDraftTitle(action.title)
                setIsEditing(true)
              }}
              type="button"
            >
              Edit
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => onDismiss?.(action.id)}
              type="button"
            >
              Dismiss
            </button>
            <button
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                selected
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => onViewSource?.(action.id)}
              type="button"
            >
              View Source
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 rounded-md bg-slate-50 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source
          </p>
          <p
            className={`mt-2 text-sm font-semibold ${
              action.status === 'dismissed' ? 'text-slate-500' : 'text-slate-950'
            }`}
          >
            {action.sourceSender}
          </p>
          <p className="mt-1 text-sm text-slate-600">{action.sourceSubject}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Why suggested
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {action.reason}
          </p>
        </div>
      </div>
    </article>
  )
}

function ArchiveSection({
  actions,
  label,
  status,
}: {
  actions: ActionItem[]
  label: string
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
            <ActionItemCard action={action} key={action.id} readonly />
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
