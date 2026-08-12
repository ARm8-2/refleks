import { Check, ChevronDown, ChevronUp, Minus } from "lucide-react";

type Props = {
  score: number;
  isTopPick?: boolean;
  isCompleted?: boolean;
  compact?: boolean;
};

export function RecommendationIndicator({
  score,
  isTopPick,
  isCompleted,
  compact,
}: Props) {
  const sizeClass = compact
    ? "h-[0.75rem] w-[0.75rem]"
    : "h-[0.875rem] w-[0.875rem]";
  const stackClass = compact ? "-space-y-1" : "-space-y-1.5";

  if (isCompleted)
    return <Check className={`${sizeClass} text-surface-muted-foreground`} />;

  const upColor = isTopPick ? "text-primary" : "text-success";

  if (score >= 5) {
    return (
      <div className={`flex flex-col items-center ${stackClass} ${upColor}`}>
        <ChevronUp className={sizeClass} />
        <ChevronUp className={sizeClass} />
      </div>
    );
  }

  if (score >= 1) {
    return (
      <div className={`flex flex-col items-center ${stackClass} ${upColor}`}>
        <ChevronUp className={sizeClass} />
      </div>
    );
  }

  if (score <= -3) {
    return (
      <div
        className={`flex flex-col items-center ${stackClass} text-destructive`}
      >
        <ChevronDown className={sizeClass} />
        <ChevronDown className={sizeClass} />
      </div>
    );
  }

  if (score <= -1) {
    return (
      <div className={`flex flex-col items-center ${stackClass} text-warning`}>
        <ChevronDown className={sizeClass} />
      </div>
    );
  }

  return <Minus className={`${sizeClass} text-surface-muted-foreground`} />;
}
