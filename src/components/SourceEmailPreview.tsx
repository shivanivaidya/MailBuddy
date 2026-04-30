import type { ActionItem, Email } from '@/types/mail'

type SourceEmailPreviewProps = {
  action?: ActionItem | null
  email?: Email
}

export function SourceEmailPreview({ action, email }: SourceEmailPreviewProps) {
  if (!action || !email) {
    return (
      <aside className="rounded-lg border border-dashed border-slate-300 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">
            Source email preview
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Every suggested task can be traced back to the email that produced
            it.
          </p>
        </div>
        <div className="p-5">
          <div className="rounded-lg bg-slate-50 px-5 py-10 text-center">
            <p className="font-semibold text-slate-950">
              Select a task to view its source email.
            </p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
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

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
