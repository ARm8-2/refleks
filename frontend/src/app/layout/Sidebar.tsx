import { Activity, HelpCircle, LayoutGrid, PanelLeft, PanelLeftClose, Settings, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { GetVersion } from '../../../wailsjs/go/main/App'
import { BrowserOpenURL } from '../../../wailsjs/runtime'
import { DISCORD_SYMBOL, KO_FI_SYMBOL } from '../../assets'
import { useBenchmarks } from '../../shared/hooks/useBenchmarks'
import { benchmarkPath } from '../../shared/lib/navigation'

// Widths in pixels
const COLLAPSED_WIDTH = 52
const EXPANDED_WIDTH = 200
// Item padding (relative to section) to center 20px icon in collapsed state
// When collapsed: icon should be centered in 52px = (52 - 20) / 2 = 16px from edge
// Since section has 8px padding, item needs 16 - 8 = 8px padding
const COLLAPSED_ITEM_PADDING = 8
const EXPANDED_ITEM_PADDING = 8

interface SidebarProps {
  isCollapsed: boolean
  isExpanded: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onToggle: () => void
}

interface NavItemProps {
  to: string
  icon: ReactNode
  label: string
  isExpanded: boolean
  end?: boolean
}

function NavItem({ to, icon, label, isExpanded, end = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center h-9 rounded-lg overflow-hidden
        ${isActive
          ? 'bg-accent/15 text-accent'
          : 'text-secondary hover:bg-surface-3 hover:text-primary'
        }`
      }
      style={{
        paddingLeft: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
        paddingRight: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
        gap: isExpanded ? 12 : 0,
        transition: 'padding 200ms ease-out, gap 200ms ease-out, background-color 150ms',
      }}
      title={label}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
      <span
        className="whitespace-nowrap text-sm"
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      >
        {label}
      </span>
    </NavLink>
  )
}

interface ActionButtonProps {
  icon: ReactNode
  label: string
  isExpanded: boolean
  onClick?: () => void
  href?: string
}

function ActionButton({ icon, label, isExpanded, onClick, href }: ActionButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (href) {
      e.preventDefault()
      BrowserOpenURL(href)
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center h-9 rounded-lg overflow-hidden
        text-secondary hover:bg-surface-3 hover:text-primary w-full text-left"
      style={{
        paddingLeft: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
        paddingRight: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
        gap: isExpanded ? 12 : 0,
        transition: 'padding 200ms ease-out, gap 200ms ease-out, background-color 150ms',
      }}
      title={label}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
      <span
        className="whitespace-nowrap text-sm"
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      >
        {label}
      </span>
    </button>
  )
}

export function Sidebar({ isCollapsed, isExpanded, onMouseEnter, onMouseLeave, onToggle }: SidebarProps) {
  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH
  const [version, setVersion] = useState('')
  const { benchmarks, favorites, selectedBenchmark } = useBenchmarks()
  const location = useLocation()

  // Show up to 3 favorite benchmarks in the sidebar
  const favBenchmarks = useMemo(() => {
    if (favorites.length === 0 || benchmarks.length === 0) return []
    const byName = new Map(benchmarks.map(b => [b.benchmarkName, b]))
    return favorites
      .map(name => byName.get(name))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .slice(0, 3)
  }, [benchmarks, favorites])

  useEffect(() => {
    GetVersion().then(v => setVersion(String(v || ''))).catch(() => { })
  }, [])

  return (
    <aside
      className="flex-shrink-0 h-full bg-surface-2 border-r border-primary transition-[width] duration-200 ease-out overflow-hidden"
      style={{ width }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Inner container with fixed width to prevent content reflow */}
      <div className="flex flex-col h-full" style={{ width: EXPANDED_WIDTH }}>
        {/* Header */}
        <div className="px-2 border-b border-primary">
          <div
            className="flex items-center h-12 overflow-hidden"
            style={{
              paddingLeft: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
              paddingRight: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
              gap: isExpanded ? 12 : 0,
              transition: 'padding 200ms ease-out, gap 200ms ease-out',
            }}
          >
            <button
              onClick={onToggle}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-secondary hover:text-primary transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <span
              className="font-semibold text-primary whitespace-nowrap text-sm"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: 'opacity 200ms ease-out',
              }}
            >
              RefleK's
              {version && <span className="font-normal text-secondary text-xs ml-1.5">v{version}</span>}
            </span>
          </div>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 flex flex-col gap-1 p-2">
          <NavItem
            to="/"
            icon={<LayoutGrid size={18} />}
            label="Overview"
            isExpanded={isExpanded}
            end
          />
          <NavItem
            to="/history"
            icon={<TrendingUp size={18} />}
            label="History"
            isExpanded={isExpanded}
          />
          <NavItem
            to="/benchmarks"
            icon={<Activity size={18} />}
            label="Benchmarks"
            isExpanded={isExpanded}
          />
        </nav>

        {/* Favorite benchmarks */}
        {favBenchmarks.length > 0 && (
          <div className="flex flex-col gap-1 p-2 border-t border-primary">
            {favBenchmarks.map(b => {
              return (
                <NavLink
                  key={b.benchmarkName}
                  to={benchmarkPath(b.benchmarkName)}
                  className={() => {
                    const selected = selectedBenchmark === b.benchmarkName
                    return `flex items-center h-8 rounded-lg overflow-hidden ${selected ? 'bg-accent/15 text-accent' : 'text-secondary hover:bg-surface-3 hover:text-primary'}`
                  }}
                  style={{
                    paddingLeft: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
                    paddingRight: isExpanded ? EXPANDED_ITEM_PADDING : COLLAPSED_ITEM_PADDING,
                    gap: isExpanded ? 8 : 0,
                    transition: 'padding 200ms ease-out, gap 200ms ease-out, background-color 150ms',
                  }}
                  title={b.benchmarkName}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary text-secondary ${isExpanded ? 'shrink-0' : 'inline-block w-[36px] text-center truncate -ml-2'}`}
                    style={b.color ? { borderColor: b.color, color: b.color } : undefined}
                    title={b.abbreviation}
                  >
                    {b.abbreviation}
                  </span>
                  <span
                    className="whitespace-nowrap text-xs truncate"
                    style={{
                      opacity: isExpanded ? 1 : 0,
                      transition: 'opacity 200ms ease-out',
                    }}
                  >
                    {b.benchmarkName}
                  </span>
                </NavLink>
              )
            })}
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 p-2 border-t border-primary">
          <ActionButton
            icon={<img src={DISCORD_SYMBOL} alt="Discord" className="w-4 h-4" />}
            label="Discord"
            isExpanded={isExpanded}
            href="https://discord.gg/SFsf4GQhJU"
          />
          <ActionButton
            icon={<HelpCircle size={18} />}
            label="Help"
            isExpanded={isExpanded}
            href="https://refleks-app.com/home/#support"
          />
          <ActionButton
            icon={<img src={KO_FI_SYMBOL} alt="Ko-fi" className="w-4 h-4" />}
            label="Support"
            isExpanded={isExpanded}
            href="https://ko-fi.com/arm8_"
          />
          <NavItem
            to="/settings"
            icon={<Settings size={18} />}
            label="Settings"
            isExpanded={isExpanded}
          />
        </div>
      </div>
    </aside>
  )
}
