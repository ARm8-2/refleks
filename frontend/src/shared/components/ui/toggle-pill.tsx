import * as React from "react";

import { cn } from "@/shared/lib/utils";

type TogglePillSize = "sm" | "md";

export interface TogglePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: TogglePillSize;
}

export function TogglePill({
  active = false,
  size = "sm",
  className,
  disabled,
  ...props
}: TogglePillProps) {
  const sizeClass =
    size === "md" ? "h-7 px-2.5 text-xs" : "h-7 px-2 text-[11px]";

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-emphasized focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 enabled:active:scale-[0.98]",
        sizeClass,
        disabled
          ? "text-surface-muted-foreground/40"
          : active
            ? "bg-surface-muted text-foreground"
            : "text-surface-muted-foreground hover:bg-surface-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface TogglePillGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TogglePillGroup({ className, ...props }: TogglePillGroupProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1 shadow-inner shadow-black/5",
        className,
      )}
      {...props}
    />
  );
}
