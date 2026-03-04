import { Copy, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Modal } from '../../../../shared/components'

type Props = {
  isOpen: boolean
  onClose: () => void
  scenarioName: string
  initialNotes: string
  initialSensitivity: string
  onSave: (notes: string, sensitivity: string) => Promise<void>
}

export function ScenarioNotesModal({
  isOpen,
  onClose,
  scenarioName,
  initialNotes,
  initialSensitivity,
  onSave,
}: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [sensitivity, setSensitivity] = useState(initialSensitivity)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setNotes(initialNotes)
    setSensitivity(initialSensitivity)
  }, [isOpen, initialNotes, initialSensitivity])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(notes, sensitivity)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    if (!sensitivity.trim()) return
    try {
      await navigator.clipboard.writeText(sensitivity)
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={scenarioName} width={560} height="auto">
      <div className="px-6 pb-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="scenario-sensitivity" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Training Sensitivity
          </label>
          <div className="flex gap-2">
            <input
              id="scenario-sensitivity"
              type="text"
              value={sensitivity}
              onChange={event => setSensitivity(event.target.value)}
              placeholder="e.g. 35.8cm or 0.5"
              className="flex-1 rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={!sensitivity.trim()} title="Copy sensitivity">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="scenario-notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Notes
          </label>
          <textarea
            id="scenario-notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Track your strategy, weaknesses, and focus points..."
            className="min-h-[170px] w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
