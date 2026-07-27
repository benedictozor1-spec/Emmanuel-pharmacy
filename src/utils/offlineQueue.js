/**
 * Emmanuel Pharmacy — Offline Queue & Cache Manager
 * Handles local caching of products, offline queueing of orders/payments,
 * and idempotency deduplication keys.
 */

const STORAGE_KEYS = {
  PRODUCTS_CACHE: 'ep_offline_products_cache',
  ORDERS_QUEUE: 'ep_offline_orders_queue',
  PAYMENTS_QUEUE: 'ep_offline_payments_queue',
}

// -------------------------------------------------------------
// Product Cache Functions
// -------------------------------------------------------------
export function saveProductsToCache(products) {
  if (!Array.isArray(products) || products.length === 0) return
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_CACHE, JSON.stringify({
      timestamp: Date.now(),
      data: products
    }))
  } catch (err) {
    console.warn('⚠️ Could not save products to local cache:', err)
  }
}

export function getProductsFromCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS_CACHE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.data) ? parsed.data : []
  } catch (err) {
    console.warn('⚠️ Could not read products from local cache:', err)
    return []
  }
}

// -------------------------------------------------------------
// Offline Queue Functions (Orders & Payments)
// -------------------------------------------------------------
export function getOfflineQueue() {
  try {
    const ordersRaw = localStorage.getItem(STORAGE_KEYS.ORDERS_QUEUE)
    const paymentsRaw = localStorage.getItem(STORAGE_KEYS.PAYMENTS_QUEUE)

    const orders = ordersRaw ? JSON.parse(ordersRaw) : []
    const payments = paymentsRaw ? JSON.parse(paymentsRaw) : []

    return {
      orders: Array.isArray(orders) ? orders : [],
      payments: Array.isArray(payments) ? payments : [],
      totalCount: (Array.isArray(orders) ? orders.length : 0) + (Array.isArray(payments) ? payments.length : 0)
    }
  } catch (err) {
    console.warn('⚠️ Could not read offline queues:', err)
    return { orders: [], payments: [], totalCount: 0 }
  }
}

export function addOrderToOfflineQueue(orderPayload) {
  try {
    const { orders, payments } = getOfflineQueue()
    const offlineId = 'off-ord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    
    const entry = {
      offline_id: offlineId,
      created_at_local: new Date().toISOString(),
      payload: orderPayload,
      synced: false
    }

    orders.push(entry)
    localStorage.setItem(STORAGE_KEYS.ORDERS_QUEUE, JSON.stringify(orders))
    return entry
  } catch (err) {
    console.error('❌ Failed to save offline order to local queue:', err)
    throw err
  }
}

export function addPaymentToOfflineQueue(paymentPayload) {
  try {
    const { payments } = getOfflineQueue()
    const offlineId = 'off-pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)

    const entry = {
      offline_id: offlineId,
      created_at_local: new Date().toISOString(),
      payload: paymentPayload,
      synced: false
    }

    payments.push(entry)
    localStorage.setItem(STORAGE_KEYS.PAYMENTS_QUEUE, JSON.stringify(payments))
    return entry
  } catch (err) {
    console.error('❌ Failed to save offline payment to local queue:', err)
    throw err
  }
}

export function removeOrderFromOfflineQueue(offlineId) {
  try {
    const { orders } = getOfflineQueue()
    const filtered = orders.filter(o => o.offline_id !== offlineId)
    localStorage.setItem(STORAGE_KEYS.ORDERS_QUEUE, JSON.stringify(filtered))
  } catch (err) {
    console.warn('⚠️ Could not remove order from offline queue:', err)
  }
}

export function removePaymentFromOfflineQueue(offlineId) {
  try {
    const { payments } = getOfflineQueue()
    const filtered = payments.filter(p => p.offline_id !== offlineId)
    localStorage.setItem(STORAGE_KEYS.PAYMENTS_QUEUE, JSON.stringify(filtered))
  } catch (err) {
    console.warn('⚠️ Could not remove payment from offline queue:', err)
  }
}

export function clearAllOfflineQueues() {
  localStorage.removeItem(STORAGE_KEYS.ORDERS_QUEUE)
  localStorage.removeItem(STORAGE_KEYS.PAYMENTS_QUEUE)
}
