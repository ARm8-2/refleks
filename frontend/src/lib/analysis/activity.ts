import type { Session } from '../../types/domain'

export interface DailyActivityStats {
  playtimeMs: number
  streak: number
}

export function calculateDailyActivity(currentSession: Session | null, allSessions: Session[]): DailyActivityStats {
  if (!currentSession) return { playtimeMs: 0, streak: 0 }

  const sessionDate = new Date(currentSession.start)
  const getDateStr = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const targetDateStr = getDateStr(sessionDate)

  // 1. Daily Playtime
  let playtimeSeconds = 0
  const activityDays = new Set<string>()

  for (const sess of allSessions) {
    // Check if session has items
    if (!sess.items || sess.items.length === 0) continue

    // For playtime, we only care about items on the target date
    for (const item of sess.items) {
      const itemDate = new Date(item.stats['Date Played'])
      const itemDateStr = getDateStr(itemDate)

      activityDays.add(itemDateStr)

      if (itemDateStr === targetDateStr) {
        const d = Number(item.stats['Duration'])
        if (Number.isFinite(d)) {
          playtimeSeconds += d
        }
      }
    }
  }

  // 2. Daily Streak
  // Count consecutive days backwards from targetDateStr (inclusive)
  let streak = 0
  const checkDate = new Date(sessionDate)

  // If we played today, streak is at least 1.
  // We iterate backwards day by day.
  while (true) {
    const dateStr = getDateStr(checkDate)
    if (activityDays.has(dateStr)) {
      streak++
      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return { playtimeMs: playtimeSeconds * 1000, streak }
}
