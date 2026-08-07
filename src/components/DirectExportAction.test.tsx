import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DirectExportAction } from './DirectExportAction'

afterEach(() => {
  cleanup()
})

const defaultProps = {
  title: 'Экспорт данных',
  description: 'Скачайте данные сервиса в формате JSON.',
  actionLabel: 'Скачать экспорт',
  loadingLabel: 'Подготовка…',
  onExport: vi.fn(),
}

describe('DirectExportAction', () => {
  it('presents the export title, description, and action accessibly', () => {
    render(<DirectExportAction {...defaultProps} />)

    expect(
      screen.getByRole('heading', { name: 'Экспорт данных' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Скачайте данные сервиса в формате JSON.'),
    ).toHaveStyle({ color: 'var(--text-secondary)' })

    const action = screen.getByRole('button', { name: 'Скачать экспорт' })
    expect(action.tagName).toBe('BUTTON')
    expect(action).toHaveAttribute('type', 'button')
  })

  it('invokes onExport through native keyboard button semantics', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<DirectExportAction {...defaultProps} onExport={onExport} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Скачать экспорт' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('prevents same-tick duplicate activation for a synchronous export', async () => {
    const onExport = vi.fn()
    render(<DirectExportAction {...defaultProps} onExport={onExport} />)
    const action = screen.getByRole('button', { name: 'Скачать экспорт' })

    fireEvent.click(action)
    fireEvent.click(action)
    expect(onExport).toHaveBeenCalledTimes(1)

    await act(async () => {})
    fireEvent.click(action)
    expect(onExport).toHaveBeenCalledTimes(2)
  })

  it('prevents duplicate activation until an asynchronous export settles', async () => {
    let resolveExport: (() => void) | undefined
    const onExport = vi.fn(() => new Promise<void>((resolve) => {
      resolveExport = resolve
    }))
    render(<DirectExportAction {...defaultProps} onExport={onExport} />)
    const action = screen.getByRole('button', { name: 'Скачать экспорт' })

    fireEvent.click(action)
    fireEvent.click(action)
    expect(onExport).toHaveBeenCalledTimes(1)

    await act(async () => resolveExport?.())
    fireEvent.click(action)
    expect(onExport).toHaveBeenCalledTimes(2)
  })

  it('releases the activation lock when an asynchronous export rejects', async () => {
    const onExport = vi.fn()
      .mockRejectedValueOnce(new Error('export failed'))
      .mockResolvedValue(undefined)
    render(<DirectExportAction {...defaultProps} onExport={onExport} />)
    const action = screen.getByRole('button', { name: 'Скачать экспорт' })

    fireEvent.click(action)
    await act(async () => {})
    fireEvent.click(action)

    expect(onExport).toHaveBeenCalledTimes(2)
  })

  it('shows the loading label and disables the action while loading', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(
      <DirectExportAction
        {...defaultProps}
        loading
        onExport={onExport}
      />,
    )

    const action = screen.getByRole('button', { name: 'Подготовка…' })
    expect(action).toBeDisabled()
    await user.click(action)
    expect(onExport).not.toHaveBeenCalled()
  })

  it('surfaces an export error in an assertive accessible region', () => {
    render(
      <DirectExportAction
        {...defaultProps}
        error="Не удалось скачать данные. Попробуйте ещё раз."
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Не удалось скачать данные. Попробуйте ещё раз.',
    )
  })

  it('does not render an empty alert when there is no error', () => {
    render(<DirectExportAction {...defaultProps} error={null} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
