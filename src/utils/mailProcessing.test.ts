import { describe, expect, it } from 'vitest'
import { sampleEmails } from '@/services/sampleData'
import { extractActionItems } from '@/utils/mailProcessing'

describe('extractActionItems', () => {
  it('creates action items for task-like emails and skips informational emails', () => {
    const actions = extractActionItems(sampleEmails)
    const actionEmailIds = actions.map((action) => action.emailId)

    expect(actionEmailIds).toContain('email_bill_due')
    expect(actionEmailIds).toContain('email_permission_slip')
    expect(actionEmailIds).toContain('email_delivery_issue')
    expect(actionEmailIds).toContain('email_sent_follow_up')
    expect(actionEmailIds).not.toContain('email_newsletter')
    expect(actionEmailIds).not.toContain('email_promotion')
    expect(actionEmailIds).not.toContain('email_receipt')
  })

  it('assigns useful titles, priority, due date, and source metadata', () => {
    const actions = extractActionItems(sampleEmails)
    const billAction = actions.find(
      (action) => action.emailId === 'email_bill_due',
    )

    expect(billAction).toMatchObject({
      title: 'Pay upcoming bill',
      priority: 'high',
      dueDate: 'may 5',
      dueDateSource: 'email',
      status: 'suggested',
      sourceSubject: 'Payment due for your April utility bill',
    })
    expect(billAction?.sourceSnippet).toContain('Your April utility bill')
  })
})
