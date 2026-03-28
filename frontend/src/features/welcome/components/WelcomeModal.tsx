import { Button, Modal } from '@/shared/components'
import type { WelcomeContent } from '../lib/content'

type WelcomeModalProps = {
  isOpen: boolean
  content: WelcomeContent
  onClose: () => void
}

export function WelcomeModal({ isOpen, content, onClose }: WelcomeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={content.title} width={560} height="auto">
      <div className="space-y-4">
        <div className="inline-flex rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-surface-muted-foreground">
          {content.badge}
        </div>

        <p className="text-sm leading-6 text-surface-muted-foreground">{content.intro}</p>

        <section className="rounded-xl bg-surface-subtle p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-surface-muted-foreground">Highlights</div>
          <ul className="mt-3 space-y-2">
            {content.highlights.map(item => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end">
          <Button onClick={onClose} size="sm">{content.ctaLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}