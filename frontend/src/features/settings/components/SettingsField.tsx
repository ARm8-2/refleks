import type { ReactNode } from 'react'

type SettingsFieldProps = {
  label: string
  description?: string
  children: ReactNode
  inline?: boolean
  className?: string
}

export function SettingsField({ label, description, children, inline = false, className = '' }: SettingsFieldProps) {
  if (inline) {
    return (
      <div className={`flex items-center justify-between gap-4 ${className}`}>
        <div className="flex flex-col gap-0.5">
          <span className="text-primary text-sm">{label}</span>
          {description && <span className="text-secondary text-xs">{description}</span>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-primary text-sm">{label}</span>
        {description && <span className="text-secondary text-xs">{description}</span>}
      </div>
      {children}
    </div>
  )
}
