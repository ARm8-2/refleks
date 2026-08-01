import * as React from "react";

import { cn } from "@/shared/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl bg-surface-subtle px-3 py-1 text-base transition-[background-color,border-color,box-shadow] duration-200 ease-emphasized file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-surface-muted-foreground hover:bg-surface-hover focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
