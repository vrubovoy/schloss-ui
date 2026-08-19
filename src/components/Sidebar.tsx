import { type CSSProperties, type ReactNode } from 'react'
import { LogOut, X } from 'lucide-react'
import { useSidebarWidth } from '../hooks/useSidebarWidth'
import { ThemeToggle } from './ThemeToggle'

export interface SidebarNavItem {
  to: string
  icon: ReactNode
  label: string
}

export interface SidebarLinkRenderProps {
  to: string
  active: boolean
  /** Always false for the mobile drawer (it has no collapsed rail). */
  collapsed: boolean
  icon: ReactNode
  label: string
  style: CSSProperties
  /** Attach directly to the rendered link - desktop stops the click from
   * also toggling collapse (the whole rail is a click target for that),
   * mobile closes the drawer instead. */
  onClick: (e: React.MouseEvent) => void
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void
}

export interface SidebarExtraNavContext {
  collapsed: boolean
  variant: 'desktop' | 'mobile'
}

export interface SidebarProps {
  /** localStorage key the expanded width persists under - see useSidebarWidth. */
  storageKey: string
  ariaLabel: string
  brandName: string
  /** Rendered inside the accent-colored 28x28 badge. */
  brandMark: ReactNode
  navItems: SidebarNavItem[]
  /** Current pathname; a nav item is active when this starts with its `to`. */
  activePath: string
  /** Router-agnostic: schloss-ui doesn't depend on any router, so the
   * caller's own <Link> is rendered here with the props/handlers this
   * component computes (style, active, hover handlers). Must set
   * key={props.to} on the returned element. */
  renderLink: (props: SidebarLinkRenderProps) => ReactNode
  /** Extra content after the standard nav items (e.g. zettel's tag
   * "folders") - rendered in both the desktop rail (only past the
   * collapsed rail's icon-only mode) and the mobile drawer. */
  extraNav?: (ctx: SidebarExtraNavContext) => ReactNode
  user: { name: string; email: string } | null
  onAccountClick: () => void
  onLogout: () => void | Promise<void>
  mobileOpen: boolean
  onCloseMobile: () => void
}

const navLinkBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  borderRadius: 8,
  textDecoration: 'none',
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

function desktopLinkStyle(active: boolean, collapsed: boolean): CSSProperties {
  return {
    ...navLinkBaseStyle,
    padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
    color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    fontWeight: active ? 600 : 400,
    transition: 'background 150ms, color 150ms',
    justifyContent: collapsed ? 'center' : 'flex-start',
  }
}

function mobileLinkStyle(active: boolean): CSSProperties {
  return {
    ...navLinkBaseStyle,
    padding: '0.5rem 0.75rem',
    color: active ? 'white' : 'var(--sidebar-text)',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    fontWeight: active ? 600 : 400,
  }
}

function hoverHandlers(active: boolean) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      if (!active) e.currentTarget.style.background = 'transparent'
    },
  }
}

/** The platform's shared collapsible/resizable sidebar rail plus its
 * mobile drawer counterpart - extracted from kuvert/tafel/zettel, which
 * had each copy-pasted an identical ~250 lines of this (only nav items,
 * brand mark, and storage key actually differed). useSidebarWidth already
 * carried the resize/collapse *logic*; this is the JSX that was still
 * being forked per app. */
export function Sidebar({
  storageKey,
  ariaLabel,
  brandName,
  brandMark,
  navItems,
  activePath,
  renderLink,
  extraNav,
  user,
  onAccountClick,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { width, collapsed, dragging, toggleCollapsed, startDrag } = useSidebarWidth({ storageKey })

  return (
    <>
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 40 }}
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop rail - clicking anywhere on it that isn't a nav link/
          button (i.e. empty space: the logo area, gaps around the nav
          list, the padding around the bottom actions) toggles collapsed/
          expanded. Each interactive child stops the click from bubbling
          here, so clicking an actual control never also toggles the rail. */}
      <aside
        onClick={toggleCollapsed}
        aria-label={ariaLabel}
        style={{
          width,
          background: 'var(--sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: dragging ? 'none' : 'width 200ms ease',
          position: 'relative',
          zIndex: 50,
          cursor: 'pointer',
        }}
        className="hidden-mobile"
      >
        {/* Resize handle - drag anywhere along the rail's right edge to
            resize continuously; dragging past the collapse threshold
            snaps shut. Wider than the border itself (10px) so it's easy
            to grab. */}
        <div
          onMouseDown={startDrag}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: -5, width: 10,
            cursor: 'col-resize', zIndex: 61,
          }}
        />
        <div style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 0 0 18px' : '0 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: '0.625rem',
          overflow: 'hidden',
        }}>
          <div style={{
            width: 28, height: 28, background: 'var(--sidebar-accent)',
            borderRadius: 8, flexShrink: 0, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {brandMark}
          </div>
          {!collapsed && (
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              {brandName}
            </span>
          )}
        </div>

        {/* minHeight: 0 - a flex item won't scroll within its space
            without it, growing the rail past the viewport instead once
            there are enough nav items. */}
        <nav style={{ flex: 1, minHeight: 0, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map(({ to, icon, label }) => {
            const active = activePath.startsWith(to)
            return renderLink({
              to,
              active,
              collapsed,
              icon,
              label,
              style: desktopLinkStyle(active, collapsed),
              onClick: (e) => e.stopPropagation(),
              ...hoverHandlers(active),
            })
          })}
          {extraNav?.({ collapsed, variant: 'desktop' })}
        </nav>

        <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {user && (
            <div
              onClick={(e) => { e.stopPropagation(); onAccountClick() }}
              title="Настройки аккаунта"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
                marginBottom: 4,
                cursor: 'pointer', borderRadius: 8,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--sidebar-accent)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                  <div style={{
                    color: 'var(--sidebar-text-active)', fontSize: '0.8125rem', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {user.name}
                  </div>
                  <div style={{
                    color: 'var(--sidebar-text)', fontSize: '0.6875rem',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {user.email}
                  </div>
                </div>
              )}
            </div>
          )}
          <ThemeToggle
            align="left"
            trigger={({ icon, onClick }) => (
              <button
                onClick={(e) => { e.stopPropagation(); onClick() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--sidebar-text)',
                  fontSize: '0.8125rem', transition: 'background 150ms',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width: '100%',
                }}
              >
                {icon}
                {!collapsed && <span>Тема</span>}
              </button>
            )}
          />
          {user && (
            <button
              onClick={async (e) => { e.stopPropagation(); await onLogout() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--sidebar-text)',
                fontSize: '0.8125rem', transition: 'background 150ms',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
              }}
            >
              <LogOut size={15} />
              {!collapsed && 'Выйти'}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        style={{
          position: 'fixed', left: mobileOpen ? 0 : -260, top: 0, bottom: 0,
          width: 260, background: 'var(--sidebar-bg)',
          zIndex: 50, transition: 'left 250ms ease',
          display: 'flex', flexDirection: 'column',
        }}
        className="show-mobile"
      >
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9375rem' }}>{brandName}</span>
          <button onClick={onCloseMobile} aria-label="Закрыть меню" style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, icon, label }) => {
            const active = activePath.startsWith(to)
            return renderLink({
              to,
              active,
              collapsed: false,
              icon,
              label,
              style: mobileLinkStyle(active),
              onClick: onCloseMobile,
            })
          })}
          {extraNav?.({ collapsed: false, variant: 'mobile' })}
        </nav>
      </aside>
    </>
  )
}
