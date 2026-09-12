import { Button, Modal } from "@/shared/components";
import { cn, openURL, useI18n } from "@/shared/lib";
import {
  Clock,
  Database,
  EyeOff,
  Globe2,
  MonitorPlay,
  MousePointer2,
  Video,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { WelcomeContent } from "../lib/content";

type WelcomeModalProps = {
  isOpen: boolean;
  content: WelcomeContent;
  initialAnonymousEnabled: boolean;
  initialMouseTrackingEnabled: boolean;
  initialScreenCaptureEnabled: boolean;
  showMouseTraceChoice?: boolean;
  showScreenCaptureChoice?: boolean;
  showAnonymousChoice?: boolean;
  runSyncEnabled: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscapeKey?: boolean;
  showCloseButton?: boolean;
  onConfirm: (choices: {
    anonymousEnabled: boolean;
    mouseTrackingEnabled: boolean | null;
    screenCaptureEnabled: boolean | null;
  }) => Promise<void> | void;
  onClose: () => void;
};

type PrivacyMode = "public" | "anonymous";
type MouseTraceMode = "enabled" | "disabled";

type WelcomeSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

type ChoiceCardProps = {
  eyebrow: string;
  eyebrowTone?: "primary" | "muted";
  label: string;
  subtitle?: string;
  description: string;
  bullets: string[];
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
};

function WelcomeSection({
  title,
  description,
  children,
  className = "",
}: WelcomeSectionProps) {
  return (
    <section
      className={cn("rounded-xl bg-surface px-5 py-4 shadow-sm", className)}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs leading-5 text-surface-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ChoiceCard({
  eyebrow,
  eyebrowTone = "muted",
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
        "flex h-full flex-col rounded-xl bg-surface px-4 py-4 text-left shadow-sm transition-[transform,background-color,box-shadow,ring-color] duration-200 ease-emphasized will-change-transform hover:-translate-y-px hover:scale-[1.01] hover:bg-surface-hover hover:shadow-sm active:scale-[0.995]",
        selected &&
          "-translate-y-px scale-[1.005] bg-surface-hover ring-1 ring-primary/35 shadow-sm",
      )}
    >
      <div className="flex min-h-[1.75rem] items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide",
            eyebrowTone === "primary"
              ? "bg-primary/10 text-primary"
              : "bg-surface-muted text-surface-muted-foreground",
          )}
        >
          {eyebrow}
        </span>
        <span
          className={cn(
            "h-4 w-4 rounded-full border transition-[transform,background-color,border-color] duration-200 ease-emphasized",
            selected
              ? "scale-100 border-primary bg-primary"
              : "scale-90 border-border bg-transparent",
          )}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-surface-muted-foreground">
          {subtitle}
        </div>
      )}

      <p className="mt-3 text-sm leading-6 text-surface-muted-foreground">
        {description}
      </p>
      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex gap-2 text-xs leading-5 text-foreground"
          >
            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function ChoiceGroup({
  icon,
  label,
  description,
  helper,
  children,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-subtle p-4">
      <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="leading-none">{label}</span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-surface-muted-foreground">
        {description}
      </p>
      {helper && (
        <p className="mt-1 text-xs leading-5 text-surface-muted-foreground">
          {helper}
        </p>
      )}
      <div className="mt-3 grid auto-rows-fr gap-3 lg:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function ResourceCard({
  label,
  description,
  url,
  urlLabel,
}: {
  label: string;
  description: string;
  url: string;
  urlLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openURL(url)}
      className="w-full rounded-xl bg-surface-subtle p-4 text-left transition-[transform,background-color,box-shadow] duration-200 ease-emphasized will-change-transform hover:-translate-y-px hover:scale-[1.01] hover:bg-surface-hover hover:shadow-sm active:scale-[0.995]"
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <p className="mt-1 text-xs leading-5 text-surface-muted-foreground">
        {description}
      </p>
      <div className="mt-2 font-mono text-[0.6875rem] text-surface-muted-foreground">
        {urlLabel}
      </div>
    </button>
  );
}

