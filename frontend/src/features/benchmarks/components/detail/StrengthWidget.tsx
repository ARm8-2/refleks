import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Widget,
} from "@/shared/components";
import { usePersistedState } from "@/shared/hooks";
import { STORAGE_KEYS, useI18n } from "@/shared/lib";
import type { BenchmarkProgress } from "@/shared/types";
import { useMemo } from "react";
import {
  adjustColorForTheme,
  formatNumber,
  normalizedRankProgress,
} from "../../lib/detailFormatting";

type Props = {
  progress: BenchmarkProgress;
};

type StrengthRow = {
  label: string;
  percent: number;
  avgScore: number;
  color: string;
  rankName: string;
};

type StrengthLevel = "category" | "subcategory" | "scenario";

const CARD_BACKGROUND = "var(--surface)";

export function StrengthWidget({ progress }: Props) {
  const { t, locale } = useI18n();
  const [level, setLevel] = usePersistedState<StrengthLevel>(
    STORAGE_KEYS.benchmarksDetailStrengthLevel,
    "category",
  );
  const levelControls = (
    <Select
      value={level}
      onValueChange={(value) => setLevel(value as StrengthLevel)}
    >
      <SelectTrigger className="h-8 min-w-[8.125rem] w-auto px-2 text-xs bg-surface-subtle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="category">
          {t("benchmarks.strength.scopeCategory")}
        </SelectItem>
        <SelectItem value="subcategory">
          {t("benchmarks.strength.scopeSubcategory")}
        </SelectItem>
        <SelectItem value="scenario">
          {t("benchmarks.strength.scopeScenario")}
        </SelectItem>
      </SelectContent>
    </Select>
  );

  const rows = useMemo<StrengthRow[]>(() => {
    const rankDefs = progress.ranks || [];

    const buildRow = (
      label: string,
      color: string,
      scenarios: Array<{
        scenarioRank: number;
        score: number;
        thresholds: number[];
      }>,
    ): StrengthRow => {
      if (!scenarios.length) {
        return {
          label,
          percent: 0,
          avgScore: 0,
          color,
          rankName: t("benchmarks.strength.unranked"),
        };
      }

      const values = scenarios.map((scenario) =>
        normalizedRankProgress(
          scenario.scenarioRank,
          scenario.score,
          scenario.thresholds,
        ),
      );
      const average =
        values.reduce((sum, value) => sum + value, 0) / values.length;
      const percent = Math.round(average * 100);
      const avgScore =
        scenarios.reduce(
          (sum, scenario) => sum + Number(scenario.score || 0),
          0,
        ) / scenarios.length;

      const rankIndex = rankDefs.length
        ? Math.max(
            0,
            Math.min(
              rankDefs.length - 1,
              Math.floor((percent / 100) * rankDefs.length),
            ),
          )
        : 0;

      return {
        label,
        percent,
        avgScore,
        color: adjustColorForTheme(
          rankDefs[rankIndex]?.color || color || "var(--primary)",
          CARD_BACKGROUND,
          0.94,
        ),
        rankName:
          rankDefs[rankIndex]?.name || t("benchmarks.strength.unranked"),
      };
    };

    const data: StrengthRow[] = [];
    if (level === "category") {
      for (const category of progress.categories) {
        data.push(
          buildRow(
            category.name,
            category.color || "var(--primary)",
            category.groups.flatMap((group) => group.scenarios),
          ),
        );
      }
    } else if (level === "subcategory") {
      for (const category of progress.categories) {
        for (const group of category.groups) {
          data.push(
            buildRow(
              group.name ? `${category.name}: ${group.name}` : category.name,
              group.color || category.color || "var(--primary)",
              group.scenarios,
            ),
          );
        }
      }
    } else {
      for (const category of progress.categories) {
        for (const group of category.groups) {
          for (const scenario of group.scenarios) {
            data.push(
              buildRow(scenario.name, category.color || "var(--primary)", [
                scenario,
              ]),
            );
          }
        }
      }
    }

    return data.sort(
      (a, b) => b.percent - a.percent || a.label.localeCompare(b.label),
    );
  }, [progress, level, locale]);

  const levelLabel =
    level === "category"
      ? t("benchmarks.strength.scopeCategory")
      : level === "subcategory"
        ? t("benchmarks.strength.scopeSubcategory")
        : t("benchmarks.strength.scopeScenario");

  const renderBody = (expanded: boolean) => {
    if (rows.length === 0) {
      return (
        <div className="rounded-xl bg-surface-subtle p-4 text-sm text-surface-muted-foreground">
          {t("benchmarks.strength.noData")}
        </div>
      );
    }

    return (
      <div
        className={
          expanded
            ? "space-y-3 overflow-auto pr-1"
            : "space-y-2.5 max-h-[20rem] overflow-auto pr-1"
        }
      >
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-surface-subtle p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div
                className={`font-medium text-foreground truncate ${expanded ? "text-sm" : ""}`}
              >
                {row.label}
              </div>
              <div className="text-xs text-surface-muted-foreground">
                {row.rankName} · {t("benchmarks.strength.avg")}{" "}
                {formatNumber(row.avgScore, 1)}
              </div>
            </div>

            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.percent}%`, backgroundColor: row.color }}
              />
            </div>

            <div className="mt-1 text-xs text-surface-muted-foreground">
              {row.percent}%
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Widget
      title={t("benchmarks.strength.title")}
      description={t("benchmarks.strength.description", {
        level: levelLabel,
      })}
      headerAction={levelControls}
      modalTitle={t("benchmarks.strength.title")}
      modalControls={levelControls}
      modalContent={renderBody(true)}
      modalWidth="56.25rem"
      modalHeight="47.5rem"
    >
      {renderBody(false)}
    </Widget>
  );
}
