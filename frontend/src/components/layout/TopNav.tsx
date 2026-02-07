import { HelpCircle, Settings as SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BrowserOpenURL, EventsOn } from '../../../wailsjs/runtime'
import { DISCORD_SYMBOL, KO_FI_SYMBOL } from '../../assets'
import { checkForUpdates, downloadAndInstallUpdate, getVersion } from '../../lib/internal'
import type { UpdateInfo } from '../../types/ipc'

function Link({ to, children, end = false }: { to: string, children: ReactNode, end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `px-3 py-1 rounded hover:bg-surface-3 ${isActive ? 'bg-surface-3' : ''}`}
    >
      {children}
    </NavLink>
  )
}

export function TopNav() {
  const [version, setVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(() => setVersion(''))
    // Proactive check (also handled by backend event)
    checkForUpdates().then((info) => { if (info?.hasUpdate) setUpdate(info) }).catch(() => { })
    // Listen for backend event
    const off = EventsOn('update:available', (data: any) => {
      if (data && typeof data === 'object' && data.latestVersion) setUpdate(data as UpdateInfo)
    })
    return () => { try { off() } catch { /* noop */ } }
  }, [])
  const link = (to: string, label: ReactNode, end = false) => (
    <Link to={to} end={end}>{label}</Link>
  )
  return (
    <div className="relative flex items-center px-4 py-2 bg-surface-2 text-primary border-b border-primary">
      <div className="flex items-center gap-2">
        <div className="font-semibold">RefleK's</div>
        {version && <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary text-secondary">v{version}</span>}
        {update?.hasUpdate && (
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-on-accent hover:opacity-90"
              title="Click to update"
              onClick={async () => {
                if (!update?.latestVersion) return
                const ok = window.confirm(`Download and install v${update.latestVersion} now? The app will close.`)
                if (!ok) return
                try {
                  await downloadAndInstallUpdate(update.latestVersion)
                } catch (e) {
                  console.error('Update failed', e)
                  alert('Update failed: ' + (e as Error)?.message)
                }
              }}
            >
              Update to v{update.latestVersion}
            </button>
            <a
              href="https://refleks-app.com/changelog/"
              onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/changelog/') }}
              className="text-[10px] underline underline-offset-2 text-secondary hover:text-primary"
            >
              What's new
            </a>
          </div>
        )}
      </div>

      {/* Centered tabs - absolutely centered so side content doesn't affect position */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2 items-center">
        {link('/scenarios', 'Scenarios')}
        {link('/', 'Sessions', true)}
        {link('/benchmarks', 'Benchmarks')}
      </div>

      {/* Right-side actions - pushed to the end with ml-auto */}
      <div className="flex items-center gap-2 ml-auto">
        <a
          href="https://discord.gg/SFsf4GQhJU"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://discord.gg/SFsf4GQhJU') }}
          title="Join our Discord"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <img src={DISCORD_SYMBOL} alt="Discord" className="h-5 w-auto" />
        </a>

        <a
          href="https://refleks-app.com/home/#support"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://refleks-app.com/home/#support') }}
          title="Help"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Help</span>
        </a>

        <a
          href="https://ko-fi.com/arm8_"
          onClick={(e) => { e.preventDefault(); BrowserOpenURL('https://ko-fi.com/arm8_') }}
          title="Support on Ko-fi"
          className="px-3 py-1 rounded hover:bg-surface-3 flex items-center"
        >
          <img src={KO_FI_SYMBOL} alt="Ko-fi" className="h-5 w-auto" />
        </a>

        {link('/settings', (
          <>
            <SettingsIcon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Settings</span>
          </>
        ))}
      </div>
    </div>
  )
}
