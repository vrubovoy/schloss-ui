import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

afterEach(() => {
  cleanup()
})

describe('EmptyState', () => {
  it('renders the icon content', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
      />,
    )

    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
  })

  it('renders the title as a heading', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Нет конвертов' }),
    ).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'Создайте первый конверт, чтобы начать планирование бюджета',
      ),
    ).toBeInTheDocument()
  })

  it('renders an action button with accessible name matching actionLabel, and clicking it calls onAction once', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={onAction}
      />,
    )

    const actionButton = screen.getByRole('button', { name: 'Создать конверт' })
    await user.click(actionButton)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders the actionIcon inside/near the action button when provided', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
        actionIcon={<span data-testid="action-icon" />}
      />,
    )

    const actionButton = screen.getByRole('button', { name: 'Создать конверт' })
    const actionIcon = screen.getByTestId('action-icon')
    expect(actionButton).toContainElement(actionIcon)
  })

  it('renders correctly without an actionIcon, without error', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Создать конверт' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('action-icon')).not.toBeInTheDocument()
  })

  it('renders the illustration instead of the icon circle when given', () => {
    render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        illustration={<svg data-testid="empty-illustration" />}
        title="Нет конвертов"
        description="Создайте первый конверт, чтобы начать планирование бюджета"
        actionLabel="Создать конверт"
        onAction={vi.fn()}
      />,
    )

    expect(screen.getByTestId('empty-illustration')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-icon')).not.toBeInTheDocument()
  })
})
