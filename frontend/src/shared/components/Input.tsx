import type { InputHTMLAttributes } from 'react'

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

export function Input({
  size = 'sm',
  fullWidth = false,
  className = '',
  ...props
}: InputProps) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'
  const width = fullWidth ? 'w-full' : ''

  return (
    <input
      className={`${pad} ${width} rounded bg-surface-2 border border-primary text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
      {...props}
    />
  )
}
