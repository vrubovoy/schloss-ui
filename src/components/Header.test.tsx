import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import type { ApiClient } from '../auth/apiClient'

afterEach(() => {
  cleanup()
})

function getHomeLink(container: HTMLElement): HTMLAnchorElement {
  const link = container.querySelector('a')
  if (!link) throw new Error('home link <a> not found')
  return link
}

describe('Header', () => {
  it('renders the home link as an <a> with the given href and title', () => {
    const { container } = render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/dashboard"
        homeTitle="Перейти на дашборд"
      />,
    )

    const homeLink = getHomeLink(container)
    expect(homeLink).toHaveAttribute('href', '/dashboard')
    expect(homeLink).toHaveAttribute('title', 'Перейти на дашборд')
  })

  it('defaults the home link title to "На главную" when homeTitle is omitted', () => {
    const { container } = render(
      <Header logo={<span>LOGO-MARKER</span>} homeHref="/" />,
    )

    const homeLink = getHomeLink(container)
    expect(homeLink).toHaveAttribute('title', 'На главную')
  })

  it('renders the logo content inside the home link', () => {
    const { container } = render(
      <Header
        logo={<span data-testid="logo-marker">LOGO-MARKER</span>}
        homeHref="/"
      />,
    )

    const homeLink = getHomeLink(container)
    const logo = screen.getByTestId('logo-marker')
    expect(homeLink).toContainElement(logo)
  })

  it('renders no settings, logout, or avatar when neither user nor rightSlot is provided', () => {
    const { container } = render(
      <Header logo={<span>LOGO-MARKER</span>} homeHref="/" />,
    )

    expect(
      screen.queryByRole('button', { name: 'Настройки' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Выйти' }),
    ).not.toBeInTheDocument()
    // Home link is the only element expected to carry a `title` attribute
    // (the avatar is the only other element the spec says gets one, and it
    // only appears when `user` is provided).
    expect(container.querySelectorAll('[title]')).toHaveLength(1)
  })

  it('renders rightSlot content but still no settings/logout/avatar when user is not provided', () => {
    const { container } = render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        rightSlot={<button type="button">THEME-TOGGLE</button>}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'THEME-TOGGLE' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Настройки' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Выйти' }),
    ).not.toBeInTheDocument()
    expect(container.querySelectorAll('[title]')).toHaveLength(1)
  })

  it('renders an avatar with the uppercased first letter and full name as title when user is provided', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
      />,
    )

    const avatar = screen.getByTitle('Роберт Эванс')
    expect(avatar).toHaveTextContent('Р')
    expect(avatar.textContent?.trim()).toBe('Р')
  })

  it('uppercases a lowercase first letter for the avatar initial', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'роберт эванс' }}
      />,
    )

    const avatar = screen.getByTitle('роберт эванс')
    expect(avatar.textContent?.trim()).toBe('Р')
  })

  it('renders the uploaded avatar image instead of the initial when avatarUrl is set', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Alice', avatarUrl: 'data:image/png;base64,xyz' }}
      />,
    )

    const avatar = screen.getByTitle('Alice')
    const img = avatar.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,xyz')
    expect(avatar.textContent?.trim()).toBe('')
  })

  it('falls back to the initial letter if the avatar image fails to load', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Alice', avatarUrl: 'data:image/png;base64,broken' }}
      />,
    )

    const avatar = screen.getByTitle('Alice')
    const img = avatar.querySelector('img')!
    fireEvent.error(img)

    expect(avatar.querySelector('img')).not.toBeInTheDocument()
    expect(avatar.textContent?.trim()).toBe('A')
  })

  it('renders the avatar as a settings control when user and onSettings are both provided, and clicking it calls onSettings once', async () => {
    // There is no separate gear icon anymore - the avatar itself is the
    // settings entry point when onSettings is given.
    const user = userEvent.setup()
    const onSettings = vi.fn()
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
        onSettings={onSettings}
      />,
    )

    const avatarButton = screen.getByRole('button', { name: 'Настройки аккаунта' })
    expect(avatarButton).toHaveTextContent('Р')
    await user.click(avatarButton)
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('renders the avatar as a plain non-interactive element (not a button) when user is provided but onSettings is not', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Настройки аккаунта' }),
    ).not.toBeInTheDocument()
    // The avatar itself must still render, just as non-interactive content.
    expect(screen.getByTitle('Роберт Эванс')).toHaveTextContent('Р')
  })

  it('does not render a settings control when onSettings is provided but user is not (no avatar to click at all)', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        onSettings={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Настройки аккаунта' }),
    ).not.toBeInTheDocument()
  })

  it('renders logout control when user and onLogout are both provided, and clicking it calls onLogout once', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
        onLogout={onLogout}
      />,
    )

    const logoutButton = screen.getByRole('button', { name: 'Выйти' })
    await user.click(logoutButton)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('does not render logout control when user is provided but onLogout is not', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Выйти' }),
    ).not.toBeInTheDocument()
  })

  it('does not render logout control when onLogout is provided but user is not', () => {
    render(
      <Header logo={<span>LOGO-MARKER</span>} homeHref="/" onLogout={vi.fn()} />,
    )

    expect(
      screen.queryByRole('button', { name: 'Выйти' }),
    ).not.toBeInTheDocument()
  })

  it('renders leftSlot content', () => {
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        leftSlot={<button type="button">LEFT-SLOT-MARKER</button>}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'LEFT-SLOT-MARKER' }),
    ).toBeInTheDocument()
  })

  it('clicking the avatar (settings) and logout controls only calls their own callbacks, without throwing', async () => {
    const user = userEvent.setup()
    const onSettings = vi.fn()
    const onLogout = vi.fn()
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
        onSettings={onSettings}
        onLogout={onLogout}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Настройки аккаунта' }))
    await user.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('renders notifications as a native anchor only for an authenticated user', () => {
    const notifications = { href: 'https://glocke.example.test/notifications', state: { status: 'ready' as const, unreadCount: 4 } }
    const { rerender } = render(
      <Header logo={<span>LOGO</span>} homeHref="/" notifications={notifications} />,
    )

    expect(screen.queryByRole('link', { name: 'Уведомления' })).not.toBeInTheDocument()

    rerender(
      <Header logo={<span>LOGO</span>} homeHref="/" user={{ name: 'Alice' }} notifications={notifications} />,
    )
    const bell = screen.getByRole('link', { name: 'Уведомления: непрочитанных — 4' })
    expect(bell.tagName).toBe('A')
    expect(bell).toHaveAttribute('href', 'https://glocke.example.test/notifications')
  })

  it('orders the notification anchor after rightSlot and before logout and avatar', () => {
    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        rightSlot={<button type="button">THEME</button>}
        notifications={{ href: '/notifications', state: { status: 'ready', unreadCount: 3 } }}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
      />,
    )

    const controls = screen.getByRole('button', { name: 'THEME' }).parentElement
    expect(controls).not.toBeNull()
    expect(Array.from(controls!.children)).toEqual([
      screen.getByRole('button', { name: 'THEME' }),
      screen.getByRole('link', { name: 'Уведомления: непрочитанных — 3' }),
      screen.getByRole('button', { name: 'Выйти' }),
      screen.getByRole('button', { name: 'Настройки аккаунта' }),
    ])
  })

  it.each([
    ['loading', { status: 'loading' as const }, null, 'Уведомления: загрузка числа непрочитанных'],
    ['zero', { status: 'ready' as const, unreadCount: 0 }, null, 'Уведомления: непрочитанных нет'],
    ['one', { status: 'ready' as const, unreadCount: 1 }, '1', 'Уведомления: непрочитанных — 1'],
    ['positive', { status: 'ready' as const, unreadCount: 42 }, '42', 'Уведомления: непрочитанных — 42'],
    ['99', { status: 'ready' as const, unreadCount: 99 }, '99', 'Уведомления: непрочитанных — 99'],
    ['100', { status: 'ready' as const, unreadCount: 100 }, '99+', 'Уведомления: непрочитанных — 100'],
    ['huge', { status: 'ready' as const, unreadCount: 9_999_999 }, '99+', 'Уведомления: непрочитанных — 9999999'],
    ['error without retained count', { status: 'error' as const }, null, 'Уведомления: число непрочитанных недоступно'],
    ['error with retained zero', { status: 'error' as const, unreadCount: 0 }, null, 'Уведомления: непрочитанных нет, данные могут быть устаревшими'],
    ['error with retained count', { status: 'error' as const, unreadCount: 7 }, '7', 'Уведомления: непрочитанных — 7, данные могут быть устаревшими'],
  ])('renders the %s notification state with an exact accessible count and capped badge', (_name, state, badge, label) => {
    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{ href: '/notifications', state }}
      />,
    )

    const bell = screen.getByRole('link', { name: label })
    expect(bell).toHaveAccessibleName(label)
    if (badge === null) expect(bell.querySelector('[data-notification-badge]')).not.toBeInTheDocument()
    else expect(bell.querySelector('[data-notification-badge]')).toHaveTextContent(badge)
  })

  it('is a compact icon target with visible keyboard focus styling', async () => {
    const user = userEvent.setup()
    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{ href: '/notifications', state: { status: 'ready', unreadCount: 2 } }}
      />,
    )

    const bell = screen.getByRole('link', { name: 'Уведомления: непрочитанных — 2' })
    expect(parseFloat(bell.style.width)).toBeLessThanOrEqual(36)
    expect(parseFloat(bell.style.height)).toBeLessThanOrEqual(36)
    expect(bell).not.toHaveTextContent('Уведомления')

    await user.tab()
    await user.tab()
    expect(bell).toHaveFocus()
    expect(bell.style.outline).not.toBe('')
    expect(bell.style.outline).not.toBe('none')
  })

  it('following the notification link does not invoke settings or logout callbacks', async () => {
    const user = userEvent.setup()
    const onSettings = vi.fn()
    const onLogout = vi.fn()
    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{ href: '/notifications', state: { status: 'ready', unreadCount: 2 } }}
        onSettings={onSettings}
        onLogout={onLogout}
      />,
    )
    const bell = screen.getByRole('link', { name: 'Уведомления: непрочитанных — 2' })
    bell.addEventListener('click', (event) => event.preventDefault())

    await user.click(bell)

    expect(onSettings).not.toHaveBeenCalled()
    expect(onLogout).not.toHaveBeenCalled()
  })
})

