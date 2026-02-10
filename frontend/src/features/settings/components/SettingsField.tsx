import type { ReactNode } from 'react'

type SettingsFieldProps = {
  label: string
  description?: string
  children: ReactNode
  /** When true, children (checkbox) appear to the left of the label. */
  checkbox?: boolean
  className?: string
}

export function SettingsField({ label, description, children, checkbox = false, className = '' }: SettingsFieldProps) {
  if (checkbox) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <span className="text-primary text-sm">{label}</span>
        <div className="flex items-center gap-2">
          {children}
          {description && <span className="text-secondary text-xs">{description}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-primary text-sm">{label}</span>
      {description && <span className="text-secondary text-xs">{description}</span>}
      {children}
    </div>
  )
}
