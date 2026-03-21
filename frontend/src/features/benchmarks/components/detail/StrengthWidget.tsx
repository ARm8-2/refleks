import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Widget } from '@/shared/components'
import { usePersistedState } from '@/shared/hooks'
import { STORAGE_KEYS } from '@/shared/lib'
import type { BenchmarkProgress } from '@/shared/types'
import { useMemo } from 'react'
import { formatNumber, normalizedRankProgress } from '../../lib/detailFormatting'

type Props = {
  progress: BenchmarkProgress
}

type StrengthRow = {
  label: string
  percent: number
  avgScore: number
  color: string
  rankName: string
}

type StrengthLevel = 'category' | 'subcategory' | 'scenario'

export function StrengthWidget({ progress }: Props) {
  const [level, setLevel] = usePersistedState<StrengthLevel>(STORAGE_KEYS.benchmarksDetailStrengthLevel, 'category')

  const rows = useMemo<StrengthRow[]>(() => {
    const rankDefs = progress.ranks || []

    const buildRow = (label: string, color: string, scenarios: Array<{ scenarioRank: number; score: number; thresholds: number[] }>): StrengthRow => {
      if (!scenarios.length) {
        return { label, percent: 0, avgScore: 0, color, rankName: 'Unranked' }
      }

      const values = scenarios.map(scenario =>
        normalizedRankProgress(scenario.scenarioRank, scenario.score, scenario.thresholds),
      )
      const average = values.reduce((sum, value) => sum + value, 0) / values.length
      const percent = Math.round(average * 100)
      const avgScore = scenarios.reduce((sum, scenario) => sum + Number(scenario.score || 0), 0) / scenarios.length

      const rankIndex = rankDefs.length
        ? Math.max(0, Math.min(rankDefs.length - 1, Math.floor((percent / 100) * rankDefs.length)))
        : 0

      return {
        label,
        percent,
        avgScore,
        color: rankDefs[rankIndex]?.color || color || 'var(--primary)',
        rankName: rankDefs[rankIndex]?.name || 'Unranked',
      }
    }

    const data: StrengthRow[] = []
    if (level === 'category') {
      for (const category of progress.categories) {
        data.push(
          buildRow(
            category.name,
            category.color || 'var(--primary)',
            category.groups.flatMap(group => group.scenarios),
          ),
        )
      }
    } else if (level === 'subcategory') {
      for (const category of progress.categories) {
        for (const group of category.groups) {
          data.push(
            buildRow(
              group.name ? `${category.name}: ${group.name}` : category.name,
              group.color || category.color || 'var(--primary)',
              group.scenarios,
            ),
          )
        }
      }
    } else {
      for (const category of progress.categories) {
        for (const group of category.groups) {
          for (const scenario of group.scenarios) {
            data.push(
              buildRow(
                scenario.name,
                category.color || 'var(--primary)',
                [scenario],
              ),
            )
          }
        }
      }
    }

    return data.sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label))
  }, [progress, level])

  const levelLabel = level === 'category'
    ? 'Category'
    : level === 'subcategory'
      ? 'Subcategory'
      : 'Scenario'

  const renderBody = (expanded: boolean) => {
    if (rows.length === 0) {
      return <div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">No data.</div>
    }

    return (
      <div className={expanded ? 'space-y-3 overflow-auto pr-1' : 'space-y-2.5 max-h-[320px] overflow-auto pr-1'}>
        {rows.map(row => (
          <div key={row.label} className="rounded-xl bg-secondary p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className={`font-medium text-foreground truncate ${expanded ? 'text-sm' : ''}`}>{row.label}</div>
              <div className="text-xs text-muted-foreground">{row.rankName} · Avg {formatNumber(row.avgScore, 1)}</div>
            </div>

            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.percent}%`, backgroundColor: row.color }}
              />
            </div>

            <div className="mt-1 text-xs text-muted-foreground">{row.percent}%</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Widget
      title="Strength Breakdown"
      description={`${levelLabel}-level progress toward max rank.`}
      headerActions={(
        <Select value={level} onValueChange={value => setLevel(value as StrengthLevel)}>
          <SelectTrigger className="h-8 min-w-[130px] w-auto px-2 text-xs bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="subcategory">Subcategory</SelectItem>
            <SelectItem value="scenario">Scenario</SelectItem>
          </SelectContent>
        </Select>
      )}
      modalTitle="Strength Breakdown"
      modalContent={renderBody(true)}
      modalWidth={900}
      modalHeight={760}
    >
      {renderBody(false)}
    </Widget>
  )
}
