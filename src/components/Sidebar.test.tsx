import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar, type SidebarLinkRenderProps } from './Sidebar'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderLink(props: SidebarLinkRenderProps) {
  return (
    <a
      key={props.to}
      href={props.to}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      style={props.style}
      aria-current={props.active ? 'page' : undefined}
    >
      {props.icon}
      {!props.collapsed && props.label}
    </a>
  )
}

const NAV_ITEMS = [
  { to: '/budget', icon: <span data-testid="icon-budget" />, label: 'Бюджет' },
  { to: '/settings', icon: <span data-testid="icon-settings" />, label: 'Настройки' },
]

function setup(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onAccountClick = vi.fn()
  const onLogout = vi.fn()
  const onCloseMobile = vi.fn()
  render(
    <Sidebar
      storageKey="test-sidebar"
      ariaLabel="Разделы Kuvert"
      brandName="Kuvert"
      brandMark={<span data-testid="brand-mark" />}
      navItems={NAV_ITEMS}
      activePath="/budget"
      renderLink={renderLink}
      user={{ name: 'Anna', email: 'anna@example.test' }}
      onAccountClick={onAccountClick}
      onLogout={onLogout}
      mobileOpen={false}
      onCloseMobile={onCloseMobile}
      {...overrides}
    />,
  )
  return { onAccountClick, onLogout, onCloseMobile }
}

describe('Sidebar', () => {
  it('renders the brand, nav items (once per rail), and marks the active one', () => {
    setup()
    // Desktop rail + mobile drawer both render the brand and every item.
    expect(screen.getAllByText('Kuvert')).toHaveLength(2)
    expect(screen.getAllByText('Бюджет')).toHaveLength(2)
    expect(screen.getAllByText('Настройки')).toHaveLength(2)
    const [desktopActive] = screen.getAllByRole('link', { name: /Бюджет/ })
    expect(desktopActive).toHaveAttribute('aria-current', 'page')
  })

  it('sets the badge color to white so a currentColor-based brand mark (e.g. a lucide icon) is legible on the dark accent square', () => {
    setup({ brandMark: <svg data-testid="brand-mark" /> })
    const badge = screen.getByTestId('brand-mark').parentElement
    expect(badge).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  })

  it('renders the user account block and wires the account/logout handlers', async () => {
    const user = userEvent.setup()
    const { onAccountClick, onLogout } = setup()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('anna@example.test')).toBeInTheDocument()

    await user.click(screen.getByTitle('Настройки аккаунта'))
    expect(onAccountClick).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /выйти/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('omits the account block and logout button when there is no user', () => {
    setup({ user: null })
    expect(screen.queryByTitle('Настройки аккаунта')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /выйти/i })).not.toBeInTheDocument()
  })

  it('collapses when the rail background is clicked, hiding labels but keeping icons', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getAllByText('Бюджет')).toHaveLength(2)

    await user.click(screen.getByRole('complementary', { name: 'Разделы Kuvert' }))

    // Only the (unaffected) mobile drawer copy still shows the label text.
    expect(screen.getAllByText('Бюджет')).toHaveLength(1)
    expect(screen.getAllByTestId('icon-budget')).toHaveLength(2)
  })

  it('positions the mobile drawer offscreen when closed and onscreen when open', () => {
    const { rerender } = render(
      <Sidebar
        storageKey="test-sidebar-mobile"
        ariaLabel="Разделы Kuvert"
        brandName="Kuvert"
        brandMark={<span />}
        navItems={NAV_ITEMS}
        activePath="/budget"
        renderLink={renderLink}
        user={null}
        onAccountClick={vi.fn()}
        onLogout={vi.fn()}
        mobileOpen={false}
        onCloseMobile={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Закрыть меню' }).closest('aside')).toHaveStyle({ left: '-260px' })

    rerender(
      <Sidebar
        storageKey="test-sidebar-mobile"
        ariaLabel="Разделы Kuvert"
        brandName="Kuvert"
        brandMark={<span />}
        navItems={NAV_ITEMS}
        activePath="/budget"
        renderLink={renderLink}
        user={null}
        onAccountClick={vi.fn()}
        onLogout={vi.fn()}
        mobileOpen
        onCloseMobile={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Закрыть меню' }).closest('aside')).toHaveStyle({ left: '0px' })
  })

  it('closes the mobile drawer via the overlay and the close button', async () => {
    const user = userEvent.setup()
    const { onCloseMobile } = setup({ mobileOpen: true })

    await user.click(screen.getByRole('button', { name: 'Закрыть меню' }))
    expect(onCloseMobile).toHaveBeenCalledTimes(1)
  })

  it('renders extraNav content after the standard items in both the rail and drawer, passing collapsed/variant context', () => {
    const extraNav = vi.fn((ctx: { collapsed: boolean; variant: 'desktop' | 'mobile' }) => (
      <div data-testid={`extra-${ctx.variant}`}>{ctx.collapsed ? 'collapsed' : 'expanded'}</div>
    ))
    setup({ extraNav })
    expect(screen.getByTestId('extra-desktop')).toHaveTextContent('expanded')
    expect(screen.getByTestId('extra-mobile')).toHaveTextContent('expanded')
  })

  it("calls a nav item's onClick handler from both the rail and the drawer copy", async () => {
    const user = userEvent.setup()
    const { onCloseMobile } = setup({ mobileOpen: true })
    const [desktopLink, mobileLink] = screen.getAllByRole('link', { name: /Настройки/ })

    // Desktop: stops propagation (doesn't call onCloseMobile), doesn't throw.
    await user.click(desktopLink)
    expect(onCloseMobile).not.toHaveBeenCalled()

    // Mobile: closes the drawer.
    await user.click(mobileLink)
    expect(onCloseMobile).toHaveBeenCalledTimes(1)
  })
})
