import React from 'react'
import { Banknote, CreditCard, ArrowLeftRight, Wallet } from 'lucide-react'
import { cn } from '../../lib/utils'

const METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'POS', label: 'POS Terminal', icon: CreditCard },
  { id: 'Transfer', label: 'Transfer', icon: ArrowLeftRight },
  { id: 'Credit', label: 'Credit / Owed', icon: Wallet },
]

export default function PaymentMethodPicker({ selectedMethods, onToggleMethod }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {METHODS.map(({ id, label, icon: Icon }) => {
        const isSelected = selectedMethods.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggleMethod(id)}
            className={cn(
              "h-14 px-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer",
              isSelected
                ? "border-brand-700 bg-brand-50/80 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 ring-1 ring-brand-700 font-semibold"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-brand-700 dark:text-brand-400" : "text-muted-foreground")} />
            <span className="text-xs truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