describe('Header notification bell hover/focus preview dropdown', () => {
  function fakeApiClient(): ApiClient {
    return {
      setAccessToken: () => {},
      getAccessToken: () => 'token-1',
      get: async () => { throw new Error('not used') },
      post: async () => { throw new Error('not used') },
      put: async () => { throw new Error('not used') },
      delete: async () => { throw new Error('not used') },
    }
  }

  it('renders a plain link-only bell (no dropdown ever) when glockeOrigin/apiClient are not provided', async () => {
    const user = userEvent.setup()
    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{ href: '/notifications', state: { status: 'ready', unreadCount: 1 } }}
      />,
    )
    const bell = screen.getByRole('link', { name: /уведомлен/i })
    await user.hover(bell)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the dropdown on hover and fetches recent notifications from Glocke', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )
    const bell = screen.getByRole('link', { name: /уведомлен/i })
    await user.hover(bell)

    expect(await screen.findByRole('menu', { name: /последние уведомления/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://glocke.example.test/backend/notifications?limit=5',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }),
    )
    vi.unstubAllGlobals()
  })

  it('shows fetched items and closes again on mouse leave', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: 'n1', title: 'Пароль изменён', body: 'Пароль вашей учётной записи был изменён.',
          actionUrl: null, createdAt: new Date().toISOString(), readAt: null,
        }],
      }),
    }))

    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )
    const bell = screen.getByRole('link', { name: /уведомлен/i })
    await user.hover(bell)

    expect(await screen.findByText('Пароль изменён')).toBeInTheDocument()

    await user.unhover(bell)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    vi.unstubAllGlobals()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }))

    render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )
    const bell = screen.getByRole('link', { name: /уведомлен/i })
    await user.hover(bell)
    await screen.findByRole('menu')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    vi.unstubAllGlobals()
  })
})

