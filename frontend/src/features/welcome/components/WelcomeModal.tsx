import { Button, Modal } from '@/shared/components'
import { cn, openURL } from '@/shared/lib'
import { Clock, Database, EyeOff, Globe2, MousePointer2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { WelcomeContent } from '../lib/content'

type WelcomeModalProps = {
  isOpen: boolean
  content: WelcomeContent
  initialAnonymousEnabled: boolean
  initialMouseTrackingEnabled: boolean
  showMouseTraceChoice?: boolean
  runSyncEnabled: boolean
  closeOnOutsideClick?: boolean
  closeOnEscapeKey?: boolean
  showCloseButton?: boolean
  onConfirm: (choices: { anonymousEnabled: boolean, mouseTrackingEnabled: boolean | null }) => Promise<void> | void
  onClose: () => void
}

type PrivacyMode = 'public' | 'anonymous'
type MouseTraceMode = 'enabled' | 'disabled'

type WelcomeSectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

type ChoiceCardProps = {
  eyebrow: string
  eyebrowTone?: 'primary' | 'muted'
  label: string
  subtitle?: string
  description: string
  bullets: string[]
  selected: boolean
  onSelect: () => void
  icon: ReactNode
}

function WelcomeSection({ title, description, children, className = '' }: WelcomeSectionProps) {
  return (
    <section className={cn('rounded-xl bg-surface px-5 py-4 shadow-sm', className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs leading-5 text-surface-muted-foreground">{description}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ChoiceCard({
  eyebrow,
  eyebrowTone = 'muted',
  label,
  subtitle,
  description,
  bullets,
  selected,
  onSelect,
  icon,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex h-full flex-col rounded-xl bg-surface px-4 py-4 text-left shadow-sm transition-colors hover:bg-surface-hover',
        selected && 'bg-surface-hover ring-1 ring-primary/35',
      )}
    >
      <div className="flex min-h-[1.75rem] items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
            eyebrowTone === 'primary'
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-muted text-surface-muted-foreground',
          )}
        >
          {eyebrow}
        </span>
        <span className={cn('h-4 w-4 rounded-full border', selected ? 'border-primary bg-primary' : 'border-border bg-transparent')} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      {subtitle && <div className="mt-1 text-xs text-surface-muted-foreground">{subtitle}</div>}

      <p className="mt-3 text-sm leading-6 text-surface-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map(bullet => (
          <li key={bullet} className="flex gap-2 text-xs leading-5 text-foreground">
            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}

function ChoiceGroup({
  icon,
  label,
  description,
  helper,
  children,
}: {
  icon: ReactNode
  label: string
  description: string
  helper?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl bg-surface-subtle p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="leading-none">{label}</span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-surface-muted-foreground">{description}</p>
      {helper && <p className="mt-1 text-xs leading-5 text-surface-muted-foreground">{helper}</p>}
      <div className="mt-3 grid auto-rows-fr gap-3 lg:grid-cols-2">{children}</div>
    </div>
  )
}

function ResourceCard({ label, description, url, urlLabel }: { label: string, description: string, url: string, urlLabel: string }) {
  return (
    <button
      type="button"
      onClick={() => openURL(url)}
      className="w-full rounded-xl bg-surface-subtle p-4 text-left transition-colors hover:bg-surface-hover"
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <p className="mt-1 text-xs leading-5 text-surface-muted-foreground">{description}</p>
      <div className="mt-2 font-mono text-[11px] text-surface-muted-foreground">{urlLabel}</div>
    </button>
  )
}

