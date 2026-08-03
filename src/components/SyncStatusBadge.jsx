import { useSync } from '../contexts/SyncContext'

export default function SyncStatusBadge({ className = '', lightBg = false }) {
  const { syncStatus, pendingCount, flushOfflineQueue, isOnline } = useSync()

  let dotColor = '#16794A' // GREEN
  let labelText = 'Synced'
  let bgTint = lightBg ? '#E6F4EC' : 'rgba(22, 121, 74, 0.12)'
  let borderColor = lightBg ? '#A3E635' : 'rgba(22, 121, 74, 0.3)'
  let textColor = lightBg ? '#16794A' : '#ffffff'

  if (syncStatus === 'syncing') {
    dotColor = '#d97706' // AMBER
    labelText = 'Syncing...'
    bgTint = lightBg ? '#FEF3C7' : 'rgba(217, 119, 6, 0.18)'
    borderColor = lightBg ? '#FCD34D' : 'rgba(217, 119, 6, 0.4)'
    textColor = lightBg ? '#92400E' : '#ffffff'
  } else if (syncStatus === 'offline' || !isOnline || pendingCount > 0) {
    dotColor = '#D7263D' // RED
    labelText = isOnline && pendingCount > 0 ? 'Not Synced' : 'Offline'
    bgTint = lightBg ? '#FDE8EA' : 'rgba(215, 38, 61, 0.18)'
    borderColor = lightBg ? '#FCA5A5' : 'rgba(215, 38, 61, 0.4)'
    textColor = lightBg ? '#D7263D' : '#ffffff'
  }

  return (
    <div
      onClick={() => {
        if (isOnline && pendingCount > 0) flushOfflineQueue()
      }}
      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all shrink-0 ${
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
      <span className="relative flex h-2 w-2 shrink-0">
        {syncStatus === 'syncing' && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: dotColor }}
        />
      </span>

      <span className="tracking-tight whitespace-nowrap">{labelText}</span>

      {pendingCount > 0 && (
        <span
          className="ml-0.5 px-1.5 py-0.2 text-[9px] font-black rounded-full text-white"
          style={{ backgroundColor: dotColor }}
        >
          {pendingCount}
        </span>
      )}
    </div>
  )
}
