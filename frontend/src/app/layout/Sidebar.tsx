import { DISCORD_SYMBOL, KO_FI_SYMBOL } from '@/assets'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { useAvailableUpdate, useBenchmarks } from '@/shared/hooks'
import { benchmarkPath, cn, EXTERNAL_LINKS, getVersion, openURL } from '@/shared/lib'
import { Activity, HelpCircle, LayoutGrid, PanelLeft, Settings, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

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
  showNotificationDot?: boolean
  showActiveBackground?: boolean
  to?: string
  trailing?: ReactNode
}

function SidebarItem({ active = false, icon, label, onClick, open, showNotificationDot = false, showActiveBackground = true, to, trailing }: SidebarItemProps) {
  const collapsed = !open
  const className = cn(
    'relative z-[1] flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    active && (showActiveBackground ? 'bg-sidebar-accent' : null),
    active && 'font-medium text-sidebar-accent-foreground',
  )

  const content = (
    <>
      <span className={cn(
        'relative flex size-[18px] shrink-0 items-center justify-center transition-transform duration-200 [&_svg]:size-[18px] [&_svg]:shrink-0',
        active && 'scale-110',
      )}>
        {icon}
        {showNotificationDot && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar"
          />
        )}
      </span>
      <span className={cn(
        'min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out',
        collapsed ? 'max-w-0 opacity-0' : 'max-w-[12rem] flex-1 opacity-100',
      )}>
        {label}
      </span>
      {trailing && (
        <span className={cn(
          'overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-[6rem] opacity-100',
        )}>
          {trailing}
        </span>
      )}
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

  if (!collapsed) return item

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
      className="w-[38px] shrink-0 rounded py-0.5 text-center text-[10px] font-semibold text-surface-muted-foreground"
      style={color ? { color } : undefined}
    >
      {abbreviation}
    </span>
  )

  const item = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-6 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {collapsed ? (
        pill
      ) : (
        <>
          {pill}
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </>
      )}
    </button>
  )

  if (!collapsed) return item

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
  const availableUpdate = useAvailableUpdate()
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = !open
  const benchmarksTarget = selectedBenchmark ? benchmarkPath(selectedBenchmark) : '/benchmarks'
  const primaryActiveIndex = useMemo(() => {
    if (location.pathname.startsWith('/settings')) return null
    if (location.pathname.startsWith('/history')) return 1
    if (location.pathname.startsWith('/benchmarks')) return 2
    return 0
  }, [location.pathname])

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
    <TooltipProvider key={collapsed ? 'collapsed' : 'expanded'} delayDuration={0}>
      <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="p-2">
          <SidebarItem
            icon={<PanelLeft />}
            label="RefleK's"
            onClick={onToggle}
            open={open}
            trailing={version ? <span className="text-xs text-surface-muted-foreground">v{version}</span> : null}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
          <nav aria-label="Primary" className="relative flex flex-col gap-1">
            {primaryActiveIndex !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-md bg-sidebar-accent transition-transform duration-220 ease-emphasized will-change-transform"
                style={{ transform: `translateY(${primaryActiveIndex * 36}px)` }}
              />
            )}
            <SidebarItem
              active={location.pathname === '/' || location.pathname.startsWith('/overview')}
              icon={<LayoutGrid />}
              label="Overview"
              open={open}
              showActiveBackground={false}
              to="/overview"
            />
            <SidebarItem
              active={location.pathname.startsWith('/history')}
              icon={<TrendingUp />}
              label="History"
              open={open}
              showActiveBackground={false}
              to="/history"
            />
            <SidebarItem
              active={location.pathname.startsWith('/benchmarks')}
              icon={<Activity />}
              label="Benchmarks"
              open={open}
              showActiveBackground={false}
              to={benchmarksTarget}
            />
          </nav>

          {favBenchmarks.length > 0 && (
            <section className="mt-auto flex flex-col gap-2 pt-4">
              <div className="h-px" />
              {!collapsed && <p className="px-2 text-xs font-medium text-sidebar-foreground-muted">Favorites</p>}
              <div className="flex flex-col gap-2">
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
              onClick={() => openURL(EXTERNAL_LINKS.discord)}
              open={open}
            />
            <SidebarItem
              icon={<HelpCircle />}
              label="Help"
              onClick={() => openURL(EXTERNAL_LINKS.docs)}
              open={open}
            />
            <SidebarItem
              icon={<img src={KO_FI_SYMBOL} alt="" className="size-[18px] shrink-0" />}
              label="Support"
              onClick={() => openURL(EXTERNAL_LINKS.support)}
              open={open}
            />
            <SidebarItem
              active={location.pathname === '/settings'}
              icon={<Settings />}
              label="Settings"
              open={open}
              showNotificationDot={availableUpdate?.hasUpdate === true}
              to="/settings"
            />
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  )
}