export function WelcomeModal({
  isOpen,
  content,
  initialAnonymousEnabled,
  initialMouseTrackingEnabled,
  showMouseTraceChoice = false,
  runSyncEnabled,
  closeOnOutsideClick = true,
  closeOnEscapeKey = true,
  showCloseButton = true,
  onConfirm,
  onClose,
}: WelcomeModalProps) {
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(initialAnonymousEnabled ? 'anonymous' : 'public')
  const [mouseTraceMode, setMouseTraceMode] = useState<MouseTraceMode>(initialMouseTrackingEnabled ? 'enabled' : 'disabled')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPrivacyMode(initialAnonymousEnabled ? 'anonymous' : 'public')
  }, [initialAnonymousEnabled, isOpen])

  useEffect(() => {
    if (!isOpen) return
    setMouseTraceMode(initialMouseTrackingEnabled ? 'enabled' : 'disabled')
  }, [initialMouseTrackingEnabled, isOpen])

  const syncStatus = runSyncEnabled
    ? 'Run Sync is currently enabled. You can change this later in Privacy settings.'
    : 'Run Sync is currently turned off in Settings. If you enable it later, this choice will be used.'

  const handleContinue = async () => {
    if (isSaving) {
      return
    }

    setIsSaving(true)
    try {
      await onConfirm({
        anonymousEnabled: privacyMode === 'anonymous',
        mouseTrackingEnabled: showMouseTraceChoice
          ? mouseTraceMode === 'enabled'
          : null,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={<span className="text-xl font-semibold leading-tight tracking-tight text-foreground">{content.title}</span>}
      width={980}
      height="auto"
      className="px-6 pt-7 pb-6"
      closeOnOutsideClick={closeOnOutsideClick}
      closeOnEscapeKey={closeOnEscapeKey}
      showCloseButton={showCloseButton}
    >
      {/* -mr-6 cancels the modal's right padding so the scrollbar sits flush at the dialog edge */}
      <div className="-mr-6 max-h-[75vh] overflow-y-auto pr-6">
        <div className="space-y-3.5 pb-2.5">
          <div className="rounded-xl bg-surface px-5 py-4 shadow-sm">
            <p className="text-sm leading-6 text-foreground">{content.intro}</p>

            <div className="mt-2.5 space-y-2.5">
              {content.details.map(detail => (
                <p key={detail} className="text-sm leading-6 text-surface-muted-foreground">
                  {detail}
                </p>
              ))}
            </div>
          </div>

          <WelcomeSection
            title={showMouseTraceChoice ? 'First-Time Setup' : "RefleK's Index Profile"}
            description={showMouseTraceChoice
              ? 'Pick how you want your uploads and mouse traces to start. You can change these choices later in Settings.'
              : 'Review how you want your runs to appear on the RefleK\'s Index. You can change this later in Privacy settings.'}
          >
            <div className="space-y-3">
              <ChoiceGroup
                icon={<Database className="h-3.5 w-3.5" />}
                label="RefleK's Index"
                description="Completed runs can be uploaded to the RefleK's Index, a shared dataset that feeds rankings, comparisons, and research across the global player base."
                helper={syncStatus}
              >
                <ChoiceCard
                  eyebrow="Recommended"
                  eyebrowTone="primary"
                  label="Public Profile"
                  subtitle="Show my Steam name on the Index."
                  description="Best if you want your Steam name shown with the runs you upload."
                  bullets={[
                    'Your Steam name appears on runs you upload to the Index.',
                    'You can switch to Anonymous later in Privacy settings.',
                  ]}
                  selected={privacyMode === 'public'}
                  onSelect={() => setPrivacyMode('public')}
                  icon={<Globe2 className="h-4 w-4" />}
                />

                <ChoiceCard
                  eyebrow="Private"
                  label="Anonymous"
                  subtitle="Private identity, shared contribution."
                  description="Best if you want to contribute data while keeping identifying information out of uploads."
                  bullets={[
                    'Steam ID, persona name, and hostname are scrubbed before upload.',
                    'Your runs still help the shared dataset, analysis, and research.',
                    'You can switch back to Public later in Privacy settings.',
                  ]}
                  selected={privacyMode === 'anonymous'}
                  onSelect={() => setPrivacyMode('anonymous')}
                  icon={<EyeOff className="h-4 w-4" />}
                />
              </ChoiceGroup>

              {showMouseTraceChoice && (
                <ChoiceGroup
                  icon={<MousePointer2 className="h-3.5 w-3.5" />}
                  label="Mouse Traces"
                  description="Mouse traces capture your movement during runs so you can replay and compare them later. Tracing is designed to have no performance impact during play."
                  helper="This is just your starting point — you can change it later in General settings."
                >
                  <ChoiceCard
                    eyebrow="Recommended"
                    eyebrowTone="primary"
                    label="Enable Mouse Traces"
                    subtitle="Capture movement during supported runs."
                    description="Best if you want richer history and replay tools from your very first session."
                    bullets={[
                      'No performance impact during play.',
                      'Lets you replay and compare runs in the History view.',
                      'Can be turned off anytime in General settings.',
                    ]}
                    selected={mouseTraceMode === 'enabled'}
                    onSelect={() => setMouseTraceMode('enabled')}
                    icon={<MousePointer2 className="h-4 w-4" />}
                  />

                  <ChoiceCard
                    eyebrow="Later"
                    label="Not Right Now"
                    subtitle="Start without trace capture and enable it whenever you want."
                    description="A good starting point if you want to get familiar with the app first and decide about traces after a few sessions."
                    bullets={[
                      'Keeps first-time setup simple.',
                      'Enable traces anytime later in General settings.',
                      'The rest of the app works the same either way.',
                    ]}
                    selected={mouseTraceMode === 'disabled'}
                    onSelect={() => setMouseTraceMode('disabled')}
                    icon={<Clock className="h-4 w-4" />}
                  />
                </ChoiceGroup>
              )}
            </div>
          </WelcomeSection>

          <WelcomeSection title={content.highlightsTitle}>
            <div className="grid gap-2.5 md:grid-cols-2">
              {content.highlights.map(item => (
                <div key={item} className="rounded-xl bg-surface-subtle px-4 py-3 text-sm leading-6 text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </WelcomeSection>

          <WelcomeSection title={content.linksTitle} description="If you want the full release story, the changelog and docs are always only a click away.">
            <div className="grid gap-2.5 md:grid-cols-2">
              {content.links.map(link => (
                <ResourceCard
                  key={link.url}
                  label={link.label}
                  description={link.description}
                  url={link.url}
                  urlLabel={link.urlLabel}
                />
              ))}
            </div>
          </WelcomeSection>

        </div>
      </div>

      {/* Footer pinned below the scroll area so the button is always visible */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleContinue} disabled={isSaving}>
          {isSaving ? 'Saving...' : content.ctaLabel}
        </Button>
      </div>
    </Modal>
  )
}
