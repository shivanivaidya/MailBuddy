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
    expect(actionEmailIds).toContain('email_sent_vendor_estimate')
    expect(actionEmailIds).toContain('email_sent_parent_meeting')
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

  it('creates follow-up tasks for unanswered meaningful sent emails', () => {
    const actions = extractActionItems(sampleEmails)

    expect(
      actions.find((action) => action.emailId === 'email_sent_vendor_estimate'),
    ).toMatchObject({
      priority: 'medium',
      reason: 'No response received yet.',
      sourceSender: 'Me',
      sourceSubject: 'Kitchen repair estimate',
      title: 'Follow up with Dana Repairs about Kitchen repair estimate',
    })
    expect(
      actions.find((action) => action.emailId === 'email_sent_parent_meeting'),
    ).toMatchObject({
      reason: 'No response received yet.',
      title: 'Follow up with Morgan Lee about Parent volunteer schedule',
    })
  })

  it('does not create follow-up tasks for sent emails with replies or sent FYI messages', () => {
    const actions = extractActionItems(sampleEmails)
    const actionEmailIds = actions.map((action) => action.emailId)

    expect(actionEmailIds).not.toContain('email_sent_caterer_question')
    expect(actionEmailIds).not.toContain('email_sent_fyi_notes')
  })
})
