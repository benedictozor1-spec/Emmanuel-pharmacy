import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../hooks/useCart'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import SyncStatusBadge from '../components/SyncStatusBadge'

// Mock seed inventory as fallback if Supabase table hasn't been populated yet
const MOCK_PRODUCTS = [
  { id: '1', name: 'Paracetamol 500mg', brand: 'Emzor', unit: 'tab', selling_price: 50, stock_quantity: 240, expiry_date: '2027-08-31', low_stock_threshold: 15 },
  { id: '2', name: 'Amoxicillin 500mg', brand: 'Fidson', unit: 'cap', selling_price: 120, stock_quantity: 8, expiry_date: '2026-09-30', low_stock_threshold: 15 },
  { id: '3', name: 'Artemether / Lumefantrine', brand: 'Novartis · Coartem', unit: 'pack', selling_price: 1800, stock_quantity: 45, expiry_date: '2028-05-31', low_stock_threshold: 15 },
  { id: '4', name: 'Vitamin C 1000mg', brand: 'Emzor', unit: 'tab', selling_price: 30, stock_quantity: 500, expiry_date: '2027-11-30', low_stock_threshold: 15 },
  { id: '5', name: 'Metformin 500mg', brand: 'Swiss Pharma', unit: 'tab', selling_price: 80, stock_quantity: 15, expiry_date: '2026-12-31', low_stock_threshold: 15 },
  { id: '6', name: 'ORS Sachet', brand: 'Generic', unit: 'sachet', selling_price: 100, stock_quantity: 120, expiry_date: '2027-06-30', low_stock_threshold: 15 },
]

