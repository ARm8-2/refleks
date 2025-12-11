import { AlertTriangle, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type ResetSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: boolean, favorites: boolean, scenarioNotes: boolean, sessionNotes: boolean) => Promise<void>
}

function CheckboxRow({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded bg-surface-2 border border-transparent hover:border-primary cursor-pointer transition-colors select-none"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm font-medium text-primary">{label}</span>
      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-accent border-accent' : 'border-secondary bg-transparent'}`}>
        {checked && <Check size={14} className="text-on-accent" />}
      </div>
    </div>
  )
}

export function ResetSettingsModal({ isOpen, onClose, onConfirm }: ResetSettingsModalProps) {
  const [config, setConfig] = useState(true)
  const [favorites, setFavorites] = useState(false)
  const [scenarioNotes, setScenarioNotes] = useState(false)
  const [sessionNotes, setSessionNotes] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(config, favorites, scenarioNotes, sessionNotes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset Settings" width={400} height="auto">
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 p-3 bg-surface-3 rounded border border-accent/20">
          <AlertTriangle className="text-accent shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-secondary">
            Select which data you want to reset to defaults. This action cannot be undone.
          </div>
        </div>

        <div className="space-y-2">
          <CheckboxRow label="Application Settings" checked={config} onChange={setConfig} />
          <CheckboxRow label="Favorite Benchmarks" checked={favorites} onChange={setFavorites} />
          <CheckboxRow label="Scenario Notes & Sens" checked={scenarioNotes} onChange={setScenarioNotes} />
          <CheckboxRow label="Session Names & Notes" checked={sessionNotes} onChange={setSessionNotes} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || (!config && !favorites && !scenarioNotes && !sessionNotes)} variant="primary">
            {saving ? 'Resetting...' : 'Reset Selected'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
