import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationDropdown } from './NotificationDropdown'
import type { ApiClient } from '../auth/apiClient'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

const ITEM = {
  id: 'n1',
  title: 'Пароль изменён',
  body: 'Пароль вашей учётной записи был изменён.',
  actionUrl: null,
  createdAt: '2026-08-19T09:00:00.000Z',
  readAt: null,
}

describe('NotificationDropdown', () => {
  it('fetches nothing while closed', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(
      <NotificationDropdown open={false} glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a loading state, then the fetched items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [ITEM] }) }))
    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
    expect(await screen.findByText('Пароль изменён')).toBeInTheDocument()
    expect(screen.getByText('Пароль вашей учётной записи был изменён.')).toBeInTheDocument()
  })

  it('shows an empty state when there are no recent notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }))
    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    expect(await screen.findByText('Уведомлений пока нет')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails or the payload is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    expect(await screen.findByText('Не удалось загрузить уведомления.')).toBeInTheDocument()
  })

  it('marks an item read when clicked, calling the read endpoint and invalidating the badge', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [ITEM] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    await user.click(await screen.findByRole('menuitem', { name: /Пароль изменён/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'https://glocke.example.test/backend/notifications/n1/read',
      expect.objectContaining({ method: 'POST' }),
    ))
  })

  it('clears (marks all read) via the header button when there is unread content', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [ITEM] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    await screen.findByText('Пароль изменён')
    await user.click(screen.getByRole('button', { name: /прочитать все/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'https://glocke.example.test/backend/notifications/read-all',
      expect.objectContaining({ method: 'POST' }),
    ))
  })

  it('has no "clear" button when every fetched item is already read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ ...ITEM, readAt: '2026-08-19T09:05:00.000Z' }] }) }))
    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    await screen.findByText('Пароль изменён')
    expect(screen.queryByRole('button', { name: /прочитать все/i })).not.toBeInTheDocument()
  })

  it('links "Все уведомления" to the given notifications href', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }))
    render(
      <NotificationDropdown open glockeOrigin="https://glocke.example.test" apiClient={fakeApiClient()} notificationsHref="/notifications" />,
    )
    expect(await screen.findByRole('link', { name: 'Все уведомления' })).toHaveAttribute('href', '/notifications')
  })
})
