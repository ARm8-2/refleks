import { MISSING_STR } from '../../lib/constants'
import { formatNumber } from '../../lib/utils'

type EnergyCellProps = {
  s: any
  g: any
  si: number
  hasEnergy: boolean
}

export function EnergyCell({ s, g, si, hasEnergy }: EnergyCellProps) {
  if (!hasEnergy) return null

  // Group Energy (vt-energy style)
  if (s.energy == null && g.energy != null) {
    if (si === 0) {
      return (
        <div className="text-[12px] text-primary flex items-center justify-center" style={{ gridRow: `span ${g.scenarios.length}` }}>
          {formatNumber(Number(g.energy))}
        </div>
      )
    }
    return null
  }

  // Scenario Energy (ra-s5 style)
  return (
    <div className="text-[12px] text-primary flex items-center justify-center">
      {s.energy != null ? formatNumber(Number(s.energy)) : MISSING_STR}
    </div>
  )
}
