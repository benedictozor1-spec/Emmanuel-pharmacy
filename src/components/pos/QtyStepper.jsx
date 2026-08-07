import React from 'react'
import { Button } from '../ui/button'
import { Plus, Minus } from 'lucide-react'

export default function QtyStepper({ value, onDecrement, onIncrement, min = 1, max = 999, disabled = false }) {
  return (
    <div className="flex items-center border border-border rounded-lg bg-card p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded shrink-0"
        onClick={onDecrement}
        disabled={disabled || value <= min}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-8 text-center text-xs font-semibold tabular-nums text-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded shrink-0"
        onClick={onIncrement}
        disabled={disabled || value >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}
