import { Activity, HelpCircle, LayoutGrid, PanelLeft, Settings, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { DISCORD_SYMBOL, KO_FI_SYMBOL } from '../../assets'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shared/components/ui/tooltip'
import { useBenchmarks } from '../../shared/hooks'
import { benchmarkPath, cn, getVersion, openURL } from '../../shared/lib'

type SidebarProps = {
  open: boolean
  onToggle: () => void
}

type SidebarItemProps = {
  active?: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
  open: boolean
  to?: string
  trailing?: ReactNode
}

function SidebarItem({ active = false, icon, label, onClick, open, to, trailing }: SidebarItemProps) {
  const collapsed = !open
  const className = cn(
    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
    collapsed && 'justify-center px-0',
  )

  const content = (
    <>
      <span className="flex size-[18px] shrink-0 items-center justify-center [&_svg]:size-[18px] [&_svg]:shrink-0">
        {icon}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </>
  )

  const item = to ? (
    <NavLink to={to} end={to === '/'} onClick={onClick} className={className}>
      {content}
    </NavLink>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )

  if (!collapsed) {
    return item
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

type SidebarFavoriteItemProps = {
  abbreviation: string
  active: boolean
  color?: string
  label: string
  open: boolean
  onClick: () => void
}

function SidebarFavoriteItem({ abbreviation, active, color, label, open, onClick }: SidebarFavoriteItemProps) {
  const collapsed = !open
  const pill = (
    <span
      className="w-[38px] rounded border border-sidebar-border py-0.5 text-center text-[10px] font-semibold text-muted-foreground"
      style={color ? { borderColor: color, color } : undefined}
    >
      {abbreviation}
    </span>
  )

  const item = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {pill}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
    </button>
  )

  if (!collapsed) {
    return item
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const [version, setVersion] = useState('')
  const { benchmarks, favorites, selectBenchmark, selectedBenchmark } = useBenchmarks()
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = !open

  const favBenchmarks = useMemo(() => {
    if (favorites.length === 0 || benchmarks.length === 0) return []
    const byName = new Map(benchmarks.map(b => [b.benchmarkName, b]))
    return favorites
      .map(name => byName.get(name))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .slice(0, 8) // limit to 8 favorites in sidebar
  }, [benchmarks, favorites])

  useEffect(() => {
    getVersion().then(v => setVersion(String(v || ''))).catch(() => { })
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="p-2">
          <SidebarItem
            icon={<PanelLeft />}
            label="RefleK's"
            onClick={onToggle}
            open={open}
            trailing={version ? <span className="text-xs text-muted-foreground">v{version}</span> : null}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
          <nav aria-label="Primary" className="flex flex-col gap-1">
            <SidebarItem
              active={location.pathname === '/'}
              icon={<LayoutGrid />}
              label="Overview"
              open={open}
              to="/"
            />
            <SidebarItem
              active={location.pathname.startsWith('/history')}
              icon={<TrendingUp />}
              label="History"
              open={open}
              to="/history"
            />
            <SidebarItem
              active={location.pathname.startsWith('/benchmarks')}
              icon={<Activity />}
              label="Benchmarks"
              open={open}
              to="/benchmarks"
            />
          </nav>

          {favBenchmarks.length > 0 && (
            <section className="mt-auto flex flex-col gap-2 pt-4">
              <div className="h-px" />
              {!collapsed && <p className="px-2 text-xs font-medium text-sidebar-foreground-muted">Favorites</p>}
              <div className="flex flex-col gap-1">
                {favBenchmarks.map(benchmark => {
                  const onBenchmarksPage = location.pathname.startsWith('/benchmarks')
                  return (
                    <SidebarFavoriteItem
                      key={benchmark.benchmarkName}
                      abbreviation={benchmark.abbreviation}
                      active={selectedBenchmark === benchmark.benchmarkName}
                      color={benchmark.color}
                      label={benchmark.benchmarkName}
                      open={open}
                      onClick={() => {
                        selectBenchmark(benchmark.benchmarkName)
                        if (onBenchmarksPage) {
                          navigate(benchmarkPath(benchmark.benchmarkName))
                        }
                      }}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="border-t border-sidebar-border p-2">
          <nav aria-label="Secondary" className="flex flex-col gap-1">
            <SidebarItem
              icon={<img src={DISCORD_SYMBOL} alt="" className="size-[18px] shrink-0" />}
              label="Discord"
              onClick={() => openURL('https://discord.gg/SFsf4GQhJU')}
              open={open}
            />
            <SidebarItem
              icon={<HelpCircle />}
              label="Help"
              onClick={() => openURL('https://refleks-app.com/home/#support')}
              open={open}
            />
            <SidebarItem
              icon={<img src={KO_FI_SYMBOL} alt="" className="size-[18px] shrink-0" />}
              label="Support"
              onClick={() => openURL('https://ko-fi.com/arm8_')}
              open={open}
            />
            <SidebarItem
              active={location.pathname === '/settings'}
              icon={<Settings />}
              label="Settings"
              open={open}
              to="/settings"
            />
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  )
}
