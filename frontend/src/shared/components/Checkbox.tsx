import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({ checked, onChange, disabled = false, className = '' }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors flex-shrink-0 ${checked
          ? 'bg-accent border-accent'
          : 'bg-surface-2 border-primary hover:border-accent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {checked && <Check className="w-3.5 h-3.5 text-on-accent" strokeWidth={3} />}
    </button>
  )
}
