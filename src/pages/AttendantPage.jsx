import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../hooks/useCart'
import { supabase } from '../lib/supabase'

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
  const cart = useCart()

  // View state: 'sell' | 'cart' | 'confirmation'
  const [view, setView] = useState('sell')

  // Search & Products
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Order submission state
  const [submitting, setSubmitting] = useState(false)
  const [completedOrderNumber, setCompletedOrderNumber] = useState(null)

  // Fetch products from Supabase
  useEffect(() => {
    async function loadProducts() {
      if (!supabase) return
      setLoadingProducts(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name')
        if (!error && data && data.length > 0) {
          setProducts(data)
        }
      } catch (e) {
        console.warn('Using fallback mock inventory')
      } finally {
        setLoadingProducts(false)
      }
    }
    loadProducts()
  }, [])

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
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = String(d.getFullYear()).slice(2)
    return `Exp ${month}/${year}`
  }

  // Check if drug is near expiry (within 6 months)
  const isNearExpiry = (dateStr) => {
    if (!dateStr) return false
    const exp = new Date(dateStr)
    const sixMonths = new Date()
    sixMonths.setMonth(sixMonths.getMonth() + 6)
    return exp <= sixMonths
  }

  // Handle Send to Cashier
  const handleSendToCashier = async () => {
    if (cart.items.length === 0) return

    setSubmitting(true)

    let orderNum = Math.floor(Math.random() * 90) + 10 // Fallback number

    try {
      if (supabase) {
        // Get sequential order number from DB function
        const { data: numData, error: numError } = await supabase.rpc('get_next_order_number')
        if (!numError && numData) {
          orderNum = numData
        }

        // Insert order record
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNum,
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
          // Insert order items
          const itemsToInsert = cart.items.map((item) => ({
            order_id: orderData.id,
            product_id: item.id.length > 10 ? item.id : null,
            product_name: item.name,
            unit: item.unit,
            unit_price: item.selling_price,
            quantity: item.quantity,
            total_price: item.selling_price * item.quantity,
          }))

          await supabase.from('order_items').insert(itemsToInsert)
        }
      }
    } catch (err) {
      console.error('Order creation error:', err)
    } finally {
      setSubmitting(false)
      setCompletedOrderNumber(orderNum)
      cart.clearCart()
      setView('confirmation')
    }
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

  // -------------------------------------------------------------
  // VIEW 3: ORDER SENT CONFIRMATION SCREEN (Order number-selection.png)
  // -------------------------------------------------------------
  if (view === 'confirmation') {
    return (
      <div className="min-h-dvh bg-[#1e40af] text-white flex flex-col justify-between p-6 relative overflow-hidden animate-fade-in">
        {/* Subtle background circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />

        {/* Top bar info */}
        <div className="flex justify-between items-center text-xs text-white/80 pt-2">
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{fullName || username} (Attendant)</span>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
            padding: '6px 14px', borderRadius: '10px', cursor: 'pointer',
            backdropFilter: 'blur(4px)', transition: 'all 0.2s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>

        {/* Center Content */}
        <div className="my-auto text-center flex flex-col items-center justify-center animate-slide-up">
          {/* Checkmark icon */}
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 text-white shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <p className="text-xs font-bold tracking-widest text-white/80 uppercase mb-2">
            SENT TO CASHIER
          </p>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight mb-2">
            Order #{completedOrderNumber}
          </h1>

          <p className="text-sm text-white/70 max-w-xs mt-2">
            Customer can proceed to cashier desk to make payment.
          </p>
        </div>

        {/* Bottom Action Button */}
        <div className="pb-4">
          <button
            onClick={handleStartNewSale}
            className="w-full h-14 bg-white text-[#1e40af] font-bold text-base rounded-2xl shadow-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 active:scale-95"
            id="start-new-sale-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Sale
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW 2: CART SCREEN (cart interface-selection.png)
  // -------------------------------------------------------------
  if (view === 'cart') {
    return (
      <div className="min-h-dvh bg-[#1e40af] flex flex-col">
        {/* Dark Blue Header */}
        <div className="px-5 pt-8 pb-6 text-white flex items-center gap-4">
          <button
            onClick={() => setView('sell')}
            className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all"
            id="back-to-sell-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cart</h1>
            <p className="text-xs text-white/70">{cart.totalItems} items</p>
          </div>
        </div>

        {/* Main White Content Card */}
        <div className="flex-1 bg-white rounded-t-3xl p-5 flex flex-col justify-between shadow-2xl">
          {/* Cart Items List */}
          <div className="space-y-4 overflow-y-auto max-h-[calc(100dvh-280px)]">
            {cart.items.length === 0 ? (
              <div className="py-12 text-center text-neutral-400">
                <p>Your cart is empty</p>
                <button
                  onClick={() => setView('sell')}
                  className="mt-3 text-sm text-[#1e40af] font-semibold underline"
                >
                  Add drugs to cart
                </button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.id} className="pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-neutral-900 text-base leading-snug">{item.name}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {item.brand} · ₦{item.selling_price.toLocaleString()} / {item.unit}
                    </p>

                    {/* Stepper controls */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-neutral-200 rounded-xl px-2 py-1 bg-neutral-50 gap-3">
                        <button
                          onClick={() => cart.updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-700 font-bold text-lg hover:bg-neutral-100 active:scale-95"
                        >
                          -
                        </button>
                        <span className="font-bold text-sm text-neutral-900 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => cart.updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-700 font-bold text-lg hover:bg-neutral-100 active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between h-full space-y-3">
                    <button
                      onClick={() => cart.removeItem(item.id)}
                      className="text-neutral-400 hover:text-red-500 p-1 transition-colors"
                      title="Remove item"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                    <span className="font-extrabold text-neutral-900 text-lg">
                      ₦{(item.selling_price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Total & Action Button */}
          {cart.items.length > 0 && (
            <div className="pt-4 border-t border-neutral-100 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-medium text-sm">Total</span>
                <span className="text-2xl font-black text-neutral-900">
                  ₦{cart.totalAmount.toLocaleString()}
                </span>
              </div>

              <button
                onClick={handleSendToCashier}
                disabled={submitting}
                className="w-full h-14 bg-[#1e40af] text-white font-bold text-base rounded-2xl shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
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
    )
  }

  // -------------------------------------------------------------
  // VIEW 1: DRUG SEARCH & LIST SCREEN (attendant-sell-screen.png)
  // -------------------------------------------------------------
  return (
    <div className="min-h-dvh bg-[#1e40af] flex flex-col relative pb-24">
      {/* Top Header */}
      <div className="px-5 pt-8 pb-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white p-0.5 flex items-center justify-center overflow-hidden shadow-sm">
            <img
              src="/logo.jpg"
              alt="Emmanuel Pharmacy Logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <div className="hidden w-full h-full items-center justify-center text-[#1e40af]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">New Sale</h1>
            <p className="text-xs text-white/70">Emmanuel Pharmacy</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
            padding: '6px 14px', borderRadius: '10px', cursor: 'pointer',
            backdropFilter: 'blur(4px)', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Main Content Area (White Rounded Card) */}
      <div className="flex-1 bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col">
        {/* Search Bar & Barcode Scan */}
        <div className="flex items-center gap-3 mb-5">
          <button
            className="w-12 h-12 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-all shrink-0"
            title="Scan Barcode"
            id="scan-barcode-button"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              width="18"
              height="18"
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
              placeholder="Search drug name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-neutral-100 border border-transparent rounded-2xl text-sm font-medium text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-[#2563eb] transition-all"
              style={{ paddingLeft: '46px', paddingRight: '16px' }}
              id="search-drug-input"
            />
          </div>
        </div>

        {/* Header Results Info */}
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            RESULTS
          </span>
          <span className="text-xs text-neutral-400 font-medium">
            {filteredProducts.length} products
          </span>
        </div>

        {/* Drug List */}
        <div className="space-y-3 overflow-y-auto flex-1">
          {loadingProducts ? (
            <div className="py-10 text-center text-neutral-400">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#1e40af] rounded-full animate-spin mx-auto mb-2" />
              Loading inventory...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <p>No drugs found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isLow = product.stock_quantity <= (product.low_stock_threshold || 15)
              const isNearExp = isNearExpiry(product.expiry_date)

              return (
                <div
                  key={product.id}
                  className="py-3.5 pl-4 pr-6 rounded-2xl border border-neutral-100 bg-white shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-3 overflow-hidden"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-neutral-900 text-base leading-snug truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mb-1.5 truncate">
                      {product.brand || 'Generic'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {/* Price Badge */}
                      <span className="font-extrabold text-[#1d4ed8] text-sm whitespace-nowrap">
                        ₦{Number(product.selling_price).toLocaleString()} / {product.unit || 'tab'}
                      </span>

                      {/* Stock Badge */}
                      <span className={isLow ? 'text-red-600 font-semibold whitespace-nowrap' : 'text-neutral-500 whitespace-nowrap'}>
                        {product.stock_quantity} in stock
                      </span>

                      {/* Expiry Badge */}
                      {product.expiry_date && (
                        <span className={isNearExp ? 'text-red-600 font-semibold whitespace-nowrap' : 'text-neutral-500 whitespace-nowrap'}>
                          {formatExp(product.expiry_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => cart.addItem(product)}
                    className="px-4 h-9 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer mr-3"
                    id={`add-drug-${product.id}`}
                    title={`Add ${product.name} to cart`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Floating Translucent Cart Bar (Bottom) */}
      <div className="fixed bottom-4 left-4 right-4 z-40">
        <div className="bg-[#1e40af]/90 backdrop-blur-md border border-white/20 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3 pl-1">
            <div className="relative">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {cart.totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.totalItems}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">
                {cart.totalItems === 0 ? 'Cart empty' : `${cart.totalItems} items`}
              </p>
              {cart.totalAmount > 0 && (
                <p className="text-sm font-extrabold text-white">
                  ₦{cart.totalAmount.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setView('cart')}
            disabled={cart.totalItems === 0}
            className="h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none"
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
  )
}
