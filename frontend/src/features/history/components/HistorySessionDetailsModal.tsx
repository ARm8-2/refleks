import { Button, Label, Modal } from "@/shared/components";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  isOpen: boolean;
  sessionLabel: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
};

export function HistorySessionDetailsModal({
  isOpen,
  sessionLabel,
  initialNotes,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation("errors");
  const { t: tHistory } = useTranslation("history");
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNotes(initialNotes);
    setError(null);
  }, [isOpen, initialNotes]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      notesRef.current?.focus();
    });
  }, [isOpen]);

  const hasChanges = notes !== initialNotes;

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(notes);
      onClose();
    } catch {
      setError(t("history.saveNotesFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tHistory("overview.notes")}
      width={620}
      height="auto"
    >
      <div className="space-y-5 px-6 pb-6">
        <div className="text-xs text-surface-muted-foreground">
          {sessionLabel}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-notes">{tHistory("overview.notes")}</Label>
          <textarea
            ref={notesRef}
            id="session-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={tHistory("overview.addNotes")}
            className="min-h-[180px] w-full resize-none rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-surface-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tHistory("overview.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? tHistory("overview.saving") : tHistory("overview.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
