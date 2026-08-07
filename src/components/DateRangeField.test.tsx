import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangeField } from './DateRangeField'

afterEach(() => {
  cleanup()
})

// Builds an ISO yyyy-mm-dd string for the given day-of-month within the
// *current* real-world month/year, so tests relying on the picker's
// default (value === '') month stay valid regardless of when they run.
// Days 10/20 are safe picks: every month has at least 28 days.
function isoInCurrentMonth(day: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

function Controlled({
  initialStart = '',
  initialEnd = '',
  onChangeSpy,
}: {
  initialStart?: string
  initialEnd?: string
  onChangeSpy?: (start: string, end: string) => void
}) {
  const [range, setRange] = useState({ start: initialStart, end: initialEnd })
  return (
    <DateRangeField
      label="Период"
      start={range.start}
      end={range.end}
      onChange={(start: string, end: string) => {
        onChangeSpy?.(start, end)
        setRange({ start, end })
      }}
    />
  )
}

describe('DateRangeField', () => {
  it('renders a labelled trigger findable via getByLabelText', () => {
    render(<DateRangeField label="Период" start="" end="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Период')).toBeInTheDocument()
  })

  it('formats both dates using the optional profile dateFormat', () => {
    render(
      <DateRangeField
        label="Период"
        start="2026-07-10"
        end="2026-07-20"
        onChange={vi.fn()}
        dateFormat="mdy"
      />,
    )

    expect(screen.getByLabelText('Период')).toHaveValue('07/10/2026 – 07/20/2026')
  })

  it('keeps the default DMY display when dateFormat is omitted', () => {
    render(
      <DateRangeField
        label="Период"
        start="2026-07-10"
        end="2026-07-20"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Период')).toHaveValue('10.07.2026 – 20.07.2026')
  })

  it('forwards weekStartsOn=0 to the calendar header and day grid', async () => {
    const user = userEvent.setup()
    render(
      <DateRangeField
        label="Период"
        start="2026-07-10"
        end="2026-07-20"
        onChange={vi.fn()}
        weekStartsOn={0}
      />,
    )

    await user.click(screen.getByLabelText('Период'))

    const july5 = screen.getByRole('button', { name: '2026-07-05' })
    const dayGrid = july5.parentElement
    const weekdayGrid = dayGrid?.previousElementSibling
    expect(Array.from(dayGrid!.children).indexOf(july5)).toBe(7)
    expect(Array.from(weekdayGrid?.children ?? []).map((cell) => cell.textContent)).toEqual(
      ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    )
  })

  it('first click: sets start, leaves end unset, and keeps the popover open', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(
      <Controlled initialStart="" initialEnd="" onChangeSpy={onChangeSpy} />,
    )

    // With start and end both '', the popover opens on the current
    // real-world month.
    const day10 = isoInCurrentMonth(10)
    const day20 = isoInCurrentMonth(20)

    await user.click(screen.getByLabelText('Период'))
    await user.click(screen.getByRole('button', { name: day10 }))

    expect(onChangeSpy).toHaveBeenLastCalledWith(day10, '')
    // Popover stays open: day buttons are still present.
    expect(screen.getByRole('button', { name: day20 })).toBeInTheDocument()
  })

  it('second click on a later date: sets end and closes the popover', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(
      <Controlled
        initialStart="2026-07-10"
        initialEnd=""
        onChangeSpy={onChangeSpy}
      />,
    )

    await user.click(screen.getByLabelText('Период'))
    await user.click(screen.getByRole('button', { name: '2026-07-20' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith('2026-07-10', '2026-07-20')
    expect(
      screen.queryByRole('button', { name: '2026-07-20' }),
    ).not.toBeInTheDocument()
  })

  it('second click on the same date as start: results in start === end and closes the popover', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(
      <Controlled
        initialStart="2026-07-10"
        initialEnd=""
        onChangeSpy={onChangeSpy}
      />,
    )

    await user.click(screen.getByLabelText('Период'))
    await user.click(screen.getByRole('button', { name: '2026-07-10' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith('2026-07-10', '2026-07-10')
    expect(
      screen.queryByRole('button', { name: '2026-07-10' }),
    ).not.toBeInTheDocument()
  })

  it('second click on an EARLIER date than start: swaps so start is the earlier date and closes the popover', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(
      <Controlled
        initialStart="2026-07-20"
        initialEnd=""
        onChangeSpy={onChangeSpy}
      />,
    )

    await user.click(screen.getByLabelText('Период'))
    await user.click(screen.getByRole('button', { name: '2026-07-10' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith('2026-07-10', '2026-07-20')
    expect(
      screen.queryByRole('button', { name: '2026-07-10' }),
    ).not.toBeInTheDocument()
  })

  it('third click after a complete selection: restarts the range, new start set, end reset, popover stays open', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(
      <Controlled
        initialStart="2026-07-10"
        initialEnd="2026-07-20"
        onChangeSpy={onChangeSpy}
      />,
    )

    await user.click(screen.getByLabelText('Период'))
    await user.click(screen.getByRole('button', { name: '2026-07-05' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith('2026-07-05', '')
    // Popover does NOT auto-close: further day buttons remain present.
    expect(screen.getByRole('button', { name: '2026-07-25' })).toBeInTheDocument()
  })
})
