import React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F45B8]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-[#1F45B8] text-white hover:bg-[#1D3A94] active:bg-[#1C3375] shadow-xs',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs',
        outline: 'border border-neutral-200 dark:border-neutral-800 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-accent-foreground',
        secondary: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700',
        ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-accent-foreground',
        link: 'text-[#1F45B8] underline-offset-4 hover:underline',
        brand: 'bg-[#F0F4FE] text-[#1F45B8] dark:bg-[#1F45B8]/20 dark:text-[#9CB6F3] hover:bg-[#DEE7FC] dark:hover:bg-[#1F45B8]/30',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-md px-2.5 text-xs',
        lg: 'h-10 rounded-lg px-5 text-sm',
        xl: 'h-11 rounded-lg px-6 text-sm font-bold',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
