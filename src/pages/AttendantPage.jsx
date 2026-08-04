import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../hooks/useCart'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import SyncStatusBadge from '../components/SyncStatusBadge'
import SellingDesk from '../components/SellingDesk'
import AppShell from '../components/AppShell'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { LogOut, Loader2 } from 'lucide-react'

// Mock seed inventory as fallback if Supabase table hasn't been migrated yet
const MOCK_PRODUCTS = [
  { id: '1', name: 'Paracetamol 500mg', brand: 'Emzor', unit: 'tab', selling_price: 50, stock_quantity: 240, expiry_date: '2027-08-31' },
  { id: '2', name: 'Amoxicillin 500mg', brand: 'Fidson', unit: 'cap', selling_price: 120, stock_quantity: 8, expiry_date: '2026-09-30' },
  { id: '3', name: 'Artemether / Lumefantrine', brand: 'Novartis · Coartem', unit: 'pack', selling_price: 1800, stock_quantity: 45, expiry_date: '2028-05-31' },
  { id: '4', name: 'Vitamin C 1000mg', brand: 'Emzor', unit: 'tab', selling_price: 30, stock_quantity: 500, expiry_date: '2027-11-30' },
  { id: '5', name: 'Metformin 500mg', brand: 'Swiss Pharma', unit: 'tab', selling_price: 80, stock_quantity: 15, expiry_date: '2026-12-31' },
  { id: '6', name: 'ORS Sachet', brand: 'Generic', unit: 'sachet', selling_price: 100, stock_quantity: 120, expiry_date: '2027-06-30' },
]

export default function AttendantPage() {
  const navigate = useNavigate()
  const { logout, user, fullName, username } = useAuth()
  const { saveProductsToCache, getProductsFromCache, queueOfflineOrder, pendingCount } = useSync()
  const cart = useCart()

  // Products state
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Order submission state
  const [submitting, setSubmitting] = useState(false)
  const [completedOrderNumber, setCompletedOrderNumber] = useState(null)
  const [isOfflinePendingOrder, setIsOfflinePendingOrder] = useState(false)

  // Fetch products
  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true)
      try {
        if (supabase && navigator.onLine) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name')
          if (!error && data && data.length > 0) {
            setProducts(data)
            saveProductsToCache(data)
            setLoadingProducts(false)
            return
          }
        }
      } catch (err) {
        console.warn('Network error loading products, falling back to cache:', err)
      }

      // Offline Cache Fallback
      const cached = getProductsFromCache()
      if (cached && cached.length > 0) {
        setProducts(cached)
      } else {
        setProducts(MOCK_PRODUCTS)
      }
      setLoadingProducts(false)
    }

    loadProducts()
  }, [])

  // Handle Order Creation / Queue to Cashier
  const handleSendToCashier = async () => {
    if (cart.items.length === 0) return
    setSubmitting(true)
    setIsOfflinePendingOrder(false)

    let orderNum = Math.floor(Math.random() * 90) + 10
    const receiptRef = 'EP-' + Date.now().toString().slice(-6)
    const attendantName = fullName || username || 'Attendant'

    try {
      if (supabase && navigator.onLine) {
        const { data: numData, error: numError } = await supabase.rpc('get_next_order_number')
        if (!numError && numData) {
          orderNum = numData
        }

        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNum,
            receipt_ref: receiptRef,
            attendant_id: user?.id || null,
            attendant_name: attendantName,
            total_amount: cart.totalAmount,
            is_credit: false,
            customer_name: null,
            customer_phone: null,
            status: 'waiting_for_payment',
          })
          .select()
          .single()

        if (!orderErr && orderData) {
          const itemsToInsert = cart.items.map((item) => ({
            order_id: orderData.id,
            product_id: item.id.length > 10 ? item.id : null,
            product_name: item.name,
            unit: item.unit || 'tab',
            unit_price: item.selling_price || item.price,
            quantity: item.quantity,
            total_price: (item.selling_price || item.price) * item.quantity,
          }))

          await supabase.from('order_items').insert(itemsToInsert)

          setCompletedOrderNumber(orderNum)
          cart.clearCart()
          setSubmitting(false)
          return
        }
      }
    } catch (err) {
      console.warn('Network error during order creation, falling back to offline queue:', err)
    }

    // Offline Queue Fallback
    const offlineOrderNum = `OFF-${100 + (pendingCount || 0) + 1}`
    const offlineOrderPayload = {
      order_number: offlineOrderNum,
      receipt_ref: receiptRef,
      attendant_name: attendantName,
      total_amount: cart.totalAmount,
      status: 'waiting_for_payment',
      created_at: new Date().toISOString(),
      items: cart.items.map(i => ({
        product_id: i.id,
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.selling_price || i.price,
        cost_price: i.cost_price || i.cost || 0
      }))
    }

    if (queueOfflineOrder) queueOfflineOrder(offlineOrderPayload)
    setCompletedOrderNumber(offlineOrderNum)
    setIsOfflinePendingOrder(true)
    cart.clearCart()
    setSubmitting(false)
  }

  // Reset to new sale
  const handleStartNewSale = () => {
    setCompletedOrderNumber(null)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <AppShell
      activeTab="sell"
      onTabChange={(key) => {
        if (key === 'sell') handleStartNewSale()
      }}
      pageTitle="New Sale"
      role="attendant"
    >
      <div className="w-full max-w-4xl mx-auto min-w-0 overflow-x-hidden">
        {loadingProducts ? (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <SellingDesk
            products={products}
            cart={cart}
            onSendToCashier={handleSendToCashier}
            submitting={submitting}
            confirmedOrder={completedOrderNumber}
            isOfflineOrder={isOfflinePendingOrder}
            onStartNewSale={handleStartNewSale}
            attendantName={fullName || username}
            bottomPaddingClass="pb-20 lg:pb-4"
          />
        )}
      </div>
    </AppShell>
  )
}
