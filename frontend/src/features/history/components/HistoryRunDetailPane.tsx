import { Button, SegmentedControl } from "@/shared/components";
import { usePersistedState } from "@/shared/hooks";
import { getSettings, STORAGE_KEYS, useI18n } from "@/shared/lib";
import {
  Columns2,
  Layers,
  PanelRightClose,
  PinOff,
  Rows2,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { HistoryRun } from "../lib/historyModels";
import { INSPECTOR_TABS, type InspectorTab } from "../lib/inspectorTabs";
import { AnalysisTab } from "./inspector/AnalysisTab";
import { EnvironmentTab } from "./inspector/EnvironmentTab";
import { ReplayTab } from "./inspector/ReplayTab";
import { StatsTab } from "./inspector/StatsTab";
import { TraceTab } from "./inspector/TraceTab";

export type { InspectorTab };

type Props = {
  primaryRun: HistoryRun | null;
  compareRun: HistoryRun | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  onClearPrimaryRun: () => void;
  onClearComparison: () => void;
  isPrimaryPb: boolean;
  isComparePb: boolean;
  onComparePb: () => void;
};

export function HistoryRunDetailPane({
  primaryRun,
  compareRun,
  activeTab,
  onTabChange,
  onClose,
  onClearPrimaryRun,
  onClearComparison,
  isPrimaryPb,
  isComparePb,
  onComparePb,
}: Props) {
  const { t } = useI18n();
  const [overlay, setOverlay] = usePersistedState(
    STORAGE_KEYS.historyAnalysisOverlay,
    false,
  );
  const [anonymousEnabled, setAnonymousEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    getSettings()
      .then((settings) => {
        if (!active) return;
        setAnonymousEnabled(settings.anonymousEnabled === true);
      })
      .catch(() => {
        if (!active) return;
        setAnonymousEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-surface">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <SegmentedControl
          value={activeTab}
          options={INSPECTOR_TABS.map((tab) => ({
            value: tab.value,
            label: t(tab.labelKey),
          }))}
          onValueChange={onTabChange}
        />
        <div className="flex items-center gap-1">
          {primaryRun && !isPrimaryPb && !isComparePb && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onComparePb}
              title={t("history.inspector.compareWithPb")}
            >
              <Trophy className="mr-1 h-3.5 w-3.5" />
              {t("history.inspector.vsPb")}
            </Button>
          )}
          {compareRun &&
            (activeTab === "analysis" || activeTab === "trace") && (
              <Button
                variant={overlay ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setOverlay((o) => !o)}
                title={
                  overlay
                    ? t("history.inspector.showSideBySide")
                    : t("history.inspector.overlayBoth")
                }
              >
                {overlay ? (
                  <>
                    <Columns2 className="mr-1 h-3.5 w-3.5" />
                    {t("history.inspector.sideBySide")}
                  </>
                ) : (
                  <>
                    <Layers className="mr-1 h-3.5 w-3.5" />
                    {t("history.inspector.overlay")}
                  </>
                )}
              </Button>
            )}
          {compareRun && (
            <Button variant="ghost" size="sm" onClick={onClearComparison}>
              <Rows2 className="mr-1 h-3.5 w-3.5" />
              {t("history.inspector.single")}
            </Button>
          )}
          {primaryRun && (
            <Button variant="ghost" size="sm" onClick={onClearPrimaryRun}>
              <PinOff className="mr-1 h-3.5 w-3.5" />
              {t("history.inspector.clear")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title={t("history.inspector.closeInspector")}
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!primaryRun ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-surface-muted-foreground">
            {t("history.inspector.selectRunToInspect")}
          </p>
        </div>
      ) : (
        <div className="scrollbar-compact overflow-y-auto p-5 pt-2 space-y-4 min-h-0 flex-1">
          {activeTab === "stats" && (
            <StatsTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              onClearPrimaryRun={onClearPrimaryRun}
              onClearComparison={onClearComparison}
            />
          )}
          {activeTab === "analysis" && (
            <AnalysisTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              overlay={overlay}
            />
          )}
          {activeTab === "trace" && (
            <TraceTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              overlay={overlay}
            />
          )}
          {activeTab === "replay" && (
            <ReplayTab primaryRun={primaryRun} compareRun={compareRun} />
          )}
          {activeTab === "environment" && (
            <EnvironmentTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              anonymousEnabled={anonymousEnabled}
              onClearPrimaryRun={onClearPrimaryRun}
              onClearComparison={onClearComparison}
            />
          )}
        </div>
      )}
    </section>
  );
}
