import { Button } from '@/shared/components'
import type { RunEnvironment } from '@/shared/types/ipc'
import { ArrowRightLeft, PinOff } from 'lucide-react'
import { formatNumber, formatRunTimestamp, formatSessionTitle, type HistoryRun } from '../../lib/historyModels'
import { CompareStatRow, HeroStat, StatRow, StatsGroup } from './shared'

type EnvField = { label: string; key: keyof RunEnvironment }

const ENV_GROUPS: Array<{ label: string; fields: EnvField[] }> = [
  {
    label: 'App & OS',
    fields: [
      { label: 'App Version', key: 'appVersion' },
      { label: 'OS', key: 'os' },
      { label: 'Architecture', key: 'arch' },
      { label: 'OS Version', key: 'osVersion' },
      { label: 'Hostname', key: 'hostname' },
    ],
  },
  {
    label: 'PC Hardware',
    fields: [
      { label: 'CPU', key: 'cpuName' },
      { label: 'CPU Cores', key: 'cpuCores' },
      { label: 'GPU', key: 'gpuName' },
      { label: 'RAM Total (MB)', key: 'ramTotalMB' },
    ],
  },
  {
    label: 'Display Context',
    fields: [
      { label: 'Refresh Rate (Hz)', key: 'displayHz' },
      { label: 'Screen Width', key: 'screenWidth' },
      { label: 'Screen Height', key: 'screenHeight' },
      { label: 'Windowed', key: 'isWindowed' },
    ],
  },
  {
    label: 'Mouse Device',
    fields: [
      { label: 'Input Backend', key: 'mouseBackend' },
      { label: 'Vendor ID (VID)', key: 'mouseVid' },
      { label: 'Product ID (PID)', key: 'mousePid' },
      { label: 'Interface (MI)', key: 'mouseMi' },
    ],
  },
  {
    label: 'Trace Metadata',
    fields: [
      { label: 'Trace Points', key: 'tracePoints' },
      { label: 'Trace Duration (s)', key: 'traceDuration' },
      { label: 'Sample Rate (Hz)', key: 'sampleRate' },
    ],
  },
  {
    label: 'Diagnostics',
    fields: [
      { label: 'Mouse Device Path (Raw)', key: 'mouseName' },
    ],
  },
]

function formatEnvValue(env: RunEnvironment, key: keyof RunEnvironment): string {
  const raw = env[key]

  if (key === 'mouseVid' || key === 'mousePid' || key === 'mouseMi') {
    const id = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
    return id ? `0x${id}` : '—'
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '—'
    if (key === 'cpuCores') return `${Math.max(0, Math.trunc(raw))}`
    if (key === 'ramTotalMB') return formatNumber(Math.max(0, Math.trunc(raw)), 0)
    if (key === 'screenWidth' || key === 'screenHeight') return `${Math.max(0, Math.trunc(raw))}`
    if (key === 'tracePoints') return formatNumber(Math.max(0, Math.trunc(raw)), 0)
    if (key === 'sampleRate') return `${Math.max(0, Math.trunc(raw))}`
    if (key === 'traceDuration' || key === 'displayHz') return formatNumber(raw, 2)
    return formatNumber(raw)
  }

  if (typeof raw === 'boolean') {
    return raw ? 'Yes' : 'No'
  }

  if (typeof raw === 'string') {
    const value = raw.trim()
    return value.length > 0 ? value : '—'
  }

  return '—'
}

export function EnvironmentTab({ primaryRun, compareRun, onClearPrimaryRun, onClearComparison }: {
  primaryRun: HistoryRun
  compareRun: HistoryRun | null
  onClearPrimaryRun: () => void
  onClearComparison: () => void
}) {
  if (compareRun) {
    return (
      <CompareEnvironmentView
        primaryRun={primaryRun}
        compareRun={compareRun}
        onClearPrimaryRun={onClearPrimaryRun}
        onClearComparison={onClearComparison}
      />
    )
  }

  const env = primaryRun.item.env

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{primaryRun.scenarioName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatRunTimestamp(primaryRun.playedAt)} · {formatSessionTitle(primaryRun.session)}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearPrimaryRun}>
          <PinOff className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat label="VID" value={formatEnvValue(env, 'mouseVid')} />
        <HeroStat label="PID" value={formatEnvValue(env, 'mousePid')} />
        <HeroStat label="MI" value={formatEnvValue(env, 'mouseMi')} />
        <HeroStat label="Backend" value={formatEnvValue(env, 'mouseBackend')} />
      </div>

      {ENV_GROUPS.map(group => (
        <StatsGroup key={group.label} label={group.label}>
          {group.fields.map(field => (
            <StatRow key={field.key} label={field.label} value={formatEnvValue(env, field.key)} />
          ))}
        </StatsGroup>
      ))}
    </>
  )
}

function CompareEnvironmentView({ primaryRun, compareRun, onClearPrimaryRun, onClearComparison }: {
  primaryRun: HistoryRun
  compareRun: HistoryRun
  onClearPrimaryRun: () => void
  onClearComparison: () => void
}) {
  const primaryEnv = primaryRun.item.env
  const compareEnv = compareRun.item.env

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Pinned</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{primaryRun.scenarioName}</div>
            <div className="text-[11px] text-muted-foreground">{formatRunTimestamp(primaryRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearPrimaryRun}>
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-start justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Compare</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{compareRun.scenarioName}</div>
            <div className="text-[11px] text-muted-foreground">{formatRunTimestamp(compareRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearComparison}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {ENV_GROUPS.map(group => (
        <StatsGroup key={group.label} label={group.label}>
          {group.fields.map(field => (
            <CompareStatRow
              key={field.key}
              label={field.label}
              a={formatEnvValue(primaryEnv, field.key)}
              b={formatEnvValue(compareEnv, field.key)}
            />
          ))}
        </StatsGroup>
      ))}
    </>
  )
}
