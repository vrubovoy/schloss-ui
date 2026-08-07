import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

afterEach(() => {
  cleanup()
})

describe('Button', () => {
  it('renders as a button element with its children as content', () => {
    render(<Button>Сохранить</Button>)
    const button = screen.getByRole('button', { name: 'Сохранить' })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('renders successfully with no variant prop passed at all', () => {
    expect(() => render(<Button>No variant</Button>)).not.toThrow()
    expect(screen.getByRole('button', { name: 'No variant' })).toBeInTheDocument()
  })

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders successfully with variant="%s" explicitly passed',
    (variant) => {
      expect(() =>
        render(<Button variant={variant}>Label {variant}</Button>),
      ).not.toThrow()
      expect(
        screen.getByRole('button', { name: `Label ${variant}` }),
      ).toBeInTheDocument()
    },
  )

  it('calls onClick exactly once per click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)

    await user.click(screen.getByRole('button', { name: 'Click me' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('has the disabled attribute when disabled is passed, and does not fire onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled button
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Disabled button' })
    expect(button).toBeDisabled()

    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })

  it('honors an explicitly-passed aria-label as the accessible name', () => {
    render(<Button aria-label="Custom label">Icon</Button>)
    expect(
      screen.getByRole('button', { name: 'Custom label' }),
    ).toBeInTheDocument()
  })

  it('honors an explicitly-passed type prop instead of silently overriding it', () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('passes through custom className and additional standard HTML attributes', () => {
    render(
      <Button className="my-custom-class" data-testid="my-button">
        Passthrough
      </Button>,
    )
    const button = screen.getByTestId('my-button')
    expect(button).toHaveClass('my-custom-class')
  })

  it('uses the contrast text token for the secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>)

    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveStyle({
      color: 'var(--accent-text)',
    })
  })

  it('shows a focus ring for keyboard focus and preserves focus handlers', async () => {
    const user = userEvent.setup()
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    render(<Button onFocus={onFocus} onBlur={onBlur}>Focusable</Button>)
    const button = screen.getByRole('button', { name: 'Focusable' })

    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveStyle({
      outline: '2px solid var(--text-primary)',
      outlineOffset: '2px',
    })
    expect(onFocus).toHaveBeenCalledTimes(1)

    await user.tab()
    expect(button.style.outline).toBe('none')
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('Button hover feedback', () => {
  it('changes the background on hover for the default (primary) variant and reverts on unhover', async () => {
    const user = userEvent.setup()
    render(<Button>Hover me</Button>)
    const button = screen.getByRole('button', { name: 'Hover me' })

    const originalBackground = button.style.background

    await user.hover(button)
    expect(button.style.background).not.toBe(originalBackground)

    await user.unhover(button)
    expect(button.style.background).toBe(originalBackground)
  })

  it('changes the background on hover for the ghost variant and reverts on unhover', async () => {
    const user = userEvent.setup()
    render(<Button variant="ghost">Hover ghost</Button>)
    const button = screen.getByRole('button', { name: 'Hover ghost' })

    const originalBackground = button.style.background

    await user.hover(button)
    expect(button.style.background).not.toBe(originalBackground)

    await user.unhover(button)
    expect(button.style.background).toBe(originalBackground)
  })
})
