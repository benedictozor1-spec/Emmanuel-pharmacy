import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  getOfflineQueue,
  addOrderToOfflineQueue,
  addPaymentToOfflineQueue,
  removeOrderFromOfflineQueue,
  removePaymentFromOfflineQueue,
  saveProductsToCache,
  getProductsFromCache
} from '../utils/offlineQueue'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline')
  const [pendingCount, setPendingCount] = useState(0)

  // Refresh pending items count
  const refreshPendingCount = useCallback(() => {
    const { totalCount } = getOfflineQueue()
    setPendingCount(totalCount)
    if (totalCount > 0 && navigator.onLine) {
      setSyncStatus('offline') // Items waiting to send
    }
  }, [])

  // Health ping to verify REAL Supabase connection
  const checkSupabaseHealth = useCallback(async () => {
    if (!navigator.onLine || !supabase) {
      setIsOnline(false)
      const { totalCount } = getOfflineQueue()
      setPendingCount(totalCount)
      setSyncStatus('offline')
      return false
    }

    try {
      // Fast lightweight query to test db connection
      const { error } = await supabase.from('shop_settings').select('id').limit(1)
      const reachable = !error
      setIsOnline(reachable)

      const { totalCount } = getOfflineQueue()
      setPendingCount(totalCount)

      if (!reachable || totalCount > 0) {
        setSyncStatus(totalCount > 0 ? 'offline' : 'offline')
      } else {
        setSyncStatus('synced')
      }
      return reachable
    } catch {
      setIsOnline(false)
      const { totalCount } = getOfflineQueue()
      setPendingCount(totalCount)
      setSyncStatus('offline')
      return false
    }
  }, [])

  // Process and flush offline queue
  const flushOfflineQueue = useCallback(async () => {
    if (!supabase) return
    const isHealthy = await checkSupabaseHealth()
    if (!isHealthy) return

    const { orders, payments } = getOfflineQueue()
    if (orders.length === 0 && payments.length === 0) {
      setSyncStatus('synced')
      setPendingCount(0)
      return
    }

    setSyncStatus('syncing')

    try {
      // 1. Process Offline Orders
      for (const orderEntry of orders) {
        const { payload, offline_id } = orderEntry
        try {
          // Verify if order with exact receipt_ref already exists in DB
          const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('receipt_ref', payload.receipt_ref)
            .single()

          if (!existing) {
            const { data: insertedOrder, error: ordErr } = await supabase
              .from('orders')
              .insert({
                order_number: payload.order_number,
                receipt_ref: payload.receipt_ref,
                total_amount: payload.total_amount,
                status: payload.status || 'waiting_for_payment',
                attendant_name: payload.attendant_name,
                customer_name: payload.customer_name || null,
                customer_phone: payload.customer_phone || null,
                created_at: payload.created_at || new Date().toISOString()
              })
              .select('id')
              .single()

            if (ordErr) throw ordErr

            if (insertedOrder && Array.isArray(payload.items)) {
              const itemRows = payload.items.map(item => ({
                order_id: insertedOrder.id,
                product_id: item.product_id || (typeof item.id === 'string' && item.id.length > 10 ? item.id : null),
                product_name: item.product_name || item.name,
                quantity: item.quantity,
                unit_price: item.unit_price || item.selling_price,
                cost_price: item.cost_price || 0,
                total_price: (item.unit_price || item.selling_price) * item.quantity
              }))
              await supabase.from('order_items').insert(itemRows)
            }
          }

          removeOrderFromOfflineQueue(offline_id)
        } catch (err) {
          console.warn('⚠️ Order queue sync retry needed for', offline_id, err)
        }
      }

      // 2. Process Offline Payments
      for (const paymentEntry of payments) {
        const { payload, offline_id } = paymentEntry
        try {
          const { order_id, payment_method, cashier_name, total_amount, cash_amount, pos1_amount, transfer_amount, credit_amount, customer_name, customer_phone, is_credit } = payload

          const updatePayload = {
            status: 'paid',
            payment_method,
            cashier_name,
            paid_at: new Date().toISOString()
          }

          if (cash_amount !== undefined) updatePayload.cash_amount = cash_amount
          if (pos1_amount !== undefined) updatePayload.pos1_amount = pos1_amount
          if (transfer_amount !== undefined) updatePayload.transfer_amount = transfer_amount
          if (credit_amount !== undefined) updatePayload.credit_amount = credit_amount
          if (customer_name) updatePayload.customer_name = customer_name
          if (customer_phone) updatePayload.customer_phone = customer_phone
          if (is_credit !== undefined) updatePayload.is_credit = is_credit

          const { error: payErr } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order_id)

          if (payErr) throw payErr
          removePaymentFromOfflineQueue(offline_id)
        } catch (err) {
          console.warn('⚠️ Payment queue sync retry needed for', offline_id, err)
        }
      }

      // Re-check remaining queue
      const remaining = getOfflineQueue()
      setPendingCount(remaining.totalCount)

      if (remaining.totalCount === 0) {
        setSyncStatus('synced')
      } else {
        setSyncStatus('offline')
      }
    } catch (err) {
      console.error('❌ Offline queue sync failed:', err)
      refreshPendingCount()
    }
  }, [checkSupabaseHealth, refreshPendingCount])

  // Queue an offline order
  const queueOfflineOrder = useCallback((orderPayload) => {
    const entry = addOrderToOfflineQueue(orderPayload)
    refreshPendingCount()
    setSyncStatus('offline')
    return entry
  }, [refreshPendingCount])

  // Queue an offline payment
  const queueOfflinePayment = useCallback((paymentPayload) => {
    const entry = addPaymentToOfflineQueue(paymentPayload)
    refreshPendingCount()
    setSyncStatus('offline')
    return entry
  }, [refreshPendingCount])

  // Set up window network listeners & periodic health checks
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      flushOfflineQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
      refreshPendingCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial load check
    checkSupabaseHealth().then(healthy => {
      if (healthy) flushOfflineQueue()
    })

    // Interval health & flush check every 10 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) {
        const { totalCount } = getOfflineQueue()
        if (totalCount > 0) {
          flushOfflineQueue()
        } else {
          checkSupabaseHealth()
        }
      } else {
        setIsOnline(false)
        setSyncStatus('offline')
        refreshPendingCount()
      }
    }, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [checkSupabaseHealth, flushOfflineQueue, refreshPendingCount])

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncStatus,
        pendingCount,
        queueOfflineOrder,
        queueOfflinePayment,
        flushOfflineQueue,
        saveProductsToCache,
        getProductsFromCache,
        checkSupabaseHealth,
        refreshPendingCount
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}
