import { useState } from 'react'
import { Button, Modal } from '../../../shared/components'
import { resetSettings } from '../../../shared/lib'

type ResetSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  onReset?: () => void
}

type ResetOptions = {
  config: boolean
  favorites: boolean
  scenarioNotes: boolean
  sessionNotes: boolean
}

export function ResetSettingsModal({ isOpen, onClose, onReset }: ResetSettingsModalProps) {
  const [options, setOptions] = useState<ResetOptions>({
    config: true,
    favorites: false,
    scenarioNotes: false,
    sessionNotes: false,
  })
  const [loading, setLoading] = useState(false)

  const toggleOption = (key: keyof ResetOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      await resetSettings(
        options.config,
        options.favorites,
        options.scenarioNotes,
        options.sessionNotes
      )
      onReset?.()
      onClose()
    } catch (error) {
      console.error('Failed to reset:', error)
    } finally {
      setLoading(false)
    }
  }

  const anySelected = Object.values(options).some(Boolean)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset Settings" width={420} height="auto">
      <div className="p-4 flex flex-col gap-4">
        <p className="text-secondary text-sm">
          Select which data you want to reset to defaults:
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.config}
              onChange={() => toggleOption('config')}
              className="w-4 h-4 rounded border-primary bg-surface-3 text-accent focus:ring-accent"
            />
            <span className="text-primary text-sm">Settings &amp; Configuration</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.favorites}
              onChange={() => toggleOption('favorites')}
              className="w-4 h-4 rounded border-primary bg-surface-3 text-accent focus:ring-accent"
            />
            <span className="text-primary text-sm">Favorite Scenarios</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.scenarioNotes}
              onChange={() => toggleOption('scenarioNotes')}
              className="w-4 h-4 rounded border-primary bg-surface-3 text-accent focus:ring-accent"
            />
            <span className="text-primary text-sm">Scenario Notes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.sessionNotes}
              onChange={() => toggleOption('sessionNotes')}
              className="w-4 h-4 rounded border-primary bg-surface-3 text-accent focus:ring-accent"
            />
            <span className="text-primary text-sm">Session Notes</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReset} disabled={loading || !anySelected}>
            {loading ? 'Resetting...' : 'Reset Selected'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
