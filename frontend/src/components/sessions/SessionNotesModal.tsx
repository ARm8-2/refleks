import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type SessionNotesModalProps = {
  isOpen: boolean
  onClose: () => void
  sessionName: string
  initialNotes: string
  onSave: (notes: string) => Promise<void>
}

export function SessionNotesModal({ isOpen, onClose, sessionName, initialNotes, onSave }: SessionNotesModalProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes)
    }
  }, [isOpen, initialNotes])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(notes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Notes for ${sessionName}`} width={520} height="auto">
      <div className="flex flex-col">
        <div className="p-6 space-y-6">
          <div className="space-y-2 flex flex-col">
            <label htmlFor="notes" className="block text-xs font-semibold text-secondary uppercase tracking-wide">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Track your thoughts on this session..."
              className="min-h-[160px] bg-primary border border-primary rounded px-3 py-2.5 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-primary bg-surface-3/40 flex items-center justify-end gap-3">
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