export function WelcomeModal({
  isOpen,
  content,
  initialAnonymousEnabled,
  initialMouseTrackingEnabled,
  initialScreenCaptureEnabled,
  showMouseTraceChoice = false,
  showScreenCaptureChoice = false,
  showAnonymousChoice = false,
  runSyncEnabled,
  closeOnOutsideClick = true,
  closeOnEscapeKey = true,
  showCloseButton = true,
  onConfirm,
  onClose,
}: WelcomeModalProps) {
  const { t } = useI18n();
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(
    initialAnonymousEnabled ? "anonymous" : "public",
  );
  const [mouseTraceMode, setMouseTraceMode] = useState<MouseTraceMode>(
    initialMouseTrackingEnabled ? "enabled" : "disabled",
  );
  const [screenCaptureMode, setScreenCaptureMode] = useState<MouseTraceMode>(
    initialScreenCaptureEnabled ? "enabled" : "disabled",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPrivacyMode(initialAnonymousEnabled ? "anonymous" : "public");
  }, [initialAnonymousEnabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMouseTraceMode(initialMouseTrackingEnabled ? "enabled" : "disabled");
  }, [initialMouseTrackingEnabled, isOpen]);

  const syncStatus = runSyncEnabled
    ? t("welcome.modal.syncStatusEnabled")
    : t("welcome.modal.syncStatusDisabled");

  const handleContinue = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm({
        anonymousEnabled: privacyMode === "anonymous",
        mouseTrackingEnabled: showMouseTraceChoice
          ? mouseTraceMode === "enabled"
          : null,
        screenCaptureEnabled: showScreenCaptureChoice
          ? screenCaptureMode === "enabled"
          : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          {content.title}
        </span>
      }
      width="61.25rem"
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
              {content.details.map((detail) => (
                <p
                  key={detail}
                  className="text-sm leading-6 text-surface-muted-foreground"
                >
                  {detail}
                </p>
              ))}
            </div>
          </div>

          {(showMouseTraceChoice ||
            showScreenCaptureChoice ||
            showAnonymousChoice) && (
            <WelcomeSection
              title={
                showMouseTraceChoice
                  ? t("welcome.modal.sectionFirstTime")
                  : showAnonymousChoice
                    ? t("welcome.modal.sectionProfile")
                    : t("welcome.modal.sectionReview")
              }
              description={
                showMouseTraceChoice
                  ? t("welcome.modal.sectionFirstTimeDescription")
                  : showAnonymousChoice
                    ? t("welcome.modal.sectionProfileDescription")
                    : t("welcome.modal.sectionReviewDescription")
              }
            >
              <div className="space-y-3">
                {showAnonymousChoice && (
                  <ChoiceGroup
                    icon={<Database className="h-3.5 w-3.5" />}
                    label={t("welcome.modal.index.label")}
                    description={t("welcome.modal.index.description")}
                    helper={syncStatus}
                  >
                    <ChoiceCard
                      eyebrow={t("welcome.modal.recommended")}
                      eyebrowTone="primary"
                      label={t("welcome.modal.publicProfile.label")}
                      subtitle={t("welcome.modal.publicProfile.subtitle")}
                      description={t("welcome.modal.publicProfile.description")}
                      bullets={[
                        t("welcome.modal.publicProfile.bullets.0"),
                        t("welcome.modal.publicProfile.bullets.1"),
                      ]}
                      selected={privacyMode === "public"}
                      onSelect={() => setPrivacyMode("public")}
                      icon={<Globe2 className="h-4 w-4" />}
                    />

                    <ChoiceCard
                      eyebrow={t("welcome.modal.private")}
                      label={t("welcome.modal.anonymous.label")}
                      subtitle={t("welcome.modal.anonymous.subtitle")}
                      description={t("welcome.modal.anonymous.description")}
                      bullets={[
                        t("welcome.modal.anonymous.bullets.0"),
                        t("welcome.modal.anonymous.bullets.1"),
                        t("welcome.modal.anonymous.bullets.2"),
                      ]}
                      selected={privacyMode === "anonymous"}
                      onSelect={() => setPrivacyMode("anonymous")}
                      icon={<EyeOff className="h-4 w-4" />}
                    />
                  </ChoiceGroup>
                )}

                {showMouseTraceChoice && (
                  <ChoiceGroup
                    icon={<MousePointer2 className="h-3.5 w-3.5" />}
                    label={t("welcome.modal.mouseTraces.label")}
                    description={t("welcome.modal.mouseTraces.description")}
                    helper={t("welcome.modal.mouseTraces.helper")}
                  >
                    <ChoiceCard
                      eyebrow={t("welcome.modal.recommended")}
                      eyebrowTone="primary"
                      label={t("welcome.modal.mouseTraces.enabled.label")}
                      subtitle={t("welcome.modal.mouseTraces.enabled.subtitle")}
                      description={t(
                        "welcome.modal.mouseTraces.enabled.description",
                      )}
                      bullets={[
                        t("welcome.modal.mouseTraces.enabled.bullets.0"),
                        t("welcome.modal.mouseTraces.enabled.bullets.1"),
                        t("welcome.modal.mouseTraces.enabled.bullets.2"),
                      ]}
                      selected={mouseTraceMode === "enabled"}
                      onSelect={() => setMouseTraceMode("enabled")}
                      icon={<MousePointer2 className="h-4 w-4" />}
                    />

                    <ChoiceCard
                      eyebrow={t("welcome.modal.later")}
                      label={t("welcome.modal.mouseTraces.disabled.label")}
                      subtitle={t(
                        "welcome.modal.mouseTraces.disabled.subtitle",
                      )}
                      description={t(
                        "welcome.modal.mouseTraces.disabled.description",
                      )}
                      bullets={[
                        t("welcome.modal.mouseTraces.disabled.bullets.0"),
                        t("welcome.modal.mouseTraces.disabled.bullets.1"),
                        t("welcome.modal.mouseTraces.disabled.bullets.2"),
                      ]}
                      selected={mouseTraceMode === "disabled"}
                      onSelect={() => setMouseTraceMode("disabled")}
                      icon={<Clock className="h-4 w-4" />}
                    />
                  </ChoiceGroup>
                )}

                {showScreenCaptureChoice && (
                  <ChoiceGroup
                    icon={<MonitorPlay className="h-3.5 w-3.5" />}
                    label={t("welcome.modal.screenReplay.label")}
                    description={t("welcome.modal.screenReplay.description")}
                    helper={t("welcome.modal.screenReplay.helper")}
                  >
                    <ChoiceCard
                      eyebrow={t("welcome.modal.recommended")}
                      eyebrowTone="primary"
                      label={t("welcome.modal.screenReplay.enabled.label")}
                      subtitle={t(
                        "welcome.modal.screenReplay.enabled.subtitle",
                      )}
                      description={t(
                        "welcome.modal.screenReplay.enabled.description",
                      )}
                      bullets={[
                        t("welcome.modal.screenReplay.enabled.bullets.0"),
                        t("welcome.modal.screenReplay.enabled.bullets.1"),
                        t("welcome.modal.screenReplay.enabled.bullets.2"),
                      ]}
                      selected={screenCaptureMode === "enabled"}
                      onSelect={() => setScreenCaptureMode("enabled")}
                      icon={<MonitorPlay className="h-4 w-4" />}
                    />

                    <ChoiceCard
                      eyebrow={t("welcome.modal.later")}
                      label={t("welcome.modal.screenReplay.disabled.label")}
                      subtitle={t(
                        "welcome.modal.screenReplay.disabled.subtitle",
                      )}
                      description={t(
                        "welcome.modal.screenReplay.disabled.description",
                      )}
                      bullets={[
                        t("welcome.modal.screenReplay.disabled.bullets.0"),
                        t("welcome.modal.screenReplay.disabled.bullets.1"),
                        t("welcome.modal.screenReplay.disabled.bullets.2"),
                      ]}
                      selected={screenCaptureMode === "disabled"}
                      onSelect={() => setScreenCaptureMode("disabled")}
                      icon={<Clock className="h-4 w-4" />}
                    />
                  </ChoiceGroup>
                )}
              </div>
            </WelcomeSection>
          )}

          <WelcomeSection title={content.highlightsTitle}>
            <div className="grid gap-2.5 md:grid-cols-2">
              {content.highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-xl bg-surface-subtle px-4 py-3 text-sm leading-6 text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </WelcomeSection>

          <WelcomeSection
            title={content.linksTitle}
            description={t("welcome.modal.resourcesDescription")}
          >
            <div className="grid gap-2.5 md:grid-cols-2">
              {content.links.map((link) => (
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
          {isSaving ? t("common.actions.saving") : content.ctaLabel}
        </Button>
      </div>
    </Modal>
  );
}
