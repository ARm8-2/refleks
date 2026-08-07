import { Loading, Modal } from "@/shared/components";
import { getActiveLocaleFormatters } from "@/i18n";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import {
  CHART_SERIES_COLORS,
  CHART_STYLE,
  buildThresholdAnchoredScoreDomain,
  getLastScenarioScores,
} from "@/shared/lib";
import type { KovaaksLastScore, RankDef } from "@/shared/types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "../../lib/detailFormatting";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  scenarioName: string;
  thresholds: number[];
  rankDefs: RankDef[];
};

type TrendPoint = {
  run: number;
  score: number;
  dateLabel: string;
};

type RankBand = {
  y1: number;
  y2: number;
  color: string;
};

export function ScenarioHistoryModal({
  isOpen,
  onClose,
  scenarioName,
  thresholds,
  rankDefs,
}: Props) {
  const { t } = useTranslation(["benchmarks", "errors"]);
  const chartConfig: ChartConfig = useMemo(
    () => ({
      score: {
        label: t("benchmarks:history.score"),
        color: CHART_SERIES_COLORS.scoreHistory,
      },
    }),
    [t],
  );
  const [scores, setScores] = useState<KovaaksLastScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !scenarioName) return;

    setLoading(true);
    setError(null);
    setScores([]);

    getLastScenarioScores(scenarioName)
      .then((result) => setScores(result))
      .catch((fetchError) => {
        console.error("Failed to load scenario history:", fetchError);
        setError(t("errors:benchmarks.historyLoadFailed"));
      })
      .finally(() => setLoading(false));
  }, [isOpen, scenarioName, t]);

  const sorted = useMemo(() => [...scores].reverse(), [scores]);

  const trendData = useMemo<TrendPoint[]>(() => {
    return sorted.map((entry, index) => {
      const rawDate = entry.attributes?.challengeStart;
      const date = rawDate ? new Date(rawDate) : null;
      const dateLabel =
        date && !Number.isNaN(date.getTime())
          ? getActiveLocaleFormatters().dateTimeFormatter({
              dateStyle: "short",
              timeStyle: "short",
            }).format(date)
          : rawDate || t("benchmarks:history.unknown");

      return {
        run: index + 1,
        score: Number(entry.attributes?.score || 0),
        dateLabel,
      };
    });
  }, [sorted, t]);

  const numericScores = useMemo(
    () =>
      trendData
        .map((point) => point.score)
        .filter((score) => Number.isFinite(score) && score > 0),
    [trendData],
  );

  const scoreDomain = useMemo(
    () => buildThresholdAnchoredScoreDomain(numericScores, thresholds),
    [numericScores, thresholds],
  );

  const rankBands = useMemo(() => {
    return buildRankBands(thresholds, rankDefs, scoreDomain);
  }, [rankDefs, scoreDomain, thresholds]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("benchmarks:history.title", { scenario: scenarioName })}
    >
      <div className="space-y-3 px-4 pb-4">
        {loading && <Loading />}

        {!loading && error && (
          <div className="rounded-xl border border-destructive-border bg-destructive-soft p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && trendData.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-surface-muted-foreground">
            {t("benchmarks:history.noScores")}
          </div>
        )}

        {!loading && !error && trendData.length > 0 && (
          <>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full"
            >
              <LineChart
                data={trendData}
                margin={{ top: 2, right: 6, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="run" hide />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  width={46}
                  domain={scoreDomain}
                  tickFormatter={(value) => formatNumber(value, 0)}
                />

                {rankBands.map((band, index) => (
                  <ReferenceArea
                    key={`rank-band-${index}`}
                    y1={band.y1}
                    y2={band.y2}
                    fill={band.color}
                    fillOpacity={0.16}
                    strokeOpacity={0}
                    ifOverflow="extendDomain"
                  />
                ))}

                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.dateLabel ?? null
                      }
                    />
                  }
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-score)"
                  strokeWidth={CHART_STYLE.linePrimaryWidth}
                  dot={{
                    r: CHART_STYLE.pointRadius,
                    fill: "var(--color-score)",
                    strokeWidth: 0,
                  }}
                  activeDot={{ r: CHART_STYLE.activePointRadius }}
                />
              </LineChart>
            </ChartContainer>
          </>
        )}
      </div>
    </Modal>
  );
}

function buildRankBands(
  thresholds: number[],
  rankDefs: RankDef[],
  domain: [number, number],
): RankBand[] {
  const [domainMin, domainMax] = domain;
  const stops = thresholds
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  if (stops.length < 2 || rankDefs.length === 0 || domainMax <= domainMin)
    return [];

  const bands: RankBand[] = [];
  const maxIndex = Math.min(rankDefs.length, stops.length - 1);

  for (let index = 0; index < maxIndex; index += 1) {
    const rawStart = stops[index];
    const rawEnd = index === maxIndex - 1 ? domainMax : stops[index + 1];
    const y1 = Math.max(domainMin, rawStart);
    const y2 = Math.min(domainMax, rawEnd);
    if (y2 <= y1) continue;

    bands.push({
      y1,
      y2,
      color: rankDefs[index - 1]?.color,
    });
  }

  return bands;
}
