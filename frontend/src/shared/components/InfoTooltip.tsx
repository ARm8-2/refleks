import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

type InfoTooltipProps = {
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  iconClassName?: string
}

export function InfoTooltip({ children, side = 'bottom', className, iconClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground',
              iconClassName,
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn(
            'rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl',
            className,
          )}
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
