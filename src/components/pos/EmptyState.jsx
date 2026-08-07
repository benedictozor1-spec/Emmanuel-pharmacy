import React from 'react'
import { cn } from '../../lib/utils'

export default function EmptyState({ icon: Icon, title, description, className, children }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      {Icon && <Icon className="h-8 w-8 text-muted-foreground stroke-[1.5] mb-3" />}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-[280px] text-balance">{description}</p>}
      {children}
    </div>
  )
}
