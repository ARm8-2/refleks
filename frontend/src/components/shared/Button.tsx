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
  const base = 'inline-flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1.5 text-sm'
  const styles: Record<Variant, string> = {
    primary: 'bg-surface-3 border border-primary text-primary hover:bg-surface-2',
    secondary: 'bg-surface-2 border border-primary text-primary hover:bg-surface-3',
    ghost: 'bg-transparent border border-transparent text-primary hover:bg-surface-3 hover:border-primary',
    accent: 'bg-accent text-on-accent hover:brightness-110',
    danger: 'bg-danger text-on-accent hover:brightness-110',
  }
  const cls = `${base} ${pad} ${styles[variant]} ${className}`
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
