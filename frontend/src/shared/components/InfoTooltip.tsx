import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type InfoTooltipProps = {
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconClassName?: string;
  icon?: ReactNode;
};

export function InfoTooltip({
  children,
  side = "bottom",
  className,
  iconClassName,
  icon,
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-md text-surface-muted-foreground transition-colors hover:text-foreground",
              iconClassName,
            )}
          >
            {icon ?? <Info className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
