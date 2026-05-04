import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dashboard } from '@/pages/Dashboard'

function openDateFilter() {
  fireEvent.click(screen.getByRole('button', { name: /Apr 27.*28 emails/i }))
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
  it('renders extracted quick actions and supports edit, mark done, and dismiss flows', () => {
    render(<Dashboard />)

    expect(screen.getByText('Pay upcoming bill')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick actions\s*9/i })).toBeInTheDocument()

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
    expect(screen.getByRole('button', { name: /Quick actions\s*8/i })).toBeInTheDocument()

    fireEvent.click(
      within(closestArticle('Sign and return permission slip')).getByRole(
        'button',
        {
          name: 'Dismiss',
        },
      ),
    )
    expect(screen.getByRole('button', { name: /Quick actions\s*7/i })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /Conversations\s*3/i }))
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

    expect(screen.getByRole('button', { name: /Conversations\s*2/i })).toBeInTheDocument()
    expect(screen.getByText('Reviewed (1)')).toBeInTheDocument()
  })

  it('opens order details with grouped source emails and structured refunds and replacements', () => {
    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: /Updates\s*5/i }))
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
