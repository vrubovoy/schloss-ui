import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'
import { applyTheme, type Theme } from '../lib/theme'

const OPTION_LABELS = ['Светлая', 'Тёмная', 'OLED', 'Сепия']

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('ThemeToggle (default trigger)', () => {
  it('renders a button with aria-label "Сменить тему" and no menu content visible initially', () => {
    render(<ThemeToggle />)

    expect(
      screen.getByRole('button', { name: 'Сменить тему' }),
    ).toBeInTheDocument()

    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('opens a menu with exactly 4 options in order when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))

    const optionButtons = OPTION_LABELS.map((label) =>
      screen.getByRole('button', { name: label }),
    )
    for (const button of optionButtons) {
      expect(button).toBeInTheDocument()
    }

    // Confirm order matches spec order: Светлая, Тёмная, OLED, Сепия.
    const allButtons = Array.from(document.querySelectorAll<HTMLElement>('button'))
    const positions = optionButtons.map((button) => allButtons.indexOf(button))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('closes the menu when the trigger is clicked again while open', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const trigger = screen.getByRole('button', { name: 'Сменить тему' })
    await user.click(trigger)
    expect(screen.getByText('Светлая')).toBeInTheDocument()

    await user.click(trigger)
    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('selecting a theme closes the menu and applies it via the real theme lib', async () => {
    const user = userEvent.setup()
    localStorage.setItem('schloss-theme', 'light')
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))
    await user.click(screen.getByRole('button', { name: 'Тёмная' }))

    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('schloss-theme')).toBe('dark')

    // Trigger can be re-opened afterwards, still with 4 options.
    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))
    for (const label of OPTION_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('selecting the already-active theme is idempotent and does not throw', async () => {
    const user = userEvent.setup()
    localStorage.setItem('schloss-theme', 'oled')
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))
    await expect(
      user.click(screen.getByRole('button', { name: 'OLED' })),
    ).resolves.not.toThrow()

    expect(document.documentElement.getAttribute('data-theme')).toBe('oled')
    expect(localStorage.getItem('schloss-theme')).toBe('oled')
    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it('closes the menu when clicking outside, without changing the current theme', async () => {
    const user = userEvent.setup()
    localStorage.setItem('schloss-theme', 'sepia')
    render(
      <div>
        <ThemeToggle />
        <button type="button" data-testid="outside">
          outside
        </button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))
    expect(screen.getByText('Светлая')).toBeInTheDocument()

    // While open, the component renders a full-viewport fixed backdrop
    // behind the menu panel specifically to catch "click outside" (jsdom
    // does no real hit-testing/z-index layering, so a click fired at an
    // arbitrary sibling element doesn't reach it the way a real browser
    // click would - the backdrop itself must be the event target). Both
    // the backdrop and the menu panel are portaled to document.body (so
    // the panel can't be clipped by an ancestor's `overflow: hidden`), so
    // this queries the whole document rather than the local render
    // container.
    const backdrop = document.body.querySelector<HTMLElement>(
      'div[style*="position: fixed"]',
    )
    if (!backdrop) throw new Error('outside-click backdrop not found')
    fireEvent.click(backdrop)

    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    // Theme unchanged by the outside click (applyTheme was never called for
    // this render, so data-theme reflects whatever was there before - not
    // necessarily 'sepia' unless something applied it; the key assertion is
    // localStorage is untouched).
    expect(localStorage.getItem('schloss-theme')).toBe('sepia')
  })
})

describe('ThemeToggle (custom trigger)', () => {
  it('does not render the default trigger button when a custom trigger is provided', () => {
    render(
      <ThemeToggle
        trigger={({ onClick }) => (
          <button onClick={onClick} aria-label="MY-CUSTOM-TRIGGER">
            custom
          </button>
        )}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Сменить тему' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'MY-CUSTOM-TRIGGER' }),
    ).toBeInTheDocument()
  })

  it('passes the current theme (from getStoredTheme) to the trigger render prop', () => {
    localStorage.setItem('schloss-theme', 'sepia')
    let receivedTheme: Theme | undefined

    render(
      <ThemeToggle
        trigger={({ theme, onClick }) => {
          receivedTheme = theme
          return (
            <button onClick={onClick} aria-label="MY-CUSTOM-TRIGGER">
              custom
            </button>
          )
        }}
      />,
    )

    expect(receivedTheme).toBe('sepia')
  })

  it('updates the trigger when THEME_CHANGE_EVENT reports a theme change', () => {
    localStorage.setItem('schloss-theme', 'light')
    render(
      <ThemeToggle
        trigger={({ theme, onClick }) => (
          <button type="button" onClick={onClick}>
            Current theme: {theme}
          </button>
        )}
      />,
    )

    expect(screen.getByRole('button')).toHaveTextContent('Current theme: light')

    act(() => {
      applyTheme('dark', 200)
    })

    expect(screen.getByRole('button')).toHaveTextContent('Current theme: dark')
  })

  it('opens the same 4-option dropdown when the custom trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ThemeToggle
        trigger={({ onClick }) => (
          <button onClick={onClick} aria-label="MY-CUSTOM-TRIGGER">
            custom
          </button>
        )}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'MY-CUSTOM-TRIGGER' }))

    for (const label of OPTION_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('selecting an option from the custom-trigger dropdown applies the theme and closes it', async () => {
    const user = userEvent.setup()
    localStorage.setItem('schloss-theme', 'light')
    render(
      <ThemeToggle
        trigger={({ onClick }) => (
          <button onClick={onClick} aria-label="MY-CUSTOM-TRIGGER">
            custom
          </button>
        )}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'MY-CUSTOM-TRIGGER' }))
    await user.click(screen.getByRole('button', { name: 'Сепия' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    expect(localStorage.getItem('schloss-theme')).toBe('sepia')
    for (const label of OPTION_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })
})

describe('ThemeToggle (align prop)', () => {
  it('renders, opens, and allows selection without breaking when align="left"', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle align="left" />)

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))
    await user.click(screen.getByRole('button', { name: 'Светлая' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('schloss-theme')).toBe('light')
  })
})

