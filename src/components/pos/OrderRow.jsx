import React from 'react'
import { Badge } from '../ui/badge'
import Money from '../ui/money'
import { cn } from '../../lib/utils'

export default function OrderRow({ order, selected, onClick, timeAgoText }) {
  const isCredit = order.is_credit || order.customer_name
  const isOverdue = isCredit && order.created_at && (Date.now() - new Date(order.created_at).getTime() > 7 * 24 * 3600 * 1000)
  const isWaitingLong = !isCredit && order.created_at && (Date.now() - new Date(order.created_at).getTime() > 5 * 60 * 1000)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full min-h-[76px] p-3.5 text-left border-b border-border transition-colors flex items-center justify-between gap-3 cursor-pointer relative",
        selected
          ? "bg-brand-50/80 dark:bg-brand-950/40 border-l-4 border-l-brand-700"
          : "hover:bg-muted/50 bg-card",
        isWaitingLong && !selected && "border-l-2 border-l-amber-500"
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">
            #{order.order_number}
          </span>
          {isOverdue ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
          ) : isCredit ? (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">Credit</Badge>
          ) : order.status === 'held' ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Held</Badge>
          ) : (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">Waiting</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {order.customer_name ? order.customer_name : (order.attendant_name || 'Attendant')}
          <span className="mx-1">·</span>
          <span>{timeAgoText || 'just now'}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="text-right shrink-0">
        <Money amount={order.total_amount} className="text-base font-semibold tracking-tight text-foreground" />
      </div>
    </button>
  )
}
