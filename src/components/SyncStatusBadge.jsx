import React from 'react'
import { useSync } from '../contexts/SyncContext'
import { Badge } from './ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip'
import { cn } from '../lib/utils'

export default function SyncStatusBadge({ className = '' }) {
  const { syncStatus, pendingCount, flushOfflineQueue, isOnline } = useSync()

  let dotColor = 'bg-emerald-500'
  let labelText = 'Synced'
  let tooltipText = 'Last synced 2 min ago'

  if (syncStatus === 'syncing') {
    dotColor = 'bg-amber-500'
    labelText = 'Syncing…'
    tooltipText = 'Saving changes to cloud…'
  } else if (syncStatus === 'offline' || !isOnline || pendingCount > 0) {
    dotColor = 'bg-red-500'
    labelText = isOnline && pendingCount > 0 ? 'Unsynced' : 'Offline'
    tooltipText = pendingCount > 0
      ? `${pendingCount} item(s) waiting in queue. Click to retry sync.`
      : 'Offline mode active. Local data saved.'
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => {
              if (isOnline && pendingCount > 0) flushOfflineQueue()
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-foreground shadow-2xs transition-colors cursor-default',
              isOnline && pendingCount > 0 && 'cursor-pointer hover:bg-muted active:scale-95',
              className
            )}
            id="sync-status-badge"
            aria-label={tooltipText}
          >
            {/* 6px indicator dot */}
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              {syncStatus === 'syncing' && (
                <span
                  className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', dotColor)}
                />
              )}
              <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', dotColor)} />
            </span>

            <span className="tracking-tight whitespace-nowrap">{labelText}</span>

            {pendingCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-red-600 text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
