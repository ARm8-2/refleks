
export function PreviewTag({ label = 'Preview' }: { label?: string }) {
  return (
    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] leading-none bg-[var(--preview-bg)] text-[var(--preview-text)] border-[var(--preview-border)]">
      {label}
    </span>
  )
}
