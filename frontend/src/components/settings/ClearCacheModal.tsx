import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type ClearCacheModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function ClearCacheModal({ isOpen, onClose, onConfirm }: ClearCacheModalProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clear Cache" width={400} height="auto">
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 p-3 bg-surface-3 rounded border border-accent/20">
          <AlertTriangle className="text-accent shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-secondary">
            Are you sure you want to clear the application cache? This will remove all temporary files.
            <br />
            Your settings and persistent data will not be affected.
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Clearing...' : 'Clear Cache'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
