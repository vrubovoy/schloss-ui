import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState, type ChangeEvent } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Field } from './Field'

afterEach(() => {
  cleanup()
})

describe('Field (input mode)', () => {
  it('renders a text input associated with its label via getByLabelText, with no as prop', () => {
    render(<Field label="Название" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Название')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders a text input associated with its label via getByLabelText, with as="input" explicitly', () => {
    render(<Field as="input" label="Название" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Название')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders the passed value and fires onChange when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    function Controlled() {
      const [value, setValue] = useState('')
      return (
        <Field
          label="Имя"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange(e)
            setValue(e.target.value)
          }}
        />
      )
    }

    render(<Controlled />)
    const input = screen.getByLabelText('Имя')
    await user.type(input, 'Роберт')

    expect(onChange).toHaveBeenCalled()
    expect(input).toHaveValue('Роберт')
  })

  it('renders the placeholder prop', () => {
    render(
      <Field label="Email" placeholder="you@example.com" value="" onChange={() => {}} />,
    )
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('disables the input when disabled is passed', () => {
    render(<Field label="Заблокировано" disabled value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Заблокировано')).toBeDisabled()
  })

  it('honors the type prop on the underlying input element', () => {
    render(<Field label="Email" type="email" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  })

  it('renders the error text when error is provided', () => {
    render(
      <Field
        label="Сумма"
        error="Обязательное поле"
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument()
  })

  it('does not render any error text when error is not provided', () => {
    render(<Field label="Сумма" value="" onChange={() => {}} />)
    expect(screen.queryByText('Обязательное поле')).not.toBeInTheDocument()
  })

  it('marks the input aria-invalid and gives it a red border when error is provided', () => {
    render(
      <Field
        label="Email"
        error="Неверный формат"
        value=""
        onChange={() => {}}
      />,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.style.border).toContain('var(--danger)')
  })

  it('is not aria-invalid and has the default border when error is not provided', () => {
    render(<Field label="Email" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input.style.border).not.toContain('var(--danger)')
  })

  it('invalid alone gives a red border and aria-invalid without rendering any error text', () => {
    render(<Field label="Email" invalid value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.style.border).toContain('var(--danger)')
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })

  it('renders the prefix content alongside the input', () => {
    render(
      <Field
        label="Сумма"
        prefix={<span data-testid="prefix-marker">₽</span>}
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByTestId('prefix-marker')).toBeInTheDocument()
    expect(screen.getByText('₽')).toBeInTheDocument()
  })

  it('renders the suffix content alongside the input', () => {
    render(
      <Field
        label="Пароль"
        type="password"
        value=""
        onChange={() => {}}
        suffix={
          <button type="button" data-testid="suffix-btn">
            toggle
          </button>
        }
      />,
    )

    expect(screen.getByTestId('suffix-btn')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('toggle')).toBeInTheDocument()
  })

  it('renders a suffix that actually receives pointer events (not inert/decoration-only)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <Field
        label="Пароль"
        type="password"
        value=""
        onChange={() => {}}
        suffix={
          <button type="button" data-testid="suffix-btn" onClick={onClick}>
            toggle
          </button>
        }
      />,
    )

    await user.click(screen.getByTestId('suffix-btn'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render any suffix content by default', () => {
    render(<Field label="Сумма" value="" onChange={() => {}} />)
    expect(screen.queryByTestId('suffix-btn')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders both prefix and suffix at the same time, independently', () => {
    render(
      <Field
        label="Сумма"
        value=""
        onChange={() => {}}
        prefix={<span data-testid="prefix-marker">₽</span>}
        suffix={<button type="button" data-testid="suffix-btn">toggle</button>}
      />,
    )

    expect(screen.getByTestId('prefix-marker')).toBeInTheDocument()
    expect(screen.getByTestId('suffix-btn')).toBeInTheDocument()
  })

  it('does not throw on focus/blur, and fires user-supplied onFocus/onBlur callbacks', async () => {
    const user = userEvent.setup()
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    render(
      <Field
        label="Фокус"
        value=""
        onChange={() => {}}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    )

    const input = screen.getByLabelText('Фокус')

    await expect(
      (async () => {
        await user.click(input)
        await user.tab()
      })(),
    ).resolves.not.toThrow()

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('Field (select mode)', () => {
  it('renders a select element associated with its label', () => {
    render(
      <Field as="select" label="Категория" value="a" onChange={() => {}}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Field>,
    )

    const select = screen.getByRole('combobox', { name: 'Категория' })
    expect(select).toBeInTheDocument()
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByLabelText('Категория')).toBe(select)
  })

  it('renders passed option children', () => {
    render(
      <Field as="select" label="Категория" value="a" onChange={() => {}}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Field>,
    )

    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument()
  })

  it('fires onChange when selecting a different option (controlled)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    function Controlled() {
      const [value, setValue] = useState('a')
      return (
        <Field
          as="select"
          label="Категория"
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            onChange(e)
            setValue(e.target.value)
          }}
        >
          <option value="a">A</option>
          <option value="b">B</option>
        </Field>
      )
    }

    render(<Controlled />)
    const select = screen.getByRole('combobox', { name: 'Категория' })
    await user.selectOptions(select, 'B')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(select).toHaveValue('b')
  })

  it('renders the error text in select mode', () => {
    render(
      <Field
        as="select"
        label="Категория"
        error="Выберите категорию"
        value="a"
        onChange={() => {}}
      >
        <option value="a">A</option>
      </Field>,
    )

    expect(screen.getByText('Выберите категорию')).toBeInTheDocument()
  })

  it('renders the prefix content in select mode', () => {
    render(
      <Field as="select" label="Категория" prefix={<span data-testid="select-prefix-marker">₽</span>} value="a" onChange={() => {}}>
        <option value="a">A</option>
      </Field>,
    )

    expect(screen.getByTestId('select-prefix-marker')).toBeInTheDocument()
  })

  it('renders a suffix in select mode that actually receives pointer events', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <Field
        as="select"
        label="Категория"
        value="a"
        onChange={() => {}}
        suffix={
          <button type="button" data-testid="select-suffix-btn" onClick={onClick}>
            toggle
          </button>
        }
      >
        <option value="a">A</option>
      </Field>,
    )

    expect(screen.getByTestId('select-suffix-btn')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()

    await user.click(screen.getByTestId('select-suffix-btn'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
