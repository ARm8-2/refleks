const DEFAULT_TOOLTIP =
  'Preview features are early, experimental additions we ship to collect feedback. They are functional but may change as we refine the model and UI. To report feedback, click Support & Feedback in the top right.'

type PreviewTagProps = { label?: string; title?: string }

export function PreviewTag({ label = 'Preview', title }: PreviewTagProps) {
  return (
    <span
      className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] leading-none bg-[var(--preview-bg)] text-[var(--preview-text)] border-[var(--preview-border)]"
      title={title ?? DEFAULT_TOOLTIP}
    >
      {label}
    </span>
  )
}
