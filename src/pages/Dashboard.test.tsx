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

describe('Dashboard integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders extracted quick actions and supports edit, mark done, and dismiss flows', async () => {
    render(<Dashboard />)

    fireEvent.change(screen.getByPlaceholderText('Ask about tasks, conversations, or orders'), {
      target: { value: 'Has Priya responded about team retreat?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
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

    fireEvent.change(screen.getByPlaceholderText('Ask about tasks, conversations, or orders'), {
      target: { value: 'How many medium priority tasks are there?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

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

  it('shows empty states in every tab when the global date range has no data', () => {
    render(<Dashboard />)

    setDateRange('2026-04-26', '2026-04-26')

    expect(screen.getByText('No data found for this date range')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick actions\s*0/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Conversations\s*0/i }))
    expect(screen.getByText('No data found for this date range.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*0/i }))
    expect(screen.getByText('No data found for this date range.')).toBeInTheDocument()
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
})
