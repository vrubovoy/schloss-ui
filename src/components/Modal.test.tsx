import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

afterEach(() => {
  cleanup()
})

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Заголовок')).not.toBeInTheDocument()
    expect(screen.queryByText('Содержимое модалки')).not.toBeInTheDocument()
  })

  it('renders the dialog with title and children when open is true', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Заголовок')).toBeInTheDocument()
    expect(screen.getByText('Содержимое модалки')).toBeInTheDocument()
  })

  it('defaults to the 420px width cap when size is omitted', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveStyle({ maxWidth: '420px' })
  })

  it('widens the cap to 900px with size="large"', () => {
    render(
      <Modal open onClose={vi.fn()} title="Предпросмотр" size="large">
        Содержимое модалки
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveStyle({ maxWidth: '900px' })
  })

  it('moves initial focus inside the dialog when opened', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заголовок">
        <input aria-label="Имя" />
      </Modal>,
    )

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('contains Tab and Shift+Tab focus within the dialog', async () => {
    const user = userEvent.setup()
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Заголовок"
        actions={[{ label: 'Сохранить', onClick: vi.fn(), variant: 'primary' }]}
      >
        <input aria-label="Имя" />
      </Modal>,
    )

    const closeButton = screen.getByRole('button', { name: 'Закрыть' })
    const saveButton = screen.getByRole('button', { name: 'Сохранить' })
    saveButton.focus()

    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(saveButton).toHaveFocus()
  })

  it.each([
    ['hidden', <button key="hidden" type="button" hidden>Скрытая кнопка</button>],
    ['disabled', <button key="disabled" type="button" disabled tabIndex={0}>Недоступная кнопка</button>],
  ])('ignores a %s control when finding the last tabbable element', async (_kind, excludedControl) => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Вне модалки</button>
        <Modal open onClose={vi.fn()} title="Заголовок">
          <input aria-label="Последнее поле" />
          {excludedControl}
        </Modal>
      </>,
    )

    const closeButton = screen.getByRole('button', { name: 'Закрыть' })
    screen.getByLabelText('Последнее поле').focus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it('ignores controls inside a disabled fieldset when trapping focus', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Вне модалки</button>
        <Modal open onClose={vi.fn()} title="Заголовок">
          <input aria-label="Последнее поле" />
          <fieldset disabled>
            <button type="button" tabIndex={0}>Недоступная вложенная кнопка</button>
          </fieldset>
        </Modal>
      </>,
    )

    const closeButton = screen.getByRole('button', { name: 'Закрыть' })
    screen.getByLabelText('Последнее поле').focus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it.each([
    [
      'contenteditable element',
      <div key="editor" contentEditable suppressContentEditableWarning>
        Редактор
      </div>,
      'Редактор',
    ],
    [
      'summary element',
      <details key="details" open>
        <summary>Подробности</summary>
        Текст
      </details>,
      'Подробности',
    ],
  ])('includes a %s in the modal focus trap', async (_kind, tabbable, label) => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Вне модалки</button>
        <Modal open onClose={vi.fn()} title="Заголовок">
          {tabbable}
        </Modal>
      </>,
    )

    const closeButton = screen.getByRole('button', { name: 'Закрыть' })
    screen.getByText(label).focus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it('restores focus to the previously focused element when closed', () => {
    const closed = (
      <>
        <button type="button">Открыть</button>
        <Modal open={false} onClose={vi.fn()} title="Заголовок">
          Содержимое модалки
        </Modal>
      </>
    )
    const { rerender } = render(closed)
    const opener = screen.getByRole('button', { name: 'Открыть' })
    opener.focus()

    rerender(
      <>
        <button type="button">Открыть</button>
        <Modal open onClose={vi.fn()} title="Заголовок">
          Содержимое модалки
        </Modal>
      </>,
    )
    screen.getByRole('button', { name: 'Закрыть' }).focus()

    rerender(closed)
    expect(opener).toHaveFocus()
  })

  it('renders a close control with accessible name "Закрыть" and calls onClose exactly once when clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    const closeButton = screen.getByRole('button', { name: 'Закрыть' })
    await user.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed while open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking on the title or children content', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    await user.click(screen.getByText('Заголовок'))
    await user.click(screen.getByText('Содержимое модалки'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when clicking the backdrop outside the dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement
    expect(backdrop).not.toBeNull()
    expect(backdrop).not.toBe(dialog)

    await user.click(backdrop as HTMLElement)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the icon in the header area alongside the title', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Заголовок"
        icon={<span data-testid="modal-icon">ICON</span>}
      >
        Содержимое модалки
      </Modal>,
    )

    expect(screen.getByTestId('modal-icon')).toBeInTheDocument()
  })

  it('renders action buttons and calls only the clicked action callback, not the other action or onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <Modal
        open
        onClose={onClose}
        title="Заголовок"
        actions={[
          { label: 'Отмена', onClick: onCancel },
          { label: 'Сохранить', onClick: onSave, variant: 'primary' },
        ]}
      >
        Содержимое модалки
      </Modal>,
    )

    const cancelButton = screen.getByRole('button', { name: 'Отмена' })
    const saveButton = screen.getByRole('button', { name: 'Сохранить' })
    expect(cancelButton).toBeInTheDocument()
    expect(saveButton).toBeInTheDocument()

    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders no extra action buttons beyond the close button when actions is not provided', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заголовок">
        Содержимое модалки
      </Modal>,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('Закрыть')
  })

  it('renders no extra action buttons beyond the close button when actions is an empty array', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заголовок" actions={[]}>
        Содержимое модалки
      </Modal>,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('Закрыть')
  })

  it('calls the last action onClick when Enter is pressed while focus is on an input field', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Заголовок"
        actions={[
          { label: 'Отмена', onClick: onCancel },
          { label: 'Сохранить', onClick: onSave, variant: 'primary' },
        ]}
      >
        <form>
          <input aria-label="Имя" />
        </form>
      </Modal>,
    )

    const input = screen.getByLabelText('Имя')
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls the last action onClick when Enter is pressed while focus is on a select field', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Заголовок"
        actions={[
          { label: 'Отмена', onClick: onCancel },
          { label: 'Сохранить', onClick: onSave, variant: 'primary' },
        ]}
      >
        <form>
          <select aria-label="Категория">
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </form>
      </Modal>,
    )

    const select = screen.getByLabelText('Категория')
    select.focus()
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('does not call any action onClick when Enter is pressed while focus is not on an input or select', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Заголовок"
        actions={[
          { label: 'Отмена', onClick: onCancel },
          { label: 'Сохранить', onClick: onSave, variant: 'primary' },
        ]}
      >
        <form>
          <input aria-label="Имя" />
        </form>
        <div tabIndex={-1}>Статический текст</div>
      </Modal>,
    )

    const staticText = screen.getByText('Статический текст')
    staticText.focus()
    expect(staticText).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('still calls onClose when Escape is pressed while an input is focused and actions are present', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <Modal
        open
        onClose={onClose}
        title="Заголовок"
        actions={[
          { label: 'Отмена', onClick: onCancel },
          { label: 'Сохранить', onClick: onSave, variant: 'primary' },
        ]}
      >
        <form>
          <input aria-label="Имя" />
        </form>
      </Modal>,
    )

    const input = screen.getByLabelText('Имя')
    await user.click(input)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('does not throw when Enter is pressed in a focused input and actions is not provided', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={vi.fn()} title="Заголовок">
        <form>
          <input aria-label="Имя" />
        </form>
      </Modal>,
    )

    const input = screen.getByLabelText('Имя')
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not throw when Enter is pressed in a focused input and actions is an empty array', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={vi.fn()} title="Заголовок" actions={[]}>
        <form>
          <input aria-label="Имя" />
        </form>
      </Modal>,
    )

    const input = screen.getByLabelText('Имя')
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
