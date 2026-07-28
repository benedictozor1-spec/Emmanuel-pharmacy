import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../hooks/useCart'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import SyncStatusBadge from '../components/SyncStatusBadge'
import SellingDesk from '../components/SellingDesk'

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
    <div className="w-full min-h-dvh bg-[#1e40af] flex flex-col items-center justify-start relative pb-10">
      <div className="w-full max-w-5xl flex-1 flex flex-col">
        {/* Single Top Header */}
        <div className="px-5 sm:px-8 pt-6 pb-5 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white p-1 flex items-center justify-center overflow-hidden shadow-md shrink-0">
              <img
                src="/logo.jpg"
                alt="Emmanuel Pharmacy Logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <div className="hidden w-full h-full items-center justify-center text-[#1e40af] font-extrabold">EP</div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">New Sale</h1>
              <p className="text-xs text-white/80 font-medium">Emmanuel Pharmacy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusBadge />
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
                padding: '7px 16px', borderRadius: '12px', cursor: 'pointer',
                backdropFilter: 'blur(4px)', transition: 'all 0.2s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content Card: SellingDesk */}
        <div className="flex-1 bg-white rounded-t-[2.25rem] px-4 py-5 sm:p-8 shadow-2xl flex flex-col w-full min-h-[500px]">
          {loadingProducts ? (
            <div className="py-16 text-center text-neutral-400">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#1e40af] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold">Loading inventory...</p>
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
              bottomPaddingClass="pb-24 md:pb-6"
            />
          )}
        </div>
      </div>
    </div>
  )
}
