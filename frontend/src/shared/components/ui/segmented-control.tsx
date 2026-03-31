import * as React from 'react'

import { cn } from '@/shared/lib/utils'
import { Tabs, TabsList, TabsTrigger } from './tabs'

type SegmentedControlOption<T extends string | number> = {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

type SegmentedControlProps<T extends string | number> = {
  value: T
  options: Array<SegmentedControlOption<T>>
  onValueChange: (value: T) => void
  className?: string
  itemClassName?: string
  activeItemClassName?: string
  inactiveItemClassName?: string
  indicatorClassName?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onValueChange,
  className,
  itemClassName,
  activeItemClassName,
  inactiveItemClassName,
  indicatorClassName,
  size = 'md',
}: SegmentedControlProps<T>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = React.useState<{ x: number; width: number; ready: boolean }>({
    x: 0,
    width: 0,
    ready: false,
  })

  const syncIndicator = React.useCallback(() => {
    const container = containerRef.current
    const item = itemRefs.current[String(value)]
    if (!container || !item) return

    const containerRect = container.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()

    setIndicator({
      x: itemRect.left - containerRect.left,
      width: itemRect.width,
      ready: true,
    })
  }, [value])

  React.useLayoutEffect(() => {
    syncIndicator()
  }, [syncIndicator, options])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    syncIndicator()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncIndicator)
      return () => window.removeEventListener("resize", syncIndicator)
    }

    const observer = new ResizeObserver(() => syncIndicator())
    observer.observe(container)
    options.forEach(option => {
      const item = itemRefs.current[String(option.value)]
      if (item) observer.observe(item)
    })

    return () => observer.disconnect()
  }, [options, syncIndicator])

  const optionsByKey = React.useMemo(
    () => new Map(options.map(option => [String(option.value), option.value] as const)),
    [options],
  )

  const handleValueChange = React.useCallback((nextValueKey: string) => {
    const nextValue = optionsByKey.get(nextValueKey)
    if (nextValue !== undefined) onValueChange(nextValue)
  }, [onValueChange, optionsByKey])

  const valueKey = String(value)

  const sizeClasses = size === 'sm'
    ? 'h-7 px-2.5 text-xs'
    : 'h-8 px-3 text-sm'

  return (
    <Tabs
      value={valueKey}
      onValueChange={handleValueChange}
    >
      <TabsList
        ref={containerRef}
        className={cn(
          'relative inline-flex h-auto items-center rounded-xl bg-surface-subtle p-1',
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-0 top-1 h-8 rounded-lg bg-surface shadow-sm transition-[transform,width,opacity] duration-250 ease-out',
            size === 'sm' && 'h-7',
            !indicator.ready && 'opacity-0',
            indicatorClassName,
          )}
          style={{
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.x}px)`,
          }}
        />

        {options.map(option => {
          const optionValueKey = String(option.value)
          const selected = optionValueKey === valueKey
          return (
            <TabsTrigger
              key={optionValueKey}
              ref={node => {
                itemRefs.current[optionValueKey] = node
              }}
              value={optionValueKey}
              disabled={option.disabled}
              className={cn(
                'relative z-10 inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                sizeClasses,
                selected
                  ? 'text-foreground'
                  : 'text-surface-muted-foreground hover:text-foreground',
                selected && activeItemClassName,
                !selected && inactiveItemClassName,
                itemClassName,
              )}
            >
              {option.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
