import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
type Size = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }

export function Button({
  variant = 'secondary',
  size = 'sm',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded transition-colors'
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1.5 text-sm'
  const styles: Record<Variant, string> = {
    primary: 'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
    secondary: 'bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
    ghost: 'bg-transparent border border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]',
    accent: 'bg-[var(--accent-primary)] text-white hover:brightness-110',
    danger: 'bg-[var(--error)] text-white hover:brightness-110',
  }
  const cls = `${base} ${pad} ${styles[variant]} ${className}`
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