describe('Header notification bell new-arrival toast', () => {
  function fakeApiClient(): ApiClient {
    return {
      setAccessToken: () => {},
      getAccessToken: () => 'token-1',
      get: async () => { throw new Error('not used') },
      post: async () => { throw new Error('not used') },
      put: async () => { throw new Error('not used') },
      delete: async () => { throw new Error('not used') },
    }
  }

  function renderWithState(state: { status: 'ready'; unreadCount: number }) {
    return render(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state,
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )
  }

  afterEach(() => vi.unstubAllGlobals())

  it('does not toast on the first ready state (pre-existing unread, not a new arrival)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderWithState({ status: 'ready', unreadCount: 3 })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a toast when the unread count increases after the baseline is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: 'n1', title: 'Пароль изменён', body: 'Пароль вашей учётной записи был изменён.',
          actionUrl: null, createdAt: new Date().toISOString(), readAt: null,
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = renderWithState({ status: 'ready', unreadCount: 0 })

    rerender(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )

    expect(await screen.findByText('Пароль изменён')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://glocke.example.test/backend/notifications?limit=1',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }),
    )
  })

  it('marks the toast read and navigates when clicked', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{
            id: 'n1', title: 'Пароль изменён', body: 'Текст', actionUrl: 'https://kuvert.example.test/settings',
            createdAt: new Date().toISOString(), readAt: null,
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const { rerender } = renderWithState({ status: 'ready', unreadCount: 0 })
    rerender(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )

    await user.click(await screen.findByText('Пароль изменён'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'https://glocke.example.test/backend/notifications/n1/read',
      expect.objectContaining({ method: 'POST' }),
    ))
    expect(screen.queryByText('Пароль изменён')).not.toBeInTheDocument()
  })

  it('dismisses via its close button without navigating', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'n1', title: 'Заголовок', body: 'Текст', actionUrl: null, createdAt: new Date().toISOString(), readAt: null }] }),
    }))
    const user = userEvent.setup()
    const { rerender } = renderWithState({ status: 'ready', unreadCount: 0 })
    rerender(
      <Header
        logo={<span>LOGO</span>}
        homeHref="/"
        user={{ name: 'Alice' }}
        notifications={{
          href: '/notifications',
          state: { status: 'ready', unreadCount: 1 },
          glockeOrigin: 'https://glocke.example.test',
          apiClient: fakeApiClient(),
        }}
      />,
    )
    await screen.findByText('Заголовок')

    await user.click(screen.getByRole('button', { name: 'Закрыть уведомление' }))

    await waitFor(() => expect(screen.queryByText('Заголовок')).not.toBeInTheDocument())
  })
})

