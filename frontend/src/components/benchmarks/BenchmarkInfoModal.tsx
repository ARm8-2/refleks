import { Check, ChevronDown, ChevronUp, LayoutDashboard, Minus, NotebookPen, Play, Sparkles, Trophy, Zap } from 'lucide-react'
import { Modal } from '../shared/Modal'

type BenchmarkInfoModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function BenchmarkInfoModal({ isOpen, onClose }: BenchmarkInfoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Benchmark Tracking Info" width={650} height="auto">
      <div className="p-6 space-y-8 text-sm text-secondary">

        {/* Overview */}
        <div className="space-y-3">
          <h3 className="text-primary font-medium flex items-center gap-2">
            <LayoutDashboard size={16} className="text-accent" />
            Overview
          </h3>
          <p>
            This dashboard tracks your progress across various scenarios, organized by category.
            It provides a comprehensive view of your skill level, helping you identify strengths, weaknesses, and what to play next to improve efficiently.
          </p>
        </div>

        {/* Recommendations */}
        <div className="space-y-3">
          <h3 className="text-primary font-medium flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            Recommendations
          </h3>
          <p>
            RefleK's analyzes your recent sessions, performance trends, and fatigue to suggest scenarios.
          </p>

          <div className="bg-surface-3/50 p-4 rounded border border-primary/50">
            <div className="flex flex-wrap gap-6 text-xs text-secondary">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-accent"><ChevronUp size={12} /><ChevronUp size={12} /></div>
                <span>Top Pick</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-success"><ChevronUp size={12} /><ChevronUp size={12} /></div>
                <span>Strongly Recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-success"><ChevronUp size={12} /></div>
                <span>Recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-warning"><ChevronUp size={12} /></div>
                <span>Consider Playing</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus size={12} className="text-tertiary" />
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-warning"><ChevronDown size={12} /></div>
                <span>Consider Switching</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center -space-y-1.5 text-danger"><ChevronDown size={12} /><ChevronDown size={12} /></div>
                <span>Stop / Switch</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={12} className="text-tertiary" />
                <span>Completed</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-3/30 p-3 rounded text-xs space-y-2">
            <p><span className="text-accent font-medium">Top Picks</span> are special recommendations selected based on:</p>
            <ul className="list-disc list-inside ml-1 space-y-1 text-tertiary">
              <li>High recommendation score (performance + improvement potential)</li>
              <li>Category diversity (ensuring a balanced routine)</li>
              <li>Recent focus areas</li>
            </ul>
          </div>
        </div>

        {/* Progress & Ranks */}
        <div className="space-y-3">
          <h3 className="text-primary font-medium flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            Progress & Ranks
          </h3>
          <p>
            Each scenario has rank thresholds (e.g., Iron, Bronze, Silver). The progress bars indicate how close you are to achieving the next rank.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1 text-tertiary">
            <li><span className="text-primary">Filled Bar:</span> Progress towards the next rank threshold.</li>
            <li><span className="text-primary">Color:</span> The rank tier you have achieved.</li>
            <li><span className="text-primary">Score:</span> Your current high score.</li>
          </ul>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <h3 className="text-primary font-medium flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            Tools & Features
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-surface-3 text-primary shrink-0">
                <NotebookPen size={14} />
              </div>
              <div className="text-xs">
                <span className="text-primary font-medium block mb-0.5">Notes & Sensitivity</span>
                Save strategy notes and specific sensitivity settings for each scenario.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-surface-3 text-primary shrink-0">
                <Play size={14} />
              </div>
              <div className="text-xs">
                <span className="text-primary font-medium block mb-0.5">Quick Play</span>
                Launch the scenario directly in Kovaak's.
              </div>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  )
}
