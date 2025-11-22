import { Copy, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type NotesModalProps = {
  isOpen: boolean
  onClose: () => void
  scenarioName: string
  initialNotes: string
  initialSens: string
  onSave: (notes: string, sens: string) => Promise<void>
}

export function NotesModal({ isOpen, onClose, scenarioName, initialNotes, initialSens, onSave }: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [sens, setSens] = useState(initialSens)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes)
      setSens(initialSens)
    }
  }, [isOpen, initialNotes, initialSens])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(notes, sens)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sens)
    } catch {
      // Silent fail - copy button is convenience feature
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={scenarioName} width={520}>
      <div className="flex flex-col h-full">
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <label htmlFor="sensitivity" className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Training Sensitivity
            </label>
            <div className="flex gap-2">
              <input
                id="sensitivity"
                type="text"
                value={sens}
                onChange={e => setSens(e.target.value)}
                placeholder="e.g. 35.8cm or 0.5"
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all"
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleCopy}
                title="Copy sensitivity to clipboard"
                disabled={!sens.trim()}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 flex-1 flex flex-col">
            <label htmlFor="notes" className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Track your strategy, weaknesses, and what to focus on..."
              className="flex-1 min-h-[160px] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]/40 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="primary" size="md">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
