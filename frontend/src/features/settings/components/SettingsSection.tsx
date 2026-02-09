import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

export function SettingsSection({ title, children, className = '' }: SettingsSectionProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-primary font-medium text-sm border-b border-primary pb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}
