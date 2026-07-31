import { useState, useRef, useCallback, useEffect } from 'react'

const DEFAULT_COLLAPSED_WIDTH = 64
const DEFAULT_WIDTH = 220
const DEFAULT_MIN_WIDTH = 180
const DEFAULT_MAX_WIDTH = 360
// Dragging narrower than this snaps shut to the icon-only rail instead of
// leaving an awkward in-between width.
const DEFAULT_COLLAPSE_THRESHOLD = 140

export interface UseSidebarWidthOptions {
  // localStorage key the expanded width is persisted under - pass a
  // per-app key (e.g. 'tafel-sidebar-width') so multiple apps sharing a
  // browser profile don't clobber each other's remembered width.
  storageKey: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  collapsedWidth?: number
  collapseThreshold?: number
}

export interface UseSidebarWidthResult {
  width: number
  collapsed: boolean
  dragging: boolean
  toggleCollapsed: () => void
  startDrag: (e: React.MouseEvent) => void
}

function readStoredWidth(storageKey: string, min: number, max: number, fallback: number): number {
  const stored = Number(localStorage.getItem(storageKey))
  if (Number.isFinite(stored) && stored >= min && stored <= max) return stored
  return fallback
}

// Extracted from kuvert's Layout.tsx - the resize-drag/collapse-threshold/
// localStorage-persistence state machine is identical logic every app's
// sidebar needs, unlike the surrounding JSX (logo, nav items, user block,
// theme toggle, logout button), which stays genuinely app-specific and is
// not part of this hook.
export function useSidebarWidth(options: UseSidebarWidthOptions): UseSidebarWidthResult {
  const {
    storageKey,
    defaultWidth = DEFAULT_WIDTH,
    minWidth = DEFAULT_MIN_WIDTH,
    maxWidth = DEFAULT_MAX_WIDTH,
    collapsedWidth = DEFAULT_COLLAPSED_WIDTH,
    collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
  } = options

  const [collapsed, setCollapsed] = useState(false)
  const [expandedWidth, setExpandedWidth] = useState(() =>
    readStoredWidth(storageKey, minWidth, maxWidth, defaultWidth),
  )
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)
  // Browsers fire a synthetic "click" on mouseup right after a drag if the
  // pointer ends up back over an element inside the sidebar (which it
  // often does for a small drag) - without this, that phantom click would
  // immediately collapse whatever width was just dragged to. Set to true
  // for the rest of this tick whenever a real drag happened; toggleCollapsed
  // checks and ignores it.
  const suppressNextClickRef = useRef(false)

  const width = collapsed ? collapsedWidth : expandedWidth

  const handlePointerMove = useCallback((e: MouseEvent) => {
    const start = dragStartRef.current
    if (!start) return
    const next = start.startWidth + (e.clientX - start.startX)
    suppressNextClickRef.current = true
    if (next < collapseThreshold) {
      setCollapsed(true)
    } else {
      setCollapsed(false)
      setExpandedWidth(Math.min(maxWidth, Math.max(minWidth, next)))
    }
  }, [collapseThreshold, maxWidth, minWidth])

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null
    setDragging(false)
    if (suppressNextClickRef.current) {
      // Only suppress the synthetic click browsers fire immediately after
      // this mouseup (same tick) - not some unrelated future click, in
      // case the drag ended with the pointer outside the sidebar and no
      // phantom click ever arrives to consume this flag itself.
      setTimeout(() => { suppressNextClickRef.current = false }, 0)
    }
  }, [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  useEffect(() => {
    if (!collapsed) localStorage.setItem(storageKey, String(expandedWidth))
  }, [collapsed, expandedWidth, storageKey])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { startX: e.clientX, startWidth: width }
    setDragging(true)
  }, [width])

  const toggleCollapsed = useCallback(() => {
    if (suppressNextClickRef.current) return
    setCollapsed((c) => !c)
  }, [])

  return { width, collapsed, dragging, toggleCollapsed, startDrag }
}
