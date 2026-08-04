import React from 'react'
import { cn } from '../../lib/utils'

export function ToggleGroup({ children, value, onValueChange, className = '' }) {
  return (
    <div className={cn('inline-flex items-center rounded-xl bg-muted p-1 border border-border/60 gap-1', className)}>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child, {
          isSelected: child.props.value === value,
          onSelect: () => onValueChange && onValueChange(child.props.value),
        })
      })}
    </div>
  )
}

export function ToggleGroupItem({ value, isSelected, onSelect, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer select-none',
        isSelected
          ? 'bg-[#F0F4FE] dark:bg-[#1F45B8]/20 text-[#1F45B8] dark:text-[#9CB6F3] border border-[#C4D4F9] dark:border-[#1F45B8]/40 shadow-2xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
        className
      )}
    >
      {children}
    </button>
  )
}
