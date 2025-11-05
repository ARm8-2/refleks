import type { ReactNode } from 'react';

export type Tab = { id: string; label: string; content: ReactNode }

type TabsProps = { tabs: Tab[]; active: string; onChange: (id: string) => void }

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`px-3 py-1 rounded ${active === t.id ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find(t => t.id === active)?.content}</div>
    </div>
  )
}
