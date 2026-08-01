import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SettingsSection({
  title,
  description,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section
      className={`rounded-xl bg-surface px-5 py-4 shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-surface-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
