import { useSync } from '../contexts/SyncContext'

export default function SyncStatusBadge({ className = '' }) {
  const { syncStatus, pendingCount, flushOfflineQueue, isOnline } = useSync()

  let dotColor = '#16794A' // GREEN
  let labelText = 'Synced'
  let bgTint = 'rgba(22, 121, 74, 0.12)'
  let borderColor = 'rgba(22, 121, 74, 0.3)'
  let textColor = '#ffffff'

  if (syncStatus === 'syncing') {
    dotColor = '#d97706' // AMBER
    labelText = 'Syncing...'
    bgTint = 'rgba(217, 119, 6, 0.18)'
    borderColor = 'rgba(217, 119, 6, 0.4)'
  } else if (syncStatus === 'offline' || !isOnline || pendingCount > 0) {
    dotColor = '#D7263D' // RED
    labelText = isOnline && pendingCount > 0 ? 'Not Synced' : 'Offline — not synced'
    bgTint = 'rgba(215, 38, 61, 0.18)'
    borderColor = 'rgba(215, 38, 61, 0.4)'
  }

  return (
    <div
      onClick={() => {
        if (isOnline && pendingCount > 0) flushOfflineQueue()
      }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
        isOnline && pendingCount > 0 ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${className}`}
      style={{
        background: bgTint,
        border: `1px solid ${borderColor}`,
        color: textColor,
        backdropFilter: 'blur(6px)',
      }}
      title={
        pendingCount > 0
          ? `${pendingCount} item(s) waiting in device queue. Click to retry sync.`
          : isOnline
          ? 'Connected to database and synchronized.'
          : 'Operating offline. Data is saved locally on device.'
      }
      id="sync-status-badge"
    >
      {/* Pulsing indicator dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {syncStatus === 'syncing' && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ backgroundColor: dotColor }}
        />
      </span>

      <span className="tracking-tight whitespace-nowrap">{labelText}</span>

      {pendingCount > 0 && (
        <span
          className="ml-0.5 px-1.5 py-0.2 text-[10px] font-black rounded-full text-white"
          style={{ backgroundColor: dotColor }}
        >
          {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
        </span>
      )}
    </div>
  )
}
