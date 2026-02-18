import { Activity, HelpCircle, LayoutGrid, PanelLeft, Settings, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { DISCORD_SYMBOL, KO_FI_SYMBOL } from '../../assets'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  Sidebar as SidebarRoot,
  SidebarSeparator,
  useSidebar,
} from '../../shared/components/ui/sidebar'
import { useBenchmarks } from '../../shared/hooks'
import { benchmarkPath, getVersion, openURL } from '../../shared/lib'

export function Sidebar() {
  const [version, setVersion] = useState('')
  const { benchmarks, favorites, selectedBenchmark } = useBenchmarks()
  const location = useLocation()
  const { toggleSidebar } = useSidebar()

  const favBenchmarks = useMemo(() => {
    if (favorites.length === 0 || benchmarks.length === 0) return []
    const byName = new Map(benchmarks.map(b => [b.benchmarkName, b]))
    return favorites
      .map(name => byName.get(name))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .slice(0, 5) // limit to 5 favorites in sidebar
  }, [benchmarks, favorites])

  useEffect(() => {
    getVersion().then(v => setVersion(String(v || ''))).catch(() => { })
  }, [])

  return (
    <SidebarRoot variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Toggle Sidebar" onClick={toggleSidebar}>
              <PanelLeft />
              <span className="font-semibold">RefleK's</span>
              {version && <span className="text-xs text-muted-foreground">v{version}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === '/'} tooltip="Overview">
                  <NavLink to="/" end>
                    <LayoutGrid />
                    <span>Overview</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/history')} tooltip="History">
                  <NavLink to="/history">
                    <TrendingUp />
                    <span>History</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/benchmarks')} tooltip="Benchmarks">
                  <NavLink to="/benchmarks">
                    <Activity />
                    <span>Benchmarks</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {favBenchmarks.length > 0 && (
          <div className="mt-auto">
            <SidebarGroup>
              <SidebarGroupLabel>Favorites</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {favBenchmarks.map(b => (
                    <SidebarMenuItem key={b.benchmarkName}>
                      <SidebarMenuButton
                        asChild
                        isActive={selectedBenchmark === b.benchmarkName}
                        tooltip={b.benchmarkName}
                        size="sm"
                        className="group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:mx-auto"
                      >
                        <NavLink to={benchmarkPath(b.benchmarkName)}>
                          <span
                            className="w-[38px] group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)*0.8)] group-data-[collapsible=icon]:max-w-full py-0.5 rounded text-[10px] font-semibold border border-sidebar-border text-muted-foreground text-center shrink-0 overflow-hidden"
                            style={b.color ? { borderColor: b.color, color: b.color } : undefined}
                          >
                            {b.abbreviation}
                          </span>
                          <span className="truncate group-data-[collapsible=icon]:hidden">{b.benchmarkName}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Discord" onClick={() => openURL('https://discord.gg/SFsf4GQhJU')}>
              <img src={DISCORD_SYMBOL} alt="" className="size-4 shrink-0" />
              <span>Discord</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help" onClick={() => openURL('https://refleks-app.com/home/#support')}>
              <HelpCircle />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Support" onClick={() => openURL('https://ko-fi.com/arm8_')}>
              <img src={KO_FI_SYMBOL} alt="" className="size-4 shrink-0" />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === '/settings'} tooltip="Settings">
              <NavLink to="/settings">
                <Settings />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  )
}
