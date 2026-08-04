import React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#1F45B8] text-white hover:bg-[#1D3A94]',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700',
        destructive: 'border-transparent bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40',
        outline: 'border-neutral-200 dark:border-neutral-800 text-foreground',
        success: 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
        warning: 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
        brand: 'border-[#C4D4F9] dark:border-[#1F45B8]/40 bg-[#F0F4FE] dark:bg-[#1F45B8]/20 text-[#1F45B8] dark:text-[#9CB6F3]',
        neutral: 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
