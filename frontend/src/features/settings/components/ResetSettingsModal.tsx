import { Button, Checkbox, Label, Modal } from '@/shared/components'
import { resetSettings } from '@/shared/lib'
import { useState } from 'react'

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
      <div className="flex flex-col gap-4">
        <p className="text-surface-muted-foreground text-sm">
          Select which data you want to reset to defaults:
        </p>
        <div className="flex flex-col gap-3">
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={options.config} onCheckedChange={() => toggleOption('config')} />
            <span className="text-sm">Settings &amp; Configuration</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={options.favorites} onCheckedChange={() => toggleOption('favorites')} />
            <span className="text-sm">Favorite Scenarios</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={options.scenarioNotes} onCheckedChange={() => toggleOption('scenarioNotes')} />
            <span className="text-sm">Scenario Notes</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={options.sessionNotes} onCheckedChange={() => toggleOption('sessionNotes')} />
            <span className="text-sm">Session Notes</span>
          </Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={loading || !anySelected}>
            {loading ? 'Resetting...' : 'Reset Selected'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
