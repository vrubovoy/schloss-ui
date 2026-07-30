import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sun, Moon, Monitor, Coffee } from 'lucide-react'
import { Button } from './Button'
import { type Theme, THEMES, getStoredTheme, applyTheme } from '../lib/theme'

const ICONS: Record<Theme, ReactNode> = {
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
  oled: <Monitor size={16} />,
  sepia: <Coffee size={16} />,
}

const LABELS: Record<Theme, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  oled: 'OLED',
  sepia: 'Сепия',
}

// Matches the panel's own `minWidth` below - used only as pass-1's guess
// before the panel's real rendered width is known (see the second
// positioning effect).
const PANEL_WIDTH_GUESS = 140

export interface ThemeToggleTriggerProps {
  theme: Theme
  icon: ReactNode
  onClick: () => void
}

export interface ThemeToggleProps {
  /**
   * Custom trigger element, for contexts that don't fit the default
   * ghost-icon-button look (e.g. kuvert's sidebar, which renders its own
   * full-width row style). Receives the current theme/icon and a click
   * handler that opens/closes the dropdown - call it from your own
   * clickable element.
   */
  trigger?: (props: ThemeToggleTriggerProps) => ReactNode
  /** Horizontal anchor for the dropdown panel. Default 'right' (fits a
   * header's right-aligned icon strip); 'left' avoids running off-screen
   * when the trigger sits near the left edge (e.g. a sidebar). */
  align?: 'left' | 'right'
}

export function ThemeToggle({ trigger, align = 'right' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  // Guards the pass-2 correction below so it only ever runs once per open -
  // without this, each correction would trigger the effect again via the
  // `position` state change it causes, forever re-measuring.
  const correctedRef = useRef(false)

  // Mount-only: reflects whatever's already stored onto the document (in
  // case nothing else on the page did yet) without declaring a fresh
  // preference change - `select` below is the only place that does that,
  // with an explicit timestamp, since it's the only place a real user
  // choice happens.
  useEffect(() => {
    applyTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pass 1: guess a position directly under the trigger, aligned per
  // `align`, before the panel's real size is known.
  useLayoutEffect(() => {
    correctedRef.current = false
    if (!open) {
      setPosition(null)
      return
    }
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      top: rect.bottom + 8,
      left: align === 'right' ? rect.right - PANEL_WIDTH_GUESS : rect.left,
    })
  }, [open, align])

  // Pass 2: now that the panel is actually in the DOM, measure its real
  // size and correct just enough to keep it fully on-screen, staying
  // visually anchored to the trigger rather than jumping elsewhere - this
  // is what fixes the panel running off the bottom of a short viewport
  // (e.g. a trigger near the bottom of a sidebar). Portaled to
  // `document.body` with `position: fixed` (viewport coordinates) instead
  // of `position: absolute` relative to a local ancestor, so it's never
  // clipped by an ancestor's `overflow: hidden` (e.g. the app shell's own
  // height-locked root) either.
  useLayoutEffect(() => {
    if (!position || !panelRef.current || !anchorRef.current || correctedRef.current) return
    correctedRef.current = true
    const anchorRect = anchorRef.current.getBoundingClientRect()
    const panelRect = panelRef.current.getBoundingClientRect()
    let top = position.top
    let left = align === 'right' ? anchorRect.right - panelRect.width : position.left
    const bottomOverflow = panelRect.bottom - window.innerHeight
    if (bottomOverflow > 0) top = Math.max(8, top - bottomOverflow - 8)
    left = Math.min(Math.max(8, left), window.innerWidth - panelRect.width - 8)
    setPosition({ top, left })
  }, [position, align])

  function select(t: Theme) {
    applyTheme(t, Date.now())
    setTheme(t)
    setOpen(false)
  }

  const toggleOpen = () => setOpen((o) => !o)

  return (
    <div ref={anchorRef} style={{ display: 'inline-block' }}>
      {trigger ? (
        trigger({ theme, icon: ICONS[theme], onClick: toggleOpen })
      ) : (
        <Button
          variant="ghost"
          style={{ padding: '0.4rem', border: 'none' }}
          onClick={toggleOpen}
          aria-label="Сменить тему"
        >
          {ICONS[theme]}
        </Button>
      )}

      {open && position && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              zIndex: 50,
              minWidth: PANEL_WIDTH_GUESS,
              padding: '0.375rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              // Inlined equivalent of the app-level `.card-elevated` utility
              // (not part of schloss-ui) - kept self-contained like every
              // other component here, driven only by tokens.css variables.
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => select(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  background: t === theme ? 'var(--accent-muted)' : 'transparent',
                  color: t === theme ? 'var(--accent-text)' : 'var(--text-secondary)',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 120ms',
                }}
              >
                {ICONS[t]}
                {LABELS[t]}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
