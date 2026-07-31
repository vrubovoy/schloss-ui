import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSidebarWidth } from './useSidebarWidth'
import type { UseSidebarWidthOptions } from './useSidebarWidth'

type FakeMouseEvent = { preventDefault: () => void; clientX: number }

function fakeEvent(clientX: number): FakeMouseEvent {
  return { preventDefault: vi.fn(), clientX }
}

function move(clientX: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX }))
  })
}

function up() {
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup'))
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('useSidebarWidth - initial state', () => {
  it('defaults to defaultWidth (220) when nothing is stored', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-1' }))
    expect(result.current.width).toBe(220)
    expect(result.current.collapsed).toBe(false)
    expect(result.current.dragging).toBe(false)
  })

  it('uses a custom defaultWidth when provided and nothing is stored', () => {
    const { result } = renderHook(() =>
      useSidebarWidth({ storageKey: 'sb-2', defaultWidth: 250 }),
    )
    expect(result.current.width).toBe(250)
  })

  it('uses the stored value when it is a valid number within [minWidth, maxWidth]', () => {
    localStorage.setItem('sb-3', '300')
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-3' }))
    expect(result.current.width).toBe(300)
  })

  it('falls back to defaultWidth when the stored value is out of range', () => {
    localStorage.setItem('sb-4', '9999')
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-4' }))
    expect(result.current.width).toBe(220)
  })

  it('falls back to defaultWidth when the stored value is not a valid number', () => {
    localStorage.setItem('sb-5', 'not-a-number')
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-5' }))
    expect(result.current.width).toBe(220)
  })
})

describe('useSidebarWidth - toggleCollapsed', () => {
  it('flips collapsed and swaps width between expanded and collapsedWidth on each call', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-toggle' }))
    expect(result.current.collapsed).toBe(false)
    expect(result.current.width).toBe(220)

    act(() => {
      result.current.toggleCollapsed()
    })
    expect(result.current.collapsed).toBe(true)
    expect(result.current.width).toBe(64)

    act(() => {
      result.current.toggleCollapsed()
    })
    expect(result.current.collapsed).toBe(false)
    expect(result.current.width).toBe(220)
  })

  it('uses a custom collapsedWidth when provided', () => {
    const { result } = renderHook(() =>
      useSidebarWidth({ storageKey: 'sb-toggle-2', collapsedWidth: 50 }),
    )
    act(() => {
      result.current.toggleCollapsed()
    })
    expect(result.current.width).toBe(50)
  })
})

describe('useSidebarWidth - drag', () => {
  it('startDrag sets dragging to true and calls preventDefault', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-1' }))
    const evt = fakeEvent(100)

    act(() => {
      result.current.startDrag(evt as unknown as Parameters<typeof result.current.startDrag>[0])
    })

    expect(result.current.dragging).toBe(true)
    expect(evt.preventDefault).toHaveBeenCalled()
    up()
  })

  it('mousemove updates width by the clientX delta from the drag start width', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-2' }))
    expect(result.current.width).toBe(220)

    act(() => {
      result.current.startDrag(fakeEvent(100) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(150) // delta +50 -> 270

    expect(result.current.width).toBe(270)
    up()
  })

  it('clamps width to maxWidth (360) when the delta would exceed it', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-3' }))

    act(() => {
      result.current.startDrag(fakeEvent(100) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(1000) // huge positive delta

    expect(result.current.width).toBe(360)
    up()
  })

  it('clamps width to minWidth when resulting width is at/above collapseThreshold but below minWidth (custom options)', () => {
    const options: UseSidebarWidthOptions = {
      storageKey: 'sb-drag-4',
      defaultWidth: 220,
      minWidth: 100,
      maxWidth: 360,
      collapseThreshold: 50,
    }
    const { result } = renderHook(() => useSidebarWidth(options))

    act(() => {
      result.current.startDrag(fakeEvent(220) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(80) // delta -140 -> raw 80, below minWidth(100) but not below collapseThreshold(50)

    expect(result.current.collapsed).toBe(false)
    expect(result.current.width).toBe(100)
    up()
  })

  it('collapses instead of clamping to minWidth when the resulting width is below collapseThreshold', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-5' }))
    expect(result.current.width).toBe(220)

    act(() => {
      result.current.startDrag(fakeEvent(220) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(100) // delta -120 -> 100, below collapseThreshold(140)

    expect(result.current.collapsed).toBe(true)
    expect(result.current.width).toBe(64)
    up()
  })

  it('mouseup ends the drag (dragging becomes false)', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-6' }))

    act(() => {
      result.current.startDrag(fakeEvent(100) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    expect(result.current.dragging).toBe(true)

    up()
    expect(result.current.dragging).toBe(false)
  })

  it('persists the new expanded width to localStorage after a completed expanded drag', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-7' }))

    act(() => {
      result.current.startDrag(fakeEvent(100) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(180) // delta +80 -> 300
    up()

    expect(result.current.width).toBe(300)
    expect(localStorage.getItem('sb-drag-7')).toBe('300')
  })

  it('after a drag that ends collapsed, localStorage does not reflect the collapsed width', () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-8' }))

    act(() => {
      result.current.startDrag(fakeEvent(220) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(100) // collapses, width -> 64
    up()

    expect(result.current.collapsed).toBe(true)
    expect(result.current.width).toBe(64)
    const persisted = localStorage.getItem('sb-drag-8')
    // Spec: persistence should reflect the hook's last known EXPANDED width,
    // never the collapsed width (64) itself. Observed factually below.
    expect(persisted).not.toBe('64')
  })

  it('suppresses a toggleCollapsed() call immediately after a completed drag, then allows it again after a tick', async () => {
    const { result } = renderHook(() => useSidebarWidth({ storageKey: 'sb-drag-9' }))

    act(() => {
      result.current.startDrag(fakeEvent(100) as unknown as Parameters<typeof result.current.startDrag>[0])
    })
    move(150) // -> 270
    up()

    const widthAfterDrag = result.current.width
    const collapsedAfterDrag = result.current.collapsed

    act(() => {
      result.current.toggleCollapsed()
    })
    // Immediately-following toggle must be suppressed (no-op).
    expect(result.current.collapsed).toBe(collapsedAfterDrag)
    expect(result.current.width).toBe(widthAfterDrag)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      result.current.toggleCollapsed()
    })
    // Suppression has cleared - toggle now works normally.
    expect(result.current.collapsed).toBe(!collapsedAfterDrag)
  })
})

describe('useSidebarWidth - independent instances', () => {
  it('two hooks with different storageKeys persist independently and do not interfere', () => {
    const hookA = renderHook(() => useSidebarWidth({ storageKey: 'sb-indep-a' }))
    const hookB = renderHook(() => useSidebarWidth({ storageKey: 'sb-indep-b' }))

    act(() => {
      hookA.result.current.toggleCollapsed()
    })

    expect(hookA.result.current.collapsed).toBe(true)
    expect(hookA.result.current.width).toBe(64)
    expect(hookB.result.current.collapsed).toBe(false)
    expect(hookB.result.current.width).toBe(220)
    // hookB's own storage key must not have picked up hookA's collapsed
    // width - it stays at hookB's own (uncollapsed) width, if written at all.
    // (Observed: collapsing via toggleCollapsed does not persist the
    // collapsed width to storage at all - hookA's key keeps its
    // mount-time expanded value, same as hookB's untouched key.)
    expect(localStorage.getItem('sb-indep-b')).not.toBe('64')
    expect(localStorage.getItem('sb-indep-a')).not.toBe('64')
  })
})
