import { useEffect, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Widget } from '../../../../shared/components'
import { usePersistedState } from '../../../../shared/hooks'
import type { BenchmarkProgress } from '../../../../shared/types'
import { formatNumber } from '../../lib/detailFormatting'

type Props = {
  progress: BenchmarkProgress
}

type Segment = {
  label: string
  count: number
  color: string
  percent: number
}

type ScopeLevel = 'all' | 'category' | 'subcategory'

function buildConicGradient(segments: Segment[]): string {
  if (!segments.length) return 'hsl(var(--muted))'

  let cursor = 0
  const stops = segments
    .map(segment => {
      const start = cursor
      const end = cursor + segment.percent
      cursor = end
      return `${segment.color} ${start}% ${end}%`
    })
    .join(', ')

  return `conic-gradient(${stops})`
}

export function RankDistributionWidget({ progress }: Props) {
  const [scopeLevel, setScopeLevel] = usePersistedState<ScopeLevel>('refleks.benchmarks.detail.rankDistribution.scope', 'all')
  const [categoryIndex, setCategoryIndex] = usePersistedState<number>('refleks.benchmarks.detail.rankDistribution.categoryIndex', 0)
  const [subcategoryIndex, setSubcategoryIndex] = usePersistedState<number>('refleks.benchmarks.detail.rankDistribution.subcategoryIndex', 0)

  const categories = progress.categories || []
  const safeCategoryIndex = Math.max(0, Math.min(Math.max(0, categories.length - 1), categoryIndex))
  const selectedCategory = categories[safeCategoryIndex]
  const selectedGroups = selectedCategory?.groups || []
  const safeSubcategoryIndex = Math.max(0, Math.min(Math.max(0, selectedGroups.length - 1), subcategoryIndex))

  useEffect(() => {
    if (safeCategoryIndex !== categoryIndex) setCategoryIndex(safeCategoryIndex)
  }, [safeCategoryIndex, categoryIndex, setCategoryIndex])

  useEffect(() => {
    if (safeSubcategoryIndex !== subcategoryIndex) setSubcategoryIndex(safeSubcategoryIndex)
  }, [safeSubcategoryIndex, subcategoryIndex, setSubcategoryIndex])

  const scopedScenarios = useMemo(() => {
    if (scopeLevel === 'all') {
      return categories.flatMap(category => category.groups.flatMap(group => group.scenarios))
    }

    if (!selectedCategory) return []

    if (scopeLevel === 'category') {
      return selectedCategory.groups.flatMap(group => group.scenarios)
    }

    const selectedGroup = selectedGroups[safeSubcategoryIndex]
    return selectedGroup?.scenarios || []
  }, [scopeLevel, categories, selectedCategory, selectedGroups, safeSubcategoryIndex])

  const segments = useMemo<Segment[]>(() => {
    const rankDefs = progress.ranks || []
    const rankCounts = Array.from({ length: rankDefs.length }, () => 0)
    let belowR1 = 0

    for (const scenario of scopedScenarios) {
      const rank = Number(scenario.scenarioRank || 0)
      if (rank <= 0) {
        belowR1 += 1
      } else {
        const index = Math.max(0, Math.min(rankDefs.length - 1, rank - 1))
        rankCounts[index] += 1
      }
    }

    const counts: Segment[] = []
    if (belowR1 > 0) {
      counts.push({
        label: 'Below R1',
        count: belowR1,
        color: 'hsl(var(--muted-foreground))',
        percent: 0,
      })
    }

    rankDefs.forEach((rank, index) => {
      counts.push({
        label: rank.name,
        count: rankCounts[index],
        color: rank.color || 'hsl(var(--primary))',
        percent: 0,
      })
    })

    const total = counts.reduce((sum, segment) => sum + segment.count, 0)
    return counts.map(segment => ({
      ...segment,
      percent: total > 0 ? (segment.count / total) * 100 : 0,
    }))
  }, [progress.ranks, scopedScenarios])

  const totalScenarios = segments.reduce((sum, segment) => sum + segment.count, 0)
  const donutBackground = buildConicGradient(segments)

  const scopeDescription = useMemo(() => {
    if (scopeLevel === 'all') return 'How your scenarios are spread across rank tiers.'
    if (scopeLevel === 'category') return `Category scope: ${selectedCategory?.name || 'Unknown'}`
    return `Subcategory scope: ${selectedGroups[safeSubcategoryIndex]?.name || 'Unknown'}`
  }, [scopeLevel, selectedCategory?.name, selectedGroups, safeSubcategoryIndex])

  const renderBody = (expanded: boolean) => {
    if (totalScenarios === 0) {
      return <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No data.</div>
    }

    const donutSize = expanded ? 'h-[200px] w-[200px]' : 'h-[160px] w-[160px]'

    return (
      <div className={`grid grid-cols-1 items-center gap-4 ${expanded ? 'sm:grid-cols-[220px_1fr]' : 'sm:grid-cols-[180px_1fr]'}`}>
        <div className={`mx-auto relative ${donutSize}`}>
          <div
            className="h-full w-full rounded-full"
            style={{ background: donutBackground }}
            aria-label="Rank distribution donut"
          />
          <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card">
            <span className="text-[11px] text-muted-foreground">Scenarios</span>
            <span className="text-xl font-semibold text-foreground">{formatNumber(totalScenarios, 0)}</span>
          </div>
        </div>

        <div className="space-y-2">
          {segments.map(segment => (
            <div key={segment.label} className="rounded-xl bg-muted/35 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="truncate text-foreground">{segment.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(segment.count, 0)} · {formatNumber(segment.percent, 1, false)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Widget
      title="Rank Distribution"
      description={scopeDescription}
      headerActions={(
        <div className="flex items-center gap-2">
          <Select value={scopeLevel} onValueChange={value => setScopeLevel(value as ScopeLevel)}>
            <SelectTrigger className="h-8 min-w-[120px] w-auto px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="subcategory">Subcategory</SelectItem>
            </SelectContent>
          </Select>

          {scopeLevel !== 'all' && categories.length > 0 && (
            <Select value={String(safeCategoryIndex)} onValueChange={value => setCategoryIndex(Number(value) || 0)}>
              <SelectTrigger className="h-8 min-w-[130px] w-auto max-w-[180px] px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category, index) => (
                  <SelectItem key={`${category.name}-${index}`} value={String(index)}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {scopeLevel === 'subcategory' && selectedGroups.length > 0 && (
            <Select value={String(safeSubcategoryIndex)} onValueChange={value => setSubcategoryIndex(Number(value) || 0)}>
              <SelectTrigger className="h-8 min-w-[130px] w-auto max-w-[180px] px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedGroups.map((group, index) => (
                  <SelectItem key={`${group.name || 'group'}-${index}`} value={String(index)}>{group.name || `Group ${index + 1}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      modalTitle="Rank Distribution"
      modalContent={renderBody(true)}
      modalWidth={920}
      modalHeight={760}
    >
      {renderBody(false)}
    </Widget>
  )
}
