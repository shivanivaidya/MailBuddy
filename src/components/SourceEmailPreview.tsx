import type { ActionItem, Email, EmailThread, OrderUpdate } from '@/types/mail'
import { formatCurrency } from '@/utils/updateProcessing'

type SourceEmailPreviewProps = {
  action?: ActionItem | null
  email?: Email
  mode?: 'source' | 'thread' | 'updates'
  order?: OrderUpdate | null
  orderEmails?: Email[]
  thread?: EmailThread | null
}

export function SourceEmailPreview({
  action,
  email,
  mode = 'source',
  order,
  orderEmails = [],
  thread,
}: SourceEmailPreviewProps) {
  if (thread) {
    return <ThreadPreview thread={thread} />
  }

  if (order) {
    return <OrderPreview order={order} relatedEmails={orderEmails} />
  }

  if (!action || !email) {
    const isThreadMode = mode === 'thread'
    const isUpdatesMode = mode === 'updates'
    const heading = isThreadMode
      ? 'Conversation context'
      : isUpdatesMode
        ? 'Update details'
        : 'Source email preview'
    const description = isThreadMode
      ? 'Select a conversation to view the summarized context.'
      : isUpdatesMode
        ? 'Updates are extracted into structured records for future assistant queries.'
        : 'Every suggested task can be traced back to the email that produced it.'
    const emptyCopy = isThreadMode
      ? 'Select a conversation to view its context.'
      : isUpdatesMode
        ? 'Select an order update to view its details.'
        : 'Select a task to view its source email.'

    return (
      <aside className="rounded-lg border border-dashed border-slate-200 bg-white/80 shadow-sm xl:sticky xl:top-6 xl:self-start">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">
            {heading}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="p-5">
          <div className="rounded-lg bg-slate-50 px-5 py-10 text-center">
            <p className="font-semibold text-slate-950">{emptyCopy}</p>
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

function OrderPreview({
  order,
  relatedEmails,
}: {
  order: OrderUpdate
  relatedEmails: Email[]
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white/90 shadow-sm xl:sticky xl:top-6 xl:self-start">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">
          Order details
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Structured order data grouped from related source emails.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Merchant</p>
              <p className="mt-1 font-semibold text-slate-950">
                {order.merchantName}
              </p>
            </div>
            <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-semibold capitalize text-white">
              {formatStatus(order.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Order number" value={`#${order.orderNumber}`} />
            <Detail label="Order date" value={formatEmailDate(order.orderDate)} />
            <Detail
              label="Delivery status"
              value={formatStatus(order.deliveryStatus)}
            />
            <Detail
              label="Expected delivery"
              value={order.expectedDeliveryTime}
            />
            <Detail label="Delivered" value={order.deliveredTime} />
            <Detail label="Tracking number" value={order.trackingNumber} />
            <Detail label="Tracking details" value={order.trackingDetails} />
          </div>
        </div>

        {order.items?.length ? (
          <Section title="Items">
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <LineItem
                  key={item.name}
                  label={item.name}
                  value={formatCurrency(item.price)}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {order.replacedItems?.length ? (
          <Section title="Replacements">
            <div className="divide-y divide-slate-100">
              {order.replacedItems.map((item) => (
                <LineItem
                  key={`${item.originalItem}-${item.replacementItem}`}
                  label={`${item.originalItem} -> ${item.replacementItem}`}
                  value={
                    typeof item.priceDifference === 'number'
                      ? formatCurrency(item.priceDifference)
                      : undefined
                  }
                />
              ))}
            </div>
          </Section>
        ) : null}

        {order.refundedItems?.length ? (
          <Section title="Refunds">
            <div className="divide-y divide-slate-100">
              {order.refundedItems.map((item) => (
                <LineItem
                  key={item.name}
                  label={item.name}
                  value={formatCurrency(item.amount)}
                />
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Summary">
          <div className="divide-y divide-slate-100">
            <LineItem
              label="Order total"
              value={
                typeof order.orderTotal === 'number'
                  ? formatCurrency(order.orderTotal)
                  : undefined
              }
            />
            <LineItem
              label="Refund total"
              value={
                typeof order.refundTotal === 'number'
                  ? formatCurrency(order.refundTotal)
                  : formatCurrency(0)
              }
            />
            <LineItem
              label="Final charged"
              value={
                typeof order.finalChargedAmount === 'number'
                  ? formatCurrency(order.finalChargedAmount)
                  : undefined
              }
            />
          </div>
        </Section>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source emails
          </p>
          {relatedEmails.map((relatedEmail) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-4"
              key={relatedEmail.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {relatedEmail.subject}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {relatedEmail.sender} · {formatEmailDate(relatedEmail.date)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {createEmailReferenceSnippet(relatedEmail.body)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function LineItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-slate-700">{label}</span>
      {value ? (
        <span className="shrink-0 font-semibold text-slate-950">{value}</span>
      ) : null}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null
  }

  return (
    <div>
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function createEmailReferenceSnippet(body: string) {
  const withoutItems = body.replace(/\s*Items:\s*.*$/i, '').trim()
  const withoutOrderTotal = withoutItems
    .replace(/\s*Order total:\s*\$\d+(?:\.\d{2})?\./i, '.')
    .replace(/\s+/g, ' ')
    .trim()

  return withoutOrderTotal.length > 180
    ? `${withoutOrderTotal.slice(0, 177).trim()}...`
    : withoutOrderTotal
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

function formatStatus(value?: string) {
  return value?.replace(/_/g, ' ')
}
