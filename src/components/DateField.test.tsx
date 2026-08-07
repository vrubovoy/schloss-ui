import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateField } from './DateField'

afterEach(() => {
  cleanup()
})

describe('DateField', () => {
  it('renders a labelled trigger field findable via getByLabelText', () => {
    render(<DateField label="Дата" value="" onChange={vi.fn()} />)
    const trigger = screen.getByLabelText('Дата')
    expect(trigger).toBeInTheDocument()
  })

  it('shows a formatted dd.mm.yyyy display of a set value', () => {
    render(<DateField label="Дата" value="2026-07-15" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Дата')).toHaveValue('15.07.2026')
  })

  it.each([
    ['dmy', '15.07.2026'],
    ['mdy', '07/15/2026'],
    ['ymd', '2026-07-15'],
  ] as const)('formats the display using profile dateFormat=%s', (dateFormat, expected) => {
    render(
      <DateField
        label="Дата"
        value="2026-07-15"
        onChange={vi.fn()}
        dateFormat={dateFormat}
      />,
    )

    expect(screen.getByLabelText('Дата')).toHaveValue(expected)
  })

  it('shows an empty/placeholder display when value is ""', () => {
    render(<DateField label="Дата" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Дата')).toHaveValue('')
  })

  it('does not render a calendar popover before the trigger is clicked', () => {
    render(<DateField label="Дата" value="2026-07-15" onChange={vi.fn()} />)
    expect(screen.queryByLabelText('2026-07-15')).not.toBeInTheDocument()
  })

  it('opens a calendar popover on click, with the day matching the set value queryable by aria-label', async () => {
    const user = userEvent.setup()
    render(<DateField label="Дата" value="2026-07-15" onChange={vi.fn()} />)

    const trigger = screen.getByLabelText('Дата')
    await user.click(trigger)

    const dayButton = screen.getByRole('button', { name: '2026-07-15' })
    expect(dayButton).toBeInTheDocument()
  })

  it('calls onChange with the clicked day\'s ISO string and closes the popover', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateField label="Дата" value="2026-07-15" onChange={onChange} />)

    await user.click(screen.getByLabelText('Дата'))
    const dayButton = screen.getByRole('button', { name: '2026-07-20' })
    await user.click(dayButton)

    expect(onChange).toHaveBeenCalledWith('2026-07-20')
    expect(
      screen.queryByRole('button', { name: '2026-07-20' }),
    ).not.toBeInTheDocument()
  })

  it('shows the current month (containing the given value) when value is set to an earlier month', async () => {
    const user = userEvent.setup()
    render(<DateField label="Дата" value="2026-01-10" onChange={vi.fn()} />)

    await user.click(screen.getByLabelText('Дата'))

    expect(screen.getByRole('button', { name: '2026-01-10' })).toBeInTheDocument()
    // A date from a different month/year should not appear.
    expect(
      screen.queryByRole('button', { name: '2026-07-10' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    [0, ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], 7],
    [1, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], 6],
  ] as const)('uses weekStartsOn=%s for the headers and actual calendar grid', async (weekStartsOn, labels, expectedJuly5Index) => {
    const user = userEvent.setup()
    render(
      <DateField
        label="Дата"
        value="2026-07-15"
        onChange={vi.fn()}
        weekStartsOn={weekStartsOn}
      />,
    )

    await user.click(screen.getByLabelText('Дата'))

    const july5 = screen.getByRole('button', { name: '2026-07-05' })
    const dayGrid = july5.parentElement
    const weekdayGrid = dayGrid?.previousElementSibling
    expect(dayGrid).not.toBeNull()
    expect(Array.from(dayGrid!.children).indexOf(july5)).toBe(expectedJuly5Index)
    expect(Array.from(weekdayGrid?.children ?? []).map((cell) => cell.textContent)).toEqual(labels)
  })

  it('keeps the calendar Monday-first when weekStartsOn is omitted', async () => {
    const user = userEvent.setup()
    render(<DateField label="Дата" value="2026-07-15" onChange={vi.fn()} />)

    await user.click(screen.getByLabelText('Дата'))

    const july5 = screen.getByRole('button', { name: '2026-07-05' })
    expect(Array.from(july5.parentElement!.children).indexOf(july5)).toBe(6)
  })

  it('when the trigger is near the bottom of a short viewport, pulls the popover up just enough to stay on-screen, not far away from the trigger', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)

    // The anchor is DateField's own wrapper div, not the <input> the
    // label points at - mock every element uniformly rather than trying
    // to target one specific node.
    const gbcrSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute('role') === 'dialog') {
          // The popover is taller (340px) than the space actually left
          // below the trigger (600 - 584 = 16px) - it must be pulled up.
          const top = Number.parseFloat(this.style.top) || 0
          return { top, bottom: top + 340, left: 0, right: 280, width: 280, height: 340, x: 0, y: top, toJSON() {} } as DOMRect
        }
        // Every other element is treated as sitting near the bottom of
        // the (mocked) 600px viewport - including DateField's own
        // wrapper div, which is what position is actually computed from.
        return { top: 550, bottom: 580, left: 20, right: 200, width: 180, height: 30, x: 20, y: 550, toJSON() {} } as DOMRect
      })

    render(<DateField label="Дата" value="2026-07-15" onChange={vi.fn()} />)
    const trigger = screen.getByLabelText('Дата')

    await user.click(trigger)

    const popover = screen.getByRole('dialog')
    const finalTop = Number.parseFloat(popover.style.top)

    // Fits entirely within the (mocked) 600px-tall viewport...
    expect(finalTop + 340).toBeLessThanOrEqual(600)
    // ...while staying anchored near the trigger (top: 550), not jumping
    // to some unrelated part of the page.
    expect(finalTop).toBeGreaterThan(200)

    gbcrSpy.mockRestore()
  })
})
