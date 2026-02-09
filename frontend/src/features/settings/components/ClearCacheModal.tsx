import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Modal } from '../../../shared/components/Modal'
import { clearCache } from '../../../shared/lib/api'

type ClearCacheModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function ClearCacheModal({ isOpen, onClose }: ClearCacheModalProps) {
  const [loading, setLoading] = useState(false)

  const handleClear = async () => {
    setLoading(true)
    try {
      await clearCache()
      onClose()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clear Cache" width={400} height="auto">
      <div className="p-4 flex flex-col gap-4">
        <p className="text-secondary text-sm">
          This will clear all cached data including parsed stats and computed rankings.
          Your settings and session data will not be affected.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClear} disabled={loading}>
            {loading ? 'Clearing...' : 'Clear Cache'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