export default function AttendantPage() {
  const navigate = useNavigate()
  const { logout, user, fullName, username } = useAuth()
  const { isOnline, saveProductsToCache, getProductsFromCache, queueOfflineOrder, pendingCount } = useSync()
  const cart = useCart()

  // View state: 'sell' | 'cart' | 'confirmation'
  const [view, setView] = useState('sell')

  // Search & Products
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Order submission state
  const [submitting, setSubmitting] = useState(false)
  const [completedOrderNumber, setCompletedOrderNumber] = useState(null)
  const [isOfflinePendingOrder, setIsOfflinePendingOrder] = useState(false)

  // Fetch products from Supabase with local cache fallback
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
      } catch (e) {
        console.warn('Network unreachable, fetching local cached products')
      }

      // Offline or error fallback
      const cached = getProductsFromCache()
      if (cached && cached.length > 0) {
        setProducts(cached)
      } else {
        setProducts(MOCK_PRODUCTS)
      }
      setLoadingProducts(false)
    }
    loadProducts()
  }, [saveProductsToCache, getProductsFromCache])

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    )
  }, [products, searchQuery])

  // Format expiry date for card display (e.g. "Exp 08/27")
  const formatExp = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = String(d.getFullYear()).slice(2)
    return `Exp ${month}/${year}`
  }

  // Check if drug is near expiry (within 6 months)
  const isNearExpiry = (dateStr) => {
    if (!dateStr) return false
    const exp = new Date(dateStr)
    if (isNaN(exp.getTime())) return false
    const sixMonths = new Date()
    sixMonths.setMonth(sixMonths.getMonth() + 6)
    return exp <= sixMonths
  }

  // Handle Send to Cashier (Online or Offline Queue)
  const handleSendToCashier = async () => {
    if (cart.items.length === 0) return

    setSubmitting(true)
    setIsOfflinePendingOrder(false)

    let orderNum = Math.floor(Math.random() * 90) + 10 // Fallback number
    const receiptRef = 'EP-' + Date.now().toString().slice(-6)

    try {
      if (supabase && navigator.onLine) {
        // Get sequential order number from DB function
        const { data: numData, error: numError } = await supabase.rpc('get_next_order_number')
        if (!numError && numData) {
          orderNum = numData
        }

        // Insert order record live
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNum,
            receipt_ref: receiptRef,
            attendant_id: user?.id || null,
            attendant_name: fullName || username || 'Attendant',
            total_amount: cart.totalAmount,
            is_credit: false,
            customer_name: null,
            customer_phone: null,
            status: 'waiting_for_payment',
          })
          .select()
          .single()

        if (!orderErr && orderData) {
          // Insert order items live
          const itemsToInsert = cart.items.map((item) => ({
            order_id: orderData.id,
            product_id: item.id.length > 10 ? item.id : null,
            product_name: item.name,
            unit: item.unit || 'tab',
            unit_price: item.selling_price,
            quantity: item.quantity,
            total_price: item.selling_price * item.quantity,
          }))

          await supabase.from('order_items').insert(itemsToInsert)
          setCompletedOrderNumber(orderNum)
          cart.clearCart()
          setSubmitting(false)
          setView('confirmation')
          return
        }
      }
    } catch (err) {
      console.warn('⚠️ Network or server error during order insert, falling back to offline queue:', err)
    }

    // --- Offline Queue Fallback ---
    const offlineOrderNum = `OFF-${100 + pendingCount + 1}`
    const offlineOrderPayload = {
      order_number: offlineOrderNum,
      receipt_ref: receiptRef,
      attendant_name: fullName || username || 'Attendant',
      total_amount: cart.totalAmount,
      status: 'waiting_for_payment',
      created_at: new Date().toISOString(),
      items: cart.items.map(i => ({
        product_id: i.id,
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.selling_price,
        cost_price: i.cost_price || 0
      }))
    }

    queueOfflineOrder(offlineOrderPayload)
    setCompletedOrderNumber(offlineOrderNum)
    setIsOfflinePendingOrder(true)
    cart.clearCart()
    setSubmitting(false)
    setView('confirmation')
  }

  // Reset to new sale
  const handleStartNewSale = () => {
    setCompletedOrderNumber(null)
    setSearchQuery('')
    setView('sell')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // =============================================================
  // VIEW 3: ORDER SENT CONFIRMATION SCREEN
  // =============================================================
  if (view === 'confirmation') {
    return (
      <div className="w-full min-h-dvh bg-[#1E3D9D] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1E3D9D] text-white flex flex-col justify-between p-6 rounded-3xl min-h-[500px] shadow-2xl relative overflow-hidden">
          {/* Subtle background circles */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />

          {/* Top Bar */}
          <div className="flex justify-between items-center text-xs text-white/80 z-10">
            <span style={{ fontWeight: 700 }}>{fullName || username || 'Attendant'}</span>
            <div className="flex items-center gap-2">
              <SyncStatusBadge />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Center Info */}
          <div className="my-auto text-center flex flex-col items-center justify-center z-10 py-8">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 text-white shadow-lg border border-white/20">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <p className="text-[11px] font-black tracking-wider text-white/80 uppercase mb-2 bg-white/10 px-3 py-1 rounded-full border border-white/15">
              {isOfflinePendingOrder ? 'SAVED LOCALLY (OFFLINE)' : 'SENT TO CASHIER'}
            </p>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2">
              Order #{completedOrderNumber}
            </h1>

            {isOfflinePendingOrder ? (
              <div className="bg-[#D7263D]/20 border border-[#D7263D]/50 rounded-2xl p-3.5 max-w-xs mt-2 text-left backdrop-blur-md">
                <p className="text-xs font-bold text-white flex items-center gap-1">
                  <span>⚠️</span> PENDING SYNC TO DATABASE
                </p>
                <p className="text-[11px] text-white/90 mt-1">
                  Saved on device. Will automatically sync to cashier queue as soon as connection returns.
                </p>
              </div>
            ) : (
              <p className="text-xs font-medium text-white/80 max-w-xs mt-1">
                Customer can proceed to cashier desk to make payment.
              </p>
            )}
          </div>

          {/* Start New Sale Button */}
          <div className="z-10">
            <button
              onClick={handleStartNewSale}
              className="w-full h-12 bg-white text-[#1E3D9D] font-extrabold text-sm rounded-2xl shadow-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              id="start-new-sale-button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Start New Sale
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =============================================================
  // VIEW 2: CART SCREEN (Matches Cart screen mockup)
  // =============================================================
  if (view === 'cart') {
    return (
      <div className="w-full min-h-dvh bg-[#F7F4EE] sm:py-6 flex flex-col items-center justify-start font-sans">
        <div className="w-full max-w-md min-h-dvh sm:min-h-[680px] bg-[#1E3D9D] flex flex-col flex-1 shadow-2xl relative sm:rounded-[32px] overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('sell')}
                className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
                id="back-to-sell-button"
                title="Back to Sell screen"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Cart</h1>
                <p className="text-xs text-white/80 font-medium">{cart.totalItems} item{cart.totalItems === 1 ? '' : 's'}</p>
              </div>
            </div>
            <SyncStatusBadge />
          </div>

          {/* Main White Content Card */}
          <div className="flex-1 bg-white rounded-t-[32px] p-5 flex flex-col justify-between shadow-2xl w-full">
            {/* Cart Items List */}
            <div className="space-y-4 overflow-y-auto max-h-[calc(100dvh-220px)] pr-0.5">
              {cart.items.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 p-6">
                  <p className="text-sm font-bold text-neutral-700">Your cart is empty</p>
                  <p className="text-xs text-neutral-400 mt-1 mb-4">Select items from inventory to add to cart</p>
                  <button
                    onClick={() => setView('sell')}
                    className="px-4 py-2 bg-[#245DE2] text-white text-xs font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Add drugs to cart
                  </button>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div key={item.id} className="pb-4 border-b border-neutral-100 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-neutral-900 text-base leading-snug">{item.name}</h3>
                        <p className="text-xs text-neutral-400 font-medium mt-0.5">
                          {item.brand || 'Generic'} · ₦{item.selling_price.toLocaleString()} / {item.unit || 'tab'}
                        </p>
                      </div>
                      <button
                        onClick={() => cart.removeItem(item.id)}
                        className="text-neutral-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                        title="Remove item"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>

                    {/* Stepper & Line Total Row */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-neutral-200 rounded-xl px-2 py-1 bg-white shadow-xs gap-3">
                        <button
                          onClick={() => cart.updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 font-bold text-base hover:bg-neutral-200 active:scale-95 cursor-pointer transition-colors"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="font-black text-sm text-neutral-900 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => cart.updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 font-bold text-base hover:bg-neutral-200 active:scale-95 cursor-pointer transition-colors"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-black text-neutral-900 text-lg">
                        ₦{(item.selling_price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Total & Action Button */}
            {cart.items.length > 0 && (
              <div className="pt-4 border-t border-neutral-100 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-neutral-400 font-bold text-sm">Total</span>
                  <span className="text-2xl font-black text-neutral-900">
                    ₦{cart.totalAmount.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={handleSendToCashier}
                  disabled={submitting}
                  className="w-full h-13 bg-[#245DE2] text-white font-extrabold text-base rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                  id="send-to-cashier-button"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Send to Cashier
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =============================================================
  // VIEW 1: DRUG SEARCH & LIST SCREEN (Matches Sell screen mockup)
  // =============================================================
  return (
    <div className="w-full min-h-dvh bg-[#F7F4EE] sm:py-6 flex flex-col items-center justify-start font-sans">
      <div className="w-full max-w-md min-h-dvh sm:min-h-[680px] bg-[#1E3D9D] flex flex-col flex-1 shadow-2xl relative sm:rounded-[32px] overflow-hidden">
        {/* Deep Blue Header */}
        <div className="px-5 pt-6 pb-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">New Sale</h1>
              <p className="text-xs text-white/80 font-medium">Emmanuel Pharmacy</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SyncStatusBadge />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer transition-all"
              title="Sign Out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content Area (White Rounded Card) */}
        <div className="flex-1 bg-white rounded-t-[32px] p-5 shadow-2xl flex flex-col w-full overflow-hidden">
          {/* Search Bar & Barcode Scan Row */}
          <div className="flex items-center gap-3 mb-3">
            <button
              className="w-12 h-12 rounded-2xl bg-[#245DE2] hover:bg-blue-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
              title="Scan Barcode"
              id="scan-barcode-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="8" x2="7" y2="16" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="17" y1="8" x2="17" y2="16" />
              </svg>
            </button>

            <div className="flex-1 relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search drug name."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-[#F7F8FA] border border-neutral-200 rounded-2xl text-sm font-medium text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-[#245DE2] focus:ring-2 focus:ring-blue-500/20 transition-all pl-10 pr-4"
                id="search-drug-input"
              />
            </div>
          </div>

          {/* Results Header Info */}
          <div className="flex justify-between items-center my-2.5 px-1">
            <span className="text-[11px] font-extrabold tracking-wider text-neutral-400 uppercase">
              RESULTS
            </span>
            <span className="text-xs text-neutral-400 font-semibold">
              {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Drug List (with pb-28 to prevent fixed bottom cart bar overlap) */}
          <div className="space-y-3 overflow-y-auto flex-1 pr-0.5 pb-28 sm:pb-32">
            {loadingProducts ? (
              <div className="py-12 text-center text-neutral-400">
                <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#245DE2] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold">Loading inventory...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <p className="text-xs font-semibold">No drugs found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isLow = product.stock_quantity <= (product.low_stock_threshold || 15)
                const isNearExp = isNearExpiry(product.expiry_date)

                return (
                  <div
                    key={product.id}
                    className="p-4 rounded-2xl border border-neutral-100 bg-white shadow-xs hover:border-blue-200 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="font-bold text-neutral-900 text-base leading-snug truncate">
                        {product.name}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5 mb-1.5 truncate">
                        {product.brand || 'Generic'}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {/* Price Tag */}
                        <span className="font-black text-[#245DE2] text-sm whitespace-nowrap">
                          ₦{Number(product.selling_price).toLocaleString()} / {product.unit || 'tab'}
                        </span>

                        {/* Stock Quantity */}
                        <span className={isLow ? 'text-red-600 font-bold whitespace-nowrap' : 'text-neutral-500 font-medium whitespace-nowrap'}>
                          {product.stock_quantity} in stock
                        </span>

                        {/* Expiry Date */}
                        {product.expiry_date && (
                          <span className={isNearExp ? 'text-red-600 font-bold whitespace-nowrap' : 'text-neutral-400 font-medium whitespace-nowrap'}>
                            {formatExp(product.expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => cart.addItem(product)}
                      className="px-5 h-10 rounded-xl bg-[#245DE2] hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                      id={`add-drug-${product.id}`}
                      title={`Add ${product.name} to cart`}
                    >
                      Add
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Fixed Translucent/Gradient Cart Bar (Bottom) */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-md w-[calc(100%-2rem)] z-40">
          <div className="bg-[#1E3D9D] border border-white/20 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
            <div className="flex items-center gap-3 pl-1">
              <div className="relative">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {cart.totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#1E3D9D]">
                    {cart.totalItems}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-white/80">
                  {cart.totalItems === 0 ? 'Cart empty' : `${cart.totalItems} item${cart.totalItems === 1 ? '' : 's'}`}
                </p>
                {cart.totalAmount > 0 && (
                  <p className="text-base font-black text-white leading-tight">
                    ₦{cart.totalAmount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setView('cart')}
              disabled={cart.totalItems === 0}
              className="h-9 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
              id="view-cart-button"
            >
              View cart
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