describe('ThemeToggle (portal to document.body)', () => {
  it('portals the open panel to document.body rather than leaving it inside the local render container', async () => {
    const user = userEvent.setup()
    const { container } = render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Сменить тему' }))

    const optionButton = screen.getByRole('button', { name: 'Светлая' })

    // The panel's option buttons must not live inside the component's own
    // local render container...
    expect(container.contains(optionButton)).toBe(false)
    // ...but they must be found somewhere under document.body.
    expect(document.body.contains(optionButton)).toBe(true)

    // Walking all the way up from the option button should land exactly on
    // document.body - i.e. it was appended directly under body via a
    // portal, not nested inside the local container tree at all.
    let node: HTMLElement | null = optionButton
    while (node.parentElement && node !== document.body) {
      node = node.parentElement
    }
    expect(node).toBe(document.body)
  })
})

describe('ThemeToggle (viewport-aware panel positioning)', () => {
  const realGetBoundingClientRect = Element.prototype.getBoundingClientRect
  let originalInnerHeight: number

  beforeEach(() => {
    originalInnerHeight = window.innerHeight
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Element.prototype.getBoundingClientRect = realGetBoundingClientRect
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true,
    })
  })

  // Locate the panel's own positioned wrapper by walking up from one of its
  // option buttons to the nearest ancestor styled with `position: fixed`
  // (per spec, the panel itself is positioned this way once portaled).
  function findPanelElement(): HTMLElement {
    const anchor = screen.getByRole('button', { name: 'Светлая' })
    let node: HTMLElement | null = anchor.parentElement
    while (node) {
      if (node.style.position === 'fixed') return node
      node = node.parentElement
    }
    throw new Error('panel wrapper (position: fixed) not found')
  }

  function mockRects(triggerEl: Element, triggerRect: DOMRect, panelRect: DOMRect) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      // The component positions the panel relative to whichever element its
      // trigger measurement targets - this may be the trigger button itself,
      // or a local wrapper element around it (e.g. the `display:
      // inline-block` div this library wraps triggers in, a holdover from
      // when the panel used to be absolutely positioned relative to that
      // wrapper). Matching any DIV ancestor-or-self of the trigger (other
      // than body/documentElement) keeps this robust to either.
      if (
        this === triggerEl ||
        (this instanceof HTMLDivElement &&
          this !== document.body &&
          this !== document.documentElement &&
          this.contains(triggerEl))
      ) {
        return triggerRect
      }
      if (
        this instanceof HTMLElement &&
        this.style.position === 'fixed' &&
        this.querySelector('button')
      ) {
        return panelRect
      }
      return realGetBoundingClientRect.call(this)
    })
  }

  it('nudges the panel up so it stays within a short viewport instead of overflowing the bottom', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'innerHeight', { value: 150, configurable: true })

    const triggerRect = {
      top: 100,
      bottom: 140,
      left: 50,
      right: 130,
      width: 80,
      height: 40,
      x: 50,
      y: 100,
      toJSON() {},
    } as DOMRect
    const PANEL_HEIGHT = 80
    const panelRect = {
      top: 140,
      bottom: 140 + PANEL_HEIGHT,
      left: 50,
      right: 350,
      width: 300,
      height: PANEL_HEIGHT,
      x: 50,
      y: 140,
      toJSON() {},
    } as DOMRect

    render(<ThemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Сменить тему' })
    mockRects(trigger, triggerRect, panelRect)

    await user.click(trigger)

    const panel = findPanelElement()
    const top = parseFloat(panel.style.top || '0')

    // A naive first-pass guess (placing the panel right below the trigger,
    // at its bottom edge of 140) combined with the panel's real height (80)
    // would overflow the mocked 150px viewport. Once the real size is
    // known, the panel must be nudged up so it no longer overflows.
    expect(top).toBeLessThan(triggerRect.bottom)
    expect(top + PANEL_HEIGHT).toBeLessThanOrEqual(window.innerHeight)
  })

  it('aligns the panel right edge to the trigger right edge using the real measured width (align="right", the default)', async () => {
    const user = userEvent.setup()

    const triggerRect = {
      top: 50,
      bottom: 90,
      left: 200,
      right: 280,
      width: 80,
      height: 40,
      x: 200,
      y: 50,
      toJSON() {},
    } as DOMRect
    const PANEL_WIDTH = 150
    const panelRect = {
      top: 90,
      bottom: 190,
      left: 0,
      right: PANEL_WIDTH,
      width: PANEL_WIDTH,
      height: 100,
      x: 0,
      y: 90,
      toJSON() {},
    } as DOMRect

    render(<ThemeToggle align="right" />)
    const trigger = screen.getByRole('button', { name: 'Сменить тему' })
    mockRects(trigger, triggerRect, panelRect)

    await user.click(trigger)

    const panel = findPanelElement()
    const left = parseFloat(panel.style.left || '0')

    // The panel's right edge (left + real measured width) must land exactly
    // on the trigger's right edge, not the pass-1 guess.
    expect(left + PANEL_WIDTH).toBeCloseTo(triggerRect.right, 5)
  })

  it('flips the panel to open above the trigger when opening below would overflow, instead of pinning its bottom to the viewport and covering the trigger', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true })

    // Trigger sits near the bottom of the short viewport, so a naive
    // below-placement (panel top = triggerRect.bottom = 190) plus the
    // panel's real height (150) would overflow the 200px viewport by a lot.
    // But there IS enough room above the trigger (185px down to the
    // viewport top) for a 150px-tall panel plus the 8px gap.
    const triggerRect = {
      top: 185,
      bottom: 190,
      left: 50,
      right: 130,
      width: 80,
      height: 5,
      x: 50,
      y: 185,
      toJSON() {},
    } as DOMRect
    const PANEL_HEIGHT = 150
    const panelRect = {
      top: 190,
      bottom: 190 + PANEL_HEIGHT,
      left: 50,
      right: 350,
      width: 300,
      height: PANEL_HEIGHT,
      x: 50,
      y: 190,
      toJSON() {},
    } as DOMRect

    render(<ThemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Сменить тему' })
    mockRects(trigger, triggerRect, panelRect)

    await user.click(trigger)

    const panel = findPanelElement()
    const top = parseFloat(panel.style.top || '0')

    // Key regression check: the panel's rendered vertical range
    // ([top, top + height]) must never overlap the trigger's own vertical
    // range - i.e. the panel's bottom edge must sit at or above 8px short
    // of the trigger's top edge (a small epsilon allows for the exact 8px
    // gap arithmetic).
    expect(top + PANEL_HEIGHT).toBeLessThanOrEqual(triggerRect.top - 8 + 1)
    // And it must not have been pushed above the viewport's top edge either.
    expect(top).toBeGreaterThanOrEqual(8 - 1)
  })

  it('falls back gracefully (renders, does not throw) when the viewport is so short that even flipping above the trigger does not fit', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true })

    // Trigger near the middle of a viewport (100px) that is itself shorter
    // than the panel (150px) - neither opening below nor flipping above can
    // fully avoid overflow, so this only exercises the last-resort fallback.
    const triggerRect = {
      top: 45,
      bottom: 55,
      left: 50,
      right: 130,
      width: 80,
      height: 10,
      x: 50,
      y: 45,
      toJSON() {},
    } as DOMRect
    const PANEL_HEIGHT = 150
    const panelRect = {
      top: 55,
      bottom: 55 + PANEL_HEIGHT,
      left: 50,
      right: 350,
      width: 300,
      height: PANEL_HEIGHT,
      x: 50,
      y: 55,
      toJSON() {},
    } as DOMRect

    render(<ThemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Сменить тему' })
    mockRects(trigger, triggerRect, panelRect)

    await expect(user.click(trigger)).resolves.not.toThrow()

    const panel = findPanelElement()
    const top = parseFloat(panel.style.top || '0')

    expect(Number.isNaN(top)).toBe(false)
    for (const label of OPTION_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })
})
