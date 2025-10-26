import { useMemo, useState } from 'react'
import { getScenarioName } from '../../lib/utils'
import { goto } from '../../lib/nav'
import type { ScenarioRecord } from '../../types/ipc'

function fmtPct01(v: any) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '—'
  return (n * 100).toFixed(1) + '%'
}
function fmtSec(v: any) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '—'
  return `${n.toFixed(2)}s`
}

function normalize(arr: number[]): (x: number) => number {
  const vals = arr.filter(n => Number.isFinite(n))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (!isFinite(min) || !isFinite(max) || max === min) return () => 0.5
  return (x: number) => (x - min) / (max - min)
}

export function Findings({ items }: { items: ScenarioRecord[] }) {
  const [openTab, setOpenTab] = useState<'analysis' | 'raw'>('analysis')

  const ranked = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [] as Array<{ rec: ScenarioRecord, score: number }>
    // Build metric arrays
    const scores = items.map(it => Number(it.stats['Score'] ?? 0))
    const accs01 = items.map(it => Number(it.stats['Accuracy'] ?? 0)) // 0..1
    const ttks = items.map(it => Number(it.stats['Real Avg TTK'] ?? NaN))

    const nScore = normalize(scores)
    const nAcc = normalize(accs01.map(a => a * 100)) // percent scale for stability
    const nTtk = normalize(ttks)

    // weights: emphasize score/accuracy, small penalty for long TTK
    const wScore = 0.6, wAcc = 0.35, wTtk = 0.05

    return items.map((rec, i) => {
      const s = nScore(scores[i])
      const a = nAcc(accs01[i] * 100)
      const t = nTtk(ttks[i])
      const composite = wScore * s + wAcc * a + wTtk * (1 - t) // lower TTK is better
      return { rec, score: composite }
    }).sort((a, b) => b.score - a.score)
  }, [items])

  const strongest = ranked.slice(0, Math.min(3, ranked.length))
  const weakest = ranked.slice(-Math.min(3, ranked.length)).reverse()

  const openItem = (rec: ScenarioRecord) => {
    const file = encodeURIComponent(rec.filePath)
    const tab = openTab
    goto(`/scenarios?file=${file}&tab=${tab}`)
  }

  const Row = ({ rec }: { rec: ScenarioRecord }) => (
    <div className="flex items-center justify-between gap-3 p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
      <div className="flex flex-col">
        <div className="text-sm text-[var(--text-primary)] font-medium">{getScenarioName(rec)}</div>
        <div className="text-xs text-[var(--text-secondary)]">
          Score: <b className="text-[var(--text-primary)]">{Math.round(Number(rec.stats['Score'] ?? 0))}</b>
          {' '}• Acc: <b className="text-[var(--text-primary)]">{fmtPct01(rec.stats['Accuracy'])}</b>
          {' '}• TTK: <b className="text-[var(--text-primary)]">{fmtSec(rec.stats['Real Avg TTK'])}</b>
        </div>
      </div>
      <button
        className="text-xs px-2 py-1 rounded border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
        onClick={() => openItem(rec)}
      >Open</button>
    </div>
  )

  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <div className="px-3 py-2 border-b border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] flex items-center justify-between">
        <span>Performance findings</span>
        <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <span>Open in</span>
          <select
            className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded px-2 py-1 border border-[var(--border-primary)]"
            value={openTab}
            onChange={(e) => setOpenTab(e.target.value as any)}
          >
            <option value="analysis">Analysis</option>
            <option value="raw">Raw Stats</option>
          </select>
        </label>
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">Strongest</div>
          <div className="space-y-2">
            {strongest.length === 0 && <div className="text-xs text-[var(--text-secondary)]">No items.</div>}
            {strongest.map(x => <Row key={x.rec.filePath} rec={x.rec} />)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">Weakest</div>
          <div className="space-y-2">
            {weakest.length === 0 && <div className="text-xs text-[var(--text-secondary)]">No items.</div>}
            {weakest.map(x => <Row key={x.rec.filePath} rec={x.rec} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
