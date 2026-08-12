import { Loader2 } from "lucide-react";
import { useI18n } from "@/shared/lib/i18n";

type LoadingProps = {
  label?: string;
};

export function Loading({ label }: LoadingProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("common.loading");
  return (
    <div className="flex h-full w-full items-center justify-center text-surface-muted-foreground">
      <div className="inline-flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{resolvedLabel}</span>
      </div>
    </div>
  );
}
