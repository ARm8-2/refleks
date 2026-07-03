export function autoHiddenRanks(
  totalRanks: number,
  scenarioRanks: number[],
  enabled: boolean,
  targetVisible: number,
): Set<number> {
  const hidden = new Set<number>();
  if (!enabled) return hidden;

  const rankCount = Math.max(0, Math.floor(totalRanks || 0));
  if (rankCount === 0) return hidden;

  const normalized = Array.isArray(scenarioRanks) ? scenarioRanks : [];
  if (normalized.length === 0) return hidden;

  const target = Math.max(
    1,
    Math.min(rankCount, Math.floor(targetVisible || 1)),
  );

  let minAchieved = Number.POSITIVE_INFINITY;
  for (const scenarioRank of normalized) {
    const rank = Math.max(0, Math.min(rankCount, Number(scenarioRank || 0)));
    if (rank < minAchieved) minAchieved = rank;
  }

  if (!Number.isFinite(minAchieved) || minAchieved <= 0) return hidden;

  const maxHide = Math.max(0, rankCount - target);
  const hideCount = Math.max(0, Math.min(maxHide, Math.floor(minAchieved)));

  for (let index = 0; index < hideCount; index++) hidden.add(index);
  return hidden;
}
