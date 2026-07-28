import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Footer } from './Footer'

afterEach(() => {
  cleanup()
})

describe('Footer', () => {
  it('renders the exact open-source/self-hosted text for "Schloss"', () => {
    render(<Footer serviceName="Schloss" />)
    expect(
      screen.getByText('Schloss — открытый код, свой хостинг'),
    ).toBeInTheDocument()
  })

  it('renders the exact open-source/self-hosted text for "Kuvert"', () => {
    render(<Footer serviceName="Kuvert" />)
    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
  })

  it('renders a GitHub link pointing to the org, opening in a new tab, without a referrer', () => {
    render(<Footer serviceName="Schloss" />)

    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/zudaR107')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink.getAttribute('rel')).toEqual(
      expect.stringContaining('noreferrer'),
    )
  })

  it('renders the version text when a version is provided', () => {
    const { container } = render(
      <Footer serviceName="Kuvert" version="1.4.0" />,
    )

    expect(container.textContent).toContain('·')
    expect(container.textContent).toContain('v1.4.0')
    expect(container.textContent).toContain(
      'Kuvert — открытый код, свой хостинг · v1.4.0',
    )
  })

  it('does not render a version fragment when version is omitted', () => {
    const { container } = render(<Footer serviceName="Kuvert" />)

    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
    expect(container.textContent).not.toContain('·')
    expect(container.textContent).not.toContain('undefined')
  })

  it('does not render a version fragment when version is an empty string', () => {
    const { container } = render(<Footer serviceName="Kuvert" version="" />)

    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
    expect(container.textContent).not.toContain('·')
    expect(container.textContent).not.toContain('undefined')
  })

  it('renders both the service name and version simultaneously, alongside the GitHub link', () => {
    render(<Footer serviceName="Schloss" version="2.0.1" />)

    expect(
      screen.getByText('Schloss — открытый код, свой хостинг · v2.0.1'),
    ).toBeInTheDocument()

    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/zudaR107')
  })

  it('renders the description text when provided', () => {
    render(
      <Footer
        serviceName="Kuvert"
        description="конвертное бюджетирование"
      />,
    )

    expect(
      screen.getByText('конвертное бюджетирование'),
    ).toBeInTheDocument()
  })

  it('still renders the exact open-source/self-hosted text when a description is also provided', () => {
    render(
      <Footer
        serviceName="Kuvert"
        description="конвертное бюджетирование"
      />,
    )

    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
  })

  it('does not render extra description content when description is omitted', () => {
    const { container } = render(<Footer serviceName="Kuvert" />)

    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('конвертное бюджетирование'),
    ).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('undefined')
  })

  it('does not render extra description content when description is an empty string', () => {
    const { container } = render(
      <Footer serviceName="Kuvert" description="" />,
    )

    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('конвертное бюджетирование'),
    ).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('undefined')
  })

  it('renders both description and version simultaneously without interfering with each other', () => {
    render(
      <Footer
        serviceName="Kuvert"
        description="конвертное бюджетирование"
        version="1.4.0"
      />,
    )

    expect(
      screen.getByText('конвертное бюджетирование'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kuvert — открытый код, свой хостинг · v1.4.0'),
    ).toBeInTheDocument()
  })

  it('does not render a help link when helpHref is omitted', () => {
    render(<Footer serviceName="Kuvert" />)

    expect(
      screen.queryByRole('link', { name: 'Как пользоваться' }),
    ).not.toBeInTheDocument()
  })

  it('renders a help link with the default label when helpHref is provided', () => {
    render(<Footer serviceName="Kuvert" helpHref="/help" />)

    const helpLink = screen.getByRole('link', { name: 'Как пользоваться' })
    expect(helpLink).toHaveAttribute('href', '/help')
  })

  it('renders a help link with a custom label when helpLabel is also provided', () => {
    render(
      <Footer serviceName="Kuvert" helpHref="/help" helpLabel="Справка" />,
    )

    expect(
      screen.getByRole('link', { name: 'Справка' }),
    ).toHaveAttribute('href', '/help')
  })
})
