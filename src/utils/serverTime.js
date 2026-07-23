import { supabase } from '../lib/supabase'

let timeOffsetMs = 0
let isSynced = false

/**
 * Synchronizes client clock with Supabase database server timestamp
 */
export async function syncServerTime() {
  if (!supabase) return
  try {
    const start = Date.now()
    const { data, error } = await supabase.rpc('get_server_time')
    let serverMs = null
    if (!error && data) {
      serverMs = new Date(data).getTime()
    } else {
      // Fallback: query any recent record to get DB created_at timestamp
      const { data: notifs } = await supabase.from('notifications').select('created_at').order('created_at', { ascending: false }).limit(1)
      if (notifs && notifs.length > 0 && notifs[0].created_at) {
        serverMs = new Date(notifs[0].created_at).getTime()
      }
    }

    if (serverMs) {
      const end = Date.now()
      const latency = Math.round((end - start) / 2)
      timeOffsetMs = (serverMs + latency) - end
      isSynced = true
    }
  } catch (err) {
    console.warn('Server time sync notice:', err)
  }
}

/**
 * Returns current Date object adjusted for Supabase Server Time
 */
export function getServerNow() {
  return new Date(Date.now() + timeOffsetMs)
}

/**
 * Returns YYYY-MM-DD string in Africa/Lagos (Nigeria WAT) timezone based on server time
 */
export function getServerTodayStr() {
  const d = getServerNow()
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

/**
 * Formats any Date or timestamp in Africa/Lagos timezone
 */
export function formatServerTime(dateInput, options = { hour: '2-digit', minute: '2-digit' }) {
  if (!dateInput) return ''
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
    return d.toLocaleTimeString('en-NG', { ...options, timeZone: 'Africa/Lagos' })
  } catch (e) {
    return String(dateInput)
  }
}

/**
 * Formats any Date or timestamp as Date string in Africa/Lagos timezone
 */
export function formatServerDate(dateInput, options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateInput) return ''
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
    return d.toLocaleDateString('en-NG', { ...options, timeZone: 'Africa/Lagos' })
  } catch (e) {
    return String(dateInput)
  }
}
