import { useEffect, useRef, useState } from "react";
import type { WelcomePresentation } from "../lib/presentation";
import { WelcomeModal } from "./WelcomeModal";

const WELCOME_MODAL_CLOSE_DURATION_MS = 220;

type WelcomeModalSessionProps = {
  presentation: WelcomePresentation | null;
  onConfirm: (choices: {
    anonymousEnabled: boolean;
    mouseTrackingEnabled: boolean | null;
  }) => Promise<void> | void;
  onDismissed: (reason: "confirm" | "dismiss") => void;
  closeOnOutsideClick?: boolean;
  closeOnEscapeKey?: boolean;
  showCloseButton?: boolean;
};

export function WelcomeModalSession({
  presentation,
  onConfirm,
  onDismissed,
  closeOnOutsideClick,
  closeOnEscapeKey,
  showCloseButton,
}: WelcomeModalSessionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (presentation) {
      setIsOpen(true);
    }
  }, [presentation]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const completeClose = (reason: "confirm" | "dismiss") => {
    setIsOpen(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onDismissed(reason);
    }, WELCOME_MODAL_CLOSE_DURATION_MS);
  };

  if (!presentation) {
    return null;
  }

  return (
    <WelcomeModal
      isOpen={isOpen}
      content={presentation.content}
      initialAnonymousEnabled={presentation.initialAnonymousEnabled}
      initialMouseTrackingEnabled={presentation.initialMouseTrackingEnabled}
      showMouseTraceChoice={presentation.showMouseTraceChoice}
      showAnonymousChoice={presentation.showAnonymousChoice}
      runSyncEnabled={presentation.runSyncEnabled}
      closeOnOutsideClick={closeOnOutsideClick}
      closeOnEscapeKey={closeOnEscapeKey}
      showCloseButton={showCloseButton}
      onConfirm={async (choices) => {
        await onConfirm(choices);
        completeClose("confirm");
      }}
      onClose={() => completeClose("dismiss")}
    />
  );
}
