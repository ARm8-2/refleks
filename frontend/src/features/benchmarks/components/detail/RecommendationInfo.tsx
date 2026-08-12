import { InfoTooltip } from "@/shared/components";
import { Check, ChevronDown, ChevronUp, Minus } from "lucide-react";

/**
 * Info tooltip explaining the REC (recommendation) column of the progress
 * tracker. Shared by the benchmark detail page and the overview widget so the
 * legend stays in sync.
 */
export function RecommendationInfo() {
  return (
    <InfoTooltip
      side="bottom"
      className="max-w-[15rem]"
      ariaLabel="About recommendations"
      iconClassName="shrink-0"
    >
      <div className="space-y-2 text-[0.6875rem] leading-relaxed">
        <p className="font-medium text-popover-foreground">Recommendations</p>
        <p className="text-popover-foreground/70">
          Which scenarios are worth playing right now, based on your progress,
          recent score trends, and how recently you played each one.
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0 text-surface-muted-foreground" />
            <span className="text-popover-foreground/70">
              Completed — max rank reached
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 flex-col items-center -space-y-1">
              <ChevronUp className="h-3 w-3 text-primary" />
              <ChevronUp className="h-3 w-3 text-primary" />
            </span>
            <span className="text-popover-foreground/70">
              Top pick — best to play now
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 flex-col items-center -space-y-1">
              <ChevronUp className="h-3 w-3 text-success" />
              <ChevronUp className="h-3 w-3 text-success" />
            </span>
            <span className="text-popover-foreground/70">
              Strongly recommended
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="text-popover-foreground/70">
              Recommended — below average or improving
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 shrink-0 text-surface-muted-foreground" />
            <span className="text-popover-foreground/70">Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="text-popover-foreground/70">Low priority</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 flex-col items-center -space-y-1">
              <ChevronDown className="h-3 w-3 text-destructive" />
              <ChevronDown className="h-3 w-3 text-destructive" />
            </span>
            <span className="text-popover-foreground/70">
              Avoid for now — strong or trending down
            </span>
          </div>
        </div>
      </div>
    </InfoTooltip>
  );
}
