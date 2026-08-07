import React from 'react'
import Money from '../ui/money'
import { cn } from '../../lib/utils'

export default function ReconRow({ label, amount, isDeduction, isHighlight, isNet, colorClass }) {
  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 text-sm",
      isNet ? "border-t border-border font-semibold pt-3 pb-3" : "border-b border-dashed border-border/60"
    )}>
      <span className={cn(isNet ? "text-base text-foreground font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <div className={cn("font-medium tabular-nums text-right", isNet && "text-lg font-bold text-foreground", colorClass)}>
        {isDeduction && amount > 0 ? (
          <span>-<Money amount={amount} className="inline" /></span>
        ) : (
          <Money amount={amount} className="inline" />
        )}
      </div>
    </div>
  )
}
