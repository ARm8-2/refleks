import { ReactNode, forwardRef } from 'react'

type InputProps = {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  size?: 'sm' | 'md'
  fullWidth?: boolean
  icon?: ReactNode
  autoFocus?: boolean
  className?: string
  type?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  size = 'md',
  fullWidth = false,
  icon,
  autoFocus,
  className = '',
  type = 'text',
}, ref) => {
  const pad = size === 'md' ? 'py-2 text-sm' : 'py-1 text-sm'
  const pl = icon ? 'pl-8' : 'pl-2'

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {icon && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`
          ${pad} ${pl} pr-2 rounded bg-surface-2 border border-primary
          text-primary placeholder:text-secondary
          focus:outline-none focus:ring-2 focus:ring-accent/60
          hover:bg-surface-3 transition-colors
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
      />
    </div>
  )
})

Input.displayName = 'Input'
