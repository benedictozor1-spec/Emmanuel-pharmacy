import { useState, useMemo, useEffect } from 'react'

export default function SellingDesk({
  products = [],
  cart,
  onSendToCashier,
  submitting = false,
  confirmedOrder = null,
  isOfflineOrder = false,
  onStartNewSale,
  attendantName = '',
  bottomPaddingClass = 'pb-32 md:pb-8'
}) {
  const [view, setView] = useState('sell') // 'sell' | 'cart' | 'confirmation'
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [displayLimit, setDisplayLimit] = useState(50)

  // Switch to confirmation view when confirmedOrder is set
  useEffect(() => {
    if (confirmedOrder) {
      setView('confirmation')
    }
  }, [confirmedOrder])

  // Reset display limit when query or category filter changes
  useEffect(() => {
    setDisplayLimit(50)
  }, [searchQuery, categoryFilter])

  // Only products with stock > 0 AND price > 0 are sellable
  const sellableProducts = useMemo(() => {
    return (products || []).filter(p => {
      if (!p) return false
      const stock = p.stock_quantity !== undefined ? p.stock_quantity : (p.stock || 0)
      const price = p.selling_price !== undefined ? p.selling_price : (p.price || 0)
      return stock > 0 && price > 0
    })
  }, [products])

  // Barcode auto-scan matching (only within sellable products)
  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      const matched = sellableProducts.find(p => p.barcode && p.barcode === q)
      if (matched) {
        cart.addItem({
          id: matched.id,
          name: matched.name,
          brand: matched.brand,
          unit: matched.unit || matched.unitChain || 'tab',
          selling_price: matched.selling_price || matched.price || 0,
          cost_price: matched.cost_price || matched.cost || 0
        })
        setSearchQuery('')
      }
    }
  }, [searchQuery, sellableProducts, cart])

  const filteredProducts = useMemo(() => {
    let list = sellableProducts
    if (categoryFilter && categoryFilter !== 'all') {
      list = list.filter(p => (p.category || '').toLowerCase() === categoryFilter.toLowerCase())
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(
      p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
    )
  }, [sellableProducts, searchQuery, categoryFilter])

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit)
  }, [filteredProducts, displayLimit])

  const handleResetSale = () => {
    setView('sell')
    setSearchQuery('')
    if (onStartNewSale) onStartNewSale()
  }

  // -------------------------------------------------------------
  // VIEW 3: ORDER SENT CONFIRMATION
  // -------------------------------------------------------------
  if (view === 'confirmation') {
    return (
      <div className="w-full bg-[#1e40af] text-white rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-between min-h-[420px] shadow-xl animate-fade-in my-2">
        <div className="my-auto py-8 text-center flex flex-col items-center justify-center animate-slide-up max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-5 text-white shadow-xl border border-white/20">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <p className="text-xs font-black tracking-widest text-white/80 uppercase mb-3 bg-white/10 px-4 py-1.5 rounded-full border border-white/15">
            {isOfflineOrder ? 'SAVED LOCALLY (OFFLINE)' : 'SENT TO CASHIER QUEUE'}
          </p>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
            Order #{confirmedOrder}
          </h1>

          <p className="text-sm font-medium text-white/80 max-w-xs mt-2 leading-relaxed">
            Customer can proceed to cashier desk to make payment.
            {attendantName && (
              <span className="block mt-1.5 text-xs text-white/70">Recorded under <strong>{attendantName}</strong></span>
            )}
          </p>
        </div>

        <div className="w-full max-w-md pt-4">
          <button
            onClick={handleResetSale}
            className="w-full h-14 bg-white text-[#1e40af] font-extrabold text-base rounded-2xl shadow-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer"
            id="selling-desk-new-sale-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Start New Sale
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW 2: CART OVERVIEW
  // -------------------------------------------------------------
  if (view === 'cart') {
    return (
      <div className="w-full bg-white rounded-3xl p-4 sm:p-6 shadow-xl border border-neutral-200/80 flex flex-col justify-between min-h-[460px] animate-fade-in my-2">
        {/* Top Cart Navigation Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('sell')}
              className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-800 transition-all cursor-pointer shrink-0"
              id="selling-desk-back-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 leading-tight">Cart Overview</h2>
              <p className="text-xs text-neutral-500 font-medium">{cart.totalItems} item{cart.totalItems === 1 ? '' : 's'} selected</p>
            </div>
          </div>
          {cart.totalItems > 0 && (
            <button
              onClick={() => cart.clearCart()}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Item Cards */}
        <div className="space-y-3 overflow-y-auto max-h-[calc(100dvh-340px)] pr-1 flex-1">
          {cart.items.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 bg-neutral-50/60 rounded-2xl border border-dashed border-neutral-200 p-6">
              <p className="text-base font-semibold text-neutral-700">Your cart is currently empty</p>
              <p className="text-xs text-neutral-400 mt-1 mb-4">Select medicines from inventory to start sale</p>
              <button
                onClick={() => setView('sell')}
                className="px-5 py-2.5 bg-[#1e40af] text-white text-xs font-bold rounded-xl shadow-md hover:bg-blue-800 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                Add drugs to cart
              </button>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 flex items-start justify-between gap-3 hover:border-blue-200 transition-all">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-900 text-sm sm:text-base leading-snug truncate">{item.name}</h3>
                  <p className="text-xs font-medium text-neutral-500 mt-0.5">
                    {item.brand || 'Generic'} · <span className="font-bold text-[#1d4ed8]">₦{(item.selling_price || item.price || 0).toLocaleString()}</span> / {item.unit || 'tab'}
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center border border-neutral-200 rounded-xl px-2 py-1 bg-white shadow-sm gap-2.5">
                      <button
                        onClick={() => cart.updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 font-extrabold text-base hover:bg-neutral-200 active:scale-95 cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <span className="font-black text-sm text-neutral-900 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => cart.updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 font-extrabold text-base hover:bg-neutral-200 active:scale-95 cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch">
                  <button
                    onClick={() => cart.removeItem(item.id)}
                    className="text-neutral-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                  <span className="font-black text-neutral-900 text-base sm:text-lg">
                    ₦{((item.selling_price || item.price || 0) * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total Footer & Send to Cashier */}
        {cart.items.length > 0 && (
          <div className="pt-4 border-t border-neutral-200/80 mt-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-neutral-500 font-bold text-xs sm:text-sm uppercase tracking-wider">Total Amount</span>
              <span className="text-xl sm:text-2xl font-black text-neutral-900">
                ₦{cart.totalAmount.toLocaleString()}
              </span>
            </div>

            <button
              onClick={onSendToCashier}
              disabled={submitting}
              className="w-full h-13 sm:h-14 bg-[#1e40af] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              id="selling-desk-send-cashier-button"
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
    )
  }

  // -------------------------------------------------------------
  // VIEW 1: PRODUCT LIST & SEARCH
  // -------------------------------------------------------------
  return (
    <div className={`w-full flex flex-col gap-4 relative ${bottomPaddingClass}`}>
      {/* Search Bar & Barcode Scanner */}
      <div className="flex items-center gap-2.5">
        <button
          className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#2563eb] text-white flex items-center justify-center shadow-md hover:bg-blue-700 active:scale-95 transition-all shrink-0 cursor-pointer"
          title="Scan Barcode"
          onClick={() => {
            const el = document.getElementById('selling-desk-search-input')
            if (el) el.focus()
          }}
          style={{ width: '48px', height: '48px' }}
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
            placeholder="Search drug name or scan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 sm:h-13 bg-neutral-100/90 border border-neutral-200/60 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={{ paddingLeft: '44px', paddingRight: '14px' }}
            id="selling-desk-search-input"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
        {['all', 'Analgesic', 'Antibiotic', 'Antimalarial', 'Supplement', 'Antidiabetic', 'Rehydration'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === cat
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'bg-white text-neutral-700 border border-neutral-200/80 hover:bg-neutral-50'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Results Subtitle Bar */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] font-extrabold tracking-wider text-neutral-400 uppercase">
          RESULTS
        </span>
        <span className="text-xs text-neutral-400 font-semibold">
          {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-3 overflow-y-auto max-h-[calc(100dvh-320px)] sm:max-h-[520px] pr-0.5">
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 bg-white rounded-2xl border border-dashed border-neutral-200 p-6">
            <p className="text-sm font-medium text-neutral-700">No sellable drugs found matching "{searchQuery}"</p>
            <p className="text-xs text-neutral-400 mt-1">Note: Products with stock 0 or price ₦0 are hidden from sales.</p>
          </div>
        ) : (
          <>
            {visibleProducts.map((product) => {
              const stock = product.stock_quantity !== undefined ? product.stock_quantity : product.stock || 0
              const lowLevel = product.low_stock_threshold || product.lowLevel || 15
              const isLow = stock <= lowLevel
              const price = product.selling_price || product.price || 0
              const unit = product.unit || product.unitChain || 'tab'
              const exp = product.expiry_date || product.expiry
              const expDate = exp ? new Date(exp) : null
              const expLabel = expDate ? `Exp ${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getFullYear()).slice(2)}` : ''

              return (
                <div
                  key={product.id}
                  className="p-3.5 sm:p-4 rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-sm sm:text-base leading-snug truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5 mb-1.5 truncate">
                      {product.brand || 'Generic'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-black text-[#1d4ed8] text-xs sm:text-sm whitespace-nowrap">
                        ₦{Number(price).toLocaleString()} / {unit}
                      </span>
                      <span className={isLow ? 'bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-md border border-red-100 text-[11px] whitespace-nowrap' : 'text-neutral-500 font-medium whitespace-nowrap'}>
                        {stock} in stock
                      </span>
                      {expLabel && (
                        <span className="text-neutral-400 font-medium text-[11px] whitespace-nowrap">
                          {expLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => cart.addItem({
                      id: product.id,
                      name: product.name,
                      brand: product.brand,
                      unit: unit,
                      selling_price: price,
                      cost_price: product.cost_price || product.cost || 0
                    })}
                    className="px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs sm:text-sm flex items-center gap-1 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
                    id={`selling-desk-add-${product.id}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              )
            })}

            {filteredProducts.length > visibleProducts.length && (
              <div className="py-3 text-center">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm border border-neutral-200"
                >
                  Load More Products (Showing {visibleProducts.length} of {filteredProducts.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Translucent Cart Bar */}
      <div className="fixed bottom-16 md:bottom-6 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-xl bg-[#1e40af]/95 backdrop-blur-md border border-white/20 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto animate-slide-up">
          <div className="flex items-center gap-3 pl-1">
            <div className="relative">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {cart.totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#1e40af]">
                  {cart.totalItems}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">
                {cart.totalItems === 0 ? 'Cart empty' : `${cart.totalItems} item${cart.totalItems === 1 ? '' : 's'}`}
              </p>
              {cart.totalAmount > 0 && (
                <p className="text-sm sm:text-base font-black text-white leading-tight">
                  ₦{cart.totalAmount.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setView('cart')}
            disabled={cart.totalItems === 0}
            className="h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            id="selling-desk-view-cart-button"
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
