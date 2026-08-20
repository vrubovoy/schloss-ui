import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NotFoundPage } from './NotFoundPage'

afterEach(() => {
  cleanup()
})

describe('NotFoundPage', () => {
  it('renders the default title and description when none are given', () => {
    render(<NotFoundPage homeHref="/" />)

    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
    expect(
      screen.getByText('Такой страницы не существует, либо она была перемещена.'),
    ).toBeInTheDocument()
  })

  it('renders custom title and description when given', () => {
    render(
      <NotFoundPage
        homeHref="/"
        title="Не то, что вы искали"
        description="Проверьте адрес страницы."
      />,
    )

    expect(screen.getByRole('heading', { name: 'Не то, что вы искали' })).toBeInTheDocument()
    expect(screen.getByText('Проверьте адрес страницы.')).toBeInTheDocument()
  })

  it('renders a "404" numeral when no illustration is given', () => {
    render(<NotFoundPage homeHref="/" />)

    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders the illustration instead of the "404" numeral when given', () => {
    render(<NotFoundPage homeHref="/" illustration={<svg data-testid="mascot" />} />)

    expect(screen.getByTestId('mascot')).toBeInTheDocument()
    expect(screen.queryByText('404')).not.toBeInTheDocument()
  })

  it('renders a home link pointing at homeHref with the default label', () => {
    render(<NotFoundPage homeHref="/dashboard" />)

    const link = screen.getByRole('link', { name: 'На главную' })
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('renders a custom homeLabel when given', () => {
    render(<NotFoundPage homeHref="/" homeLabel="Вернуться" />)

    expect(screen.getByRole('link', { name: 'Вернуться' })).toBeInTheDocument()
  })
})