describe('Header icon button hover feedback', () => {
  it('changes the avatar (settings) box-shadow ring on hover and reverts on unhover, without affecting which buttons are present or its click behavior', async () => {
    const user = userEvent.setup()
    const onSettings = vi.fn()
    const onLogout = vi.fn()
    render(
      <Header
        logo={<span>LOGO-MARKER</span>}
        homeHref="/"
        user={{ name: 'Роберт Эванс' }}
        onSettings={onSettings}
        onLogout={onLogout}
      />,
    )

    const avatarButton = screen.getByRole('button', { name: 'Настройки аккаунта' })
    const logoutButton = screen.getByRole('button', { name: 'Выйти' })
    const originalShadow = avatarButton.style.boxShadow

    await user.hover(avatarButton)
    expect(avatarButton.style.boxShadow).not.toBe(originalShadow)

    await user.unhover(avatarButton)
    expect(avatarButton.style.boxShadow).toBe(originalShadow)

    // Hovering does not change which buttons are present.
    expect(
      screen.getByRole('button', { name: 'Настройки аккаунта' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()

    // Click-after-hover still fires the callback as expected.
    await user.hover(avatarButton)
    await user.click(avatarButton)
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(onLogout).not.toHaveBeenCalled()

    // Sanity check the logout button too.
    const originalLogoutBackground = logoutButton.style.background
    await user.hover(logoutButton)
    expect(logoutButton.style.background).not.toBe(originalLogoutBackground)
    await user.unhover(logoutButton)
    expect(logoutButton.style.background).toBe(originalLogoutBackground)
  })
})
