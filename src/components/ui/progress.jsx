import React from 'react'
import { cn } from '../../lib/utils'

const Progress = React.forwardRef(({ className, value = 0, max = 100, ...props }, ref) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-[#1F45B8] transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
})
Progress.displayName = 'Progress'

export { Progress }
