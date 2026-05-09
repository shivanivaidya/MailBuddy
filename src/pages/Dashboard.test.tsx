import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '@/pages/Dashboard'

function openDateFilter() {
  fireEvent.click(screen.getByRole('button', { name: /Apr 27.*48 emails/i }))
  return screen.getAllByLabelText('Date range value') as HTMLInputElement[]
}

function setDateRange(startDate: string, endDate: string) {
  const [startInput, endInput] = openDateFilter()

  fireEvent.change(startInput, { target: { value: startDate } })
  fireEvent.change(endInput, { target: { value: endDate } })
}

function closestArticle(text: string | RegExp) {
  const article = screen
    .getAllByText(text)
    .map((element) => element.closest('article'))
    .find((candidate): candidate is HTMLElement => Boolean(candidate))

  if (!article) {
    throw new Error(`Expected ${String(text)} to be inside an article`)
  }

  return article
}

function openAssistantChat() {
  fireEvent.click(screen.getByRole('button', { name: /Ask MailBuddy/i }))
  return screen.getByPlaceholderText('Ask MailBuddy anything...')
}

describe('Dashboard integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders extracted quick actions and supports edit, mark done, and dismiss flows', async () => {
    render(<Dashboard />)

    fireEvent.change(openAssistantChat(), {
      target: { value: 'Has Priya responded about team retreat?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(screen.getByText('Checking MailBuddy data...')).toBeInTheDocument()
    expect(await screen.findByText(/Yes, Priya Shah replied/i)).toBeInTheDocument()

    expect(screen.getByText('Pay upcoming bill')).toBeInTheDocument()
    expect(
      screen.getByText('Follow up with Dana Repairs about Kitchen repair estimate'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('No response received yet.').length).toBe(2)
    expect(screen.getByRole('button', { name: /Quick actions\s*15/i })).toBeInTheDocument()

    const billCard = closestArticle('Pay upcoming bill')
    fireEvent.click(within(billCard).getByRole('button', { name: 'Edit' }))
    expect(within(billCard).queryByRole('button', { name: 'Move Back' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('Pay upcoming bill'), {
      target: { value: 'Pay utility bill today' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Pay utility bill today')).toBeInTheDocument()

    fireEvent.click(
      within(closestArticle('Pay utility bill today')).getByRole('button', {
        name: 'Mark done',
      }),
    )
    expect(screen.getByRole('button', { name: /Quick actions\s*14/i })).toBeInTheDocument()

    fireEvent.click(
      within(closestArticle('Sign and return permission slip')).getByRole(
        'button',
        {
          name: 'Dismiss',
        },
      ),
    )
    expect(screen.getByRole('button', { name: /Quick actions\s*13/i })).toBeInTheDocument()
  })

  it('closes quick action editing when clicking outside the edit controls', () => {
    render(<Dashboard />)

    const billCard = closestArticle('Pay upcoming bill')
    fireEvent.click(within(billCard).getByRole('button', { name: 'Edit' }))
    expect(screen.getByDisplayValue('Pay upcoming bill')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByDisplayValue('Pay upcoming bill')).not.toBeInTheDocument()
    expect(screen.getByText('Pay upcoming bill')).toBeInTheDocument()
  })

  it('opens source email previews from completed and dismissed quick actions', () => {
    render(<Dashboard />)

    fireEvent.click(
      within(closestArticle('Pay upcoming bill')).getByRole('button', {
        name: 'Mark done',
      }),
    )
    fireEvent.click(screen.getByText('Completed (1)'))
    fireEvent.click(closestArticle('Pay upcoming bill'))

    expect(screen.getByText('Source email preview')).toBeInTheDocument()
    expect(
      screen.getAllByText(/Your April utility bill is due on May 5/i).length,
    ).toBeGreaterThan(0)

    fireEvent.click(
      within(closestArticle('Sign and return permission slip')).getByRole(
        'button',
        {
          name: 'Dismiss',
        },
      ),
    )
    fireEvent.click(screen.getByText('Dismissed (1)'))
    fireEvent.click(closestArticle('Sign and return permission slip'))

    expect(
      screen.getAllByText(/Please sign and return .* science museum/i).length,
    ).toBeGreaterThan(0)
  })

  it('shows only the final assistant answer after finalization completes', async () => {
    let resolveFinalizer: (value: Response) => void = () => undefined
    const finalizerResponse = new Promise<Response>((resolve) => {
      resolveFinalizer = resolve
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url === '/api/assistant/plan') {
          return new Response(
            JSON.stringify({
              plan: {
                mode: 'tool_calls',
                toolCalls: [
                  {
                    arguments: {
                      priority: 'medium',
                      responseFormat: 'count',
                      status: 'suggested',
                    },
                    tool: 'listQuickActions',
                  },
                ],
              },
            }),
            { status: 200 },
          )
        }

        if (url === '/api/assistant/finalize') {
          return finalizerResponse
        }

        return new Response(null, { status: 404 })
      }) as typeof fetch,
    )

    render(<Dashboard />)

    fireEvent.change(openAssistantChat(), {
      target: { value: 'How many medium priority tasks are there?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByText('Checking MailBuddy data...')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/assistant/finalize',
      expect.any(Object),
    ))
    expect(screen.queryByText('You have 3 medium priority tasks.')).not.toBeInTheDocument()

    resolveFinalizer(
      new Response(
        JSON.stringify({ message: 'Final answer only.' }),
        { status: 200 },
      ),
    )

    expect(await screen.findByText('Final answer only.')).toBeInTheDocument()
    expect(screen.queryByText('Checking MailBuddy data...')).not.toBeInTheDocument()
  })

  it('answers the today quick question with highest priority quick actions', async () => {
    render(<Dashboard />)

    fireEvent.change(openAssistantChat(), {
      target: { value: 'What do I need to do today?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText(/High priority: Pay upcoming bill/i))
      .toBeInTheDocument()
    expect(screen.getAllByText(/Submit registration before deadline/i).length)
      .toBeGreaterThan(0)
    expect(screen.queryByText(/I didn.t find matching data/i)).not.toBeInTheDocument()
  })

  it('keeps the active assistant conversation visible until the chat closes', async () => {
    render(<Dashboard />)

    fireEvent.change(openAssistantChat(), {
      target: { value: 'What do I need to do today?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText(/High priority: Pay upcoming bill/i))
      .toBeInTheDocument()

    fireEvent.change(within(dialog).getByPlaceholderText('Ask MailBuddy anything...'), {
      target: { value: 'Was my Whole Foods order delivered?' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send message' }))

    expect(await within(dialog).findByText(/order placed on May 1, 2026 is out for delivery/i))
      .toBeInTheDocument()
    expect(within(dialog).getByText('What do I need to do today?')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Was my Whole Foods order delivered?'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/High priority: Pay upcoming bill/i))
      .toBeInTheDocument()
  })

  it('resets the assistant session when the chat window closes', async () => {
    render(<Dashboard />)

    fireEvent.change(openAssistantChat(), {
      target: { value: 'What do I need to do today?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText(/High priority: Pay upcoming bill/i))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    fireEvent.click(screen.getByRole('button', { name: /Ask MailBuddy/i }))

    expect(screen.queryByText(/High priority: Pay upcoming bill/i)).not.toBeInTheDocument()
    expect(screen.getByText('Start a conversation with MailBuddy')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask MailBuddy anything...')).toHaveValue('')
  })

  it('shows empty states in every tab when the global date range has no data', () => {
    render(<Dashboard />)

    setDateRange('2026-04-26', '2026-04-26')

    expect(screen.getByText('No data found for this date range')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick actions\s*0/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Conversations\s*0/i }))
    expect(screen.getByText('No data found for this date range')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*0/i }))
    expect(screen.getByText('No data found for this date range.')).toBeInTheDocument()
  })

  it('allows the calendar picker to move the start date before the current start', () => {
    render(<Dashboard />)

    const [startInput] = openDateFilter()

    fireEvent.change(startInput, { target: { value: '2026-04-29' } })
    expect(startInput).toHaveValue('2026-04-29')

    fireEvent.click(screen.getByRole('button', { name: 'Start date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-04-27' }))

    expect(startInput).toHaveValue('2026-04-27')
  })

  it('collapses the calendar range when the selected end date is before the start date', () => {
    render(<Dashboard />)

    const [startInput] = openDateFilter()
    fireEvent.change(startInput, { target: { value: '2026-04-29' } })

    fireEvent.click(screen.getByRole('button', { name: 'End date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-04-28' }))

    const [updatedStartInput, updatedEndInput] = screen.getAllByLabelText(
      'Date range value',
    ) as HTMLInputElement[]
    expect(updatedStartInput).toHaveValue('2026-04-28')
    expect(updatedEndInput).toHaveValue('2026-04-28')
  })

  it('opens conversation context, supports reply links, and moves reviewed conversations', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Conversations\s*6/i }))
    fireEvent.click(closestArticle('Team retreat agenda'))

    expect(screen.getByText('Conversation context')).toBeInTheDocument()
    expect(
      screen.getByText(/Alex shared an initial agenda draft/i),
    ).toBeInTheDocument()
    expect(
      within(closestArticle('Team retreat agenda')).getByRole('link', {
        name: /Reply/i,
      }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:priya@studio.example'),
    )

    fireEvent.click(
      within(closestArticle('Team retreat agenda')).getByRole('button', {
        name: 'Mark as reviewed',
      }),
    )

    expect(screen.getByRole('button', { name: /Conversations\s*5/i })).toBeInTheDocument()
    expect(screen.getByText('Reviewed (1)')).toBeInTheDocument()
  })

  it('edits conversation titles and cancels conversation editing on outside click', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Conversations\s*6/i }))
    const teamThread = closestArticle('Team retreat agenda')

    fireEvent.click(within(teamThread).getByRole('button', { name: 'Edit thread' }))
    fireEvent.change(screen.getByDisplayValue('Team retreat agenda'), {
      target: { value: 'Team retreat planning' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Team retreat planning')).toBeInTheDocument()

    const editedThread = closestArticle('Team retreat planning')
    fireEvent.click(within(editedThread).getByRole('button', { name: 'Edit thread' }))
    fireEvent.change(screen.getByDisplayValue('Team retreat planning'), {
      target: { value: 'Unsaved conversation title' },
    })

    fireEvent.mouseDown(document.body)

    expect(screen.queryByDisplayValue('Unsaved conversation title')).not.toBeInTheDocument()
    expect(screen.getByText('Team retreat planning')).toBeInTheDocument()
  })

  it('opens order details with grouped source emails and structured refunds and replacements', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*11/i }))
    fireEvent.click(closestArticle('Order #WF-1048'))

    expect(screen.getByText('Order details')).toBeInTheDocument()
    expect(screen.getByText('Item replacement in your Whole Foods order')).toBeInTheDocument()
    expect(
      screen.getByText('Organic strawberries -> organic blueberries'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('$86.42').length).toBeGreaterThan(0)

    fireEvent.click(closestArticle('Order #IC-8831'))

    expect(screen.getByText('Refund confirmation for your Instacart order')).toBeInTheDocument()
    expect(screen.getByText('unavailable strawberries')).toBeInTheDocument()
    expect(screen.getAllByText('$12.49').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$51.69').length).toBeGreaterThan(0)
  })

  it('filters spend statistics by category within the selected date range', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*11/i }))
    let topMerchants = screen.getByLabelText('Top merchants')

    expect(within(topMerchants).getByText('Whole Foods Market')).toBeInTheDocument()
    expect(within(topMerchants).getByText('Sephora')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Beauty' }))
    topMerchants = screen.getByLabelText('Top merchants')

    expect(within(topMerchants).queryByText('Whole Foods Market')).not.toBeInTheDocument()
    expect(within(topMerchants).getByText('Sephora')).toBeInTheDocument()
    expect(within(topMerchants).getByText('Ulta Beauty')).toBeInTheDocument()
    expect(screen.getAllByText('$115.07').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Dining' }))
    topMerchants = screen.getByLabelText('Top merchants')

    expect(within(topMerchants).queryByText('Sephora')).not.toBeInTheDocument()
    expect(within(topMerchants).getByText('Thai Garden')).toBeInTheDocument()
    expect(screen.getAllByText('$37.26').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    topMerchants = screen.getByLabelText('Top merchants')

    expect(within(topMerchants).getByText('Whole Foods Market')).toBeInTheDocument()
    expect(within(topMerchants).getByText('Sephora')).toBeInTheDocument()
  })

  it('filters update cards by status and merchant and closes dropdowns on outside click', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*11/i }))

    fireEvent.click(screen.getByRole('button', { name: 'All statuses' }))
    expect(screen.getByRole('button', { name: 'delivered' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('button', { name: 'delivered' }))
      .not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All statuses' }))
    fireEvent.click(screen.getByRole('button', { name: 'delivered' }))

    expect(screen.getByRole('button', { name: '1 status selected' }))
      .toBeInTheDocument()
    expect(screen.getAllByText('delivered').length).toBeGreaterThan(0)
    expect(screen.queryByText('Order #GP-4482')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All merchants' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sephora' }))

    expect(screen.getByRole('button', { name: '1 merchant selected' }))
      .toBeInTheDocument()
    expect(closestArticle('Sephora')).toBeInTheDocument()
    expect(screen.queryByText('Order #WF-1048')).not.toBeInTheDocument()
  })
})
