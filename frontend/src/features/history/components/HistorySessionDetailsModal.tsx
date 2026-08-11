import { Button, Label, Modal } from "@/shared/components";
import { useEffect, useRef, useState } from "react";

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
      setError("Failed to save session notes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Session Notes"
      width="38.75rem"
      height="auto"
    >
      <div className="space-y-5 px-6 pb-6">
        <div className="text-xs text-surface-muted-foreground">
          {sessionLabel}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-notes">Notes</Label>
          <textarea
            ref={notesRef}
            id="session-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes for this session..."
            className="min-h-[11.25rem] w-full resize-none rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-surface-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
