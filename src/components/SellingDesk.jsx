import { useState, useMemo, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import Money, { formatMoney } from './ui/money'
import { cn } from '../lib/utils'
import {
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  Loader2,
  PackageOpen,
} from 'lucide-react'

export default function SellingDesk({
  products = [],
  cart,
  onSendToCashier,
  submitting = false,
  confirmedOrder = null,
  isOfflineOrder = false,
  onStartNewSale,
  attendantName = '',
  bottomPaddingClass = 'pb-20 lg:pb-4'
}) {
  const [view, setView] = useState('sell')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [displayLimit, setDisplayLimit] = useState(50)

  useEffect(() => {
    if (confirmedOrder) setView('confirmation')
  }, [confirmedOrder])

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

  // Barcode auto-scan
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

  const categories = ['all', 'Analgesic', 'Antibiotic', 'Antimalarial', 'Supplement', 'Antidiabetic', 'Rehydration']

  /* ─── VIEW: CONFIRMATION ─── */
  if (view === 'confirmation') {
    return (
      <Card className="w-full border-0 shadow-xl bg-[#1F45B8] text-white rounded-2xl overflow-hidden">
        <CardContent className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[420px]">
          <div className="my-auto py-8 text-center flex flex-col items-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-5 shadow-xl border border-white/20">
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </div>

            <Badge variant="outline" className="border-white/30 bg-white/10 text-white text-[10px] font-bold tracking-widest uppercase mb-3">
              {isOfflineOrder ? 'Saved locally (offline)' : 'Sent to cashier queue'}
            </Badge>

            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3 tabular-nums">
              Order #{confirmedOrder}
            </h1>

            <p className="text-sm text-white/80 max-w-xs mt-2 leading-relaxed">
              Customer can proceed to cashier desk to make payment.
              {attendantName && (
                <span className="block mt-1.5 text-xs text-white/70">Recorded under <strong>{attendantName}</strong></span>
              )}
            </p>
          </div>

          <div className="w-full max-w-md pt-4">
            <Button
              onClick={handleResetSale}
              variant="secondary"
              size="xl"
              className="w-full bg-white text-[#1F45B8] hover:bg-white/90 font-bold"
              id="selling-desk-new-sale-button"
            >
              <Plus className="h-5 w-5" />
              Start New Sale
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ─── VIEW: CART ─── */
  if (view === 'cart') {
    return (
      <Card className="w-full rounded-2xl border shadow-xs">
        <CardContent className="p-4 sm:p-6 flex flex-col min-h-[460px]">
          {/* Cart header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon-sm" onClick={() => setView('sell')} id="selling-desk-back-button" aria-label="Back to products">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-base font-semibold text-foreground">Cart overview</h2>
                <p className="text-xs text-muted-foreground">{cart.totalItems} item{cart.totalItems === 1 ? '' : 's'}</p>
              </div>
            </div>
            {cart.totalItems > 0 && (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => cart.clearCart()}>
                Clear cart
              </Button>
            )}
          </div>

          {/* Cart items */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100dvh-340px)] flex-1 custom-scroll">
            {cart.items.length === 0 ? (
              <div className="py-16 text-center border border-dashed rounded-xl p-6">
                <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Scan or search to add items</p>
                <Button variant="outline" size="sm" onClick={() => setView('sell')}>
                  Add items
                </Button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.id} className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.brand || 'Generic'} · <Money amount={item.selling_price || item.price || 0} className="text-foreground font-medium" /> / {item.unit || 'tab'}
                    </p>

                    {/* Qty stepper */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <Button variant="outline" size="icon-sm" onClick={() => cart.updateQuantity(item.id, -1)} aria-label="Decrease quantity">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-semibold text-xs text-foreground min-w-[24px] text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <Button variant="outline" size="icon-sm" onClick={() => cart.updateQuantity(item.id, 1)} aria-label="Increase quantity">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch gap-2">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-red-600" onClick={() => cart.removeItem(item.id)} aria-label="Remove item">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Money amount={(item.selling_price || item.price || 0) * item.quantity} className="font-semibold text-sm text-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total + send */}
          {cart.items.length > 0 && (
            <div className="pt-4 border-t mt-3 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground">Total amount</span>
                <Money amount={cart.totalAmount} className="text-xl font-semibold text-foreground" />
              </div>

              <Button
                onClick={onSendToCashier}
                disabled={submitting}
                size="xl"
                className="w-full"
                id="selling-desk-send-cashier-button"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send to Cashier
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  /* ─── VIEW: PRODUCT LIST ─── */
  return (
    <div className={cn('w-full flex flex-col lg:flex-row gap-6 min-w-0 overflow-x-hidden', bottomPaddingClass)}>
      {/* LEFT PANE: Search + Categories + Products List */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Sticky search bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search drug name, brand or scan barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-10 text-sm rounded-lg border-input bg-card shadow-2xs"
              id="selling-desk-search-input"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0 h-11 w-11 rounded-lg border-input shadow-2xs"
            onClick={() => {
              const el = document.getElementById('selling-desk-search-input')
              if (el) el.focus()
            }}
            aria-label="Scan barcode"
          >
            <ScanBarcode className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Category chips */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto scrollbar-none py-1 px-1 -mx-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'rounded-full border px-3 h-8 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0',
                  categoryFilter === cat
                    ? 'bg-brand-700 text-white border-brand-700 shadow-2xs'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {cat === 'all' ? 'All categories' : cat}
              </button>
            ))}
          </div>
          {/* Edge fade */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>

        {/* Result count */}
        <div className="flex justify-end px-1">
          <span className="text-[13px] text-muted-foreground">
            {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Product list */}
        <div className="overflow-y-auto max-h-[calc(100dvh-320px)] lg:max-h-[calc(100dvh-220px)] custom-scroll rounded-xl border border-border bg-card divide-y divide-border shadow-2xs">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center p-6">
              <PackageOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium text-foreground">No sellable products found</p>
              <p className="text-[13px] text-muted-foreground mt-1">Products with stock 0 or price ₦0 are hidden.</p>
            </div>
          ) : (
            <>
              {visibleProducts.map(product => {
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
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 h-16 hover:bg-muted/50 transition-colors border-b last:border-b-0 min-w-0"
                  >
                    {/* Col 1: Name + Meta */}
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-foreground truncate" title={product.name}>{product.name}</p>
                      <p className="text-[13px] text-muted-foreground truncate">
                        {product.brand || 'Generic'} {product.category && product.category !== 'General' ? `· ${product.category}` : ''} {expLabel ? `· ${expLabel}` : ''}
                      </p>
                    </div>

                    {/* Col 2: Price */}
                    <div className="text-right shrink-0 px-2">
                      <Money amount={price} className="text-sm font-medium text-foreground" />
                    </div>

                    {/* Col 3: Stock Badge */}
                    <div className="shrink-0 px-1 hidden sm:block">
                      <Badge
                        variant={stock === 0 ? 'destructive' : isLow ? 'warning' : 'outline'}
                        className={cn(
                          'text-xs font-normal border',
                          stock > 0 && !isLow && 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
                          isLow && 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10',
                          stock === 0 && 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10'
                        )}
                      >
                        {stock === 0 ? 'Out of stock' : `${stock} in stock`}
                      </Badge>
                    </div>

                    {/* Col 4: Add Button */}
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        onClick={() => cart.addItem({
                          id: product.id,
                          name: product.name,
                          brand: product.brand,
                          unit: unit,
                          selling_price: price,
                          cost_price: product.cost_price || product.cost || 0
                        })}
                        id={`selling-desk-add-${product.id}`}
                        className="bg-brand-700 hover:bg-brand-800 text-white font-medium shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )
              })}

              {filteredProducts.length > visibleProducts.length && (
                <div className="py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setDisplayLimit(prev => prev + 50)} className="text-[13px] text-muted-foreground">
                    Load more ({visibleProducts.length} of {filteredProducts.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANE: DESKTOP PERSISTENT CART (380px) */}
      <div className="hidden lg:flex w-[380px] shrink-0 flex-col rounded-xl border border-border bg-card shadow-2xs min-h-[500px]">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Cart</h2>
            <p className="text-[13px] text-muted-foreground">{cart.totalItems} item{cart.totalItems === 1 ? '' : 's'}</p>
          </div>
          {cart.totalItems > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => cart.clearCart()}>
              Clear cart
            </Button>
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scroll max-h-[calc(100dvh-340px)]">
          {cart.items.length === 0 ? (
            <div className="py-20 text-center border border-dashed rounded-lg p-6">
              <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium text-foreground">Cart is empty</p>
              <p className="text-[13px] text-muted-foreground mt-1">Scan or search to add items</p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex items-start justify-between gap-3 shadow-2xs">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground truncate" title={item.name}>{item.name}</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {item.brand || 'Generic'} · <Money amount={item.selling_price || item.price || 0} className="text-foreground font-medium" /> / {item.unit || 'tab'}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="icon-sm" onClick={() => cart.updateQuantity(item.id, -1)} aria-label="Decrease quantity" className="h-7 w-7">
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="font-semibold text-xs text-foreground min-w-[24px] text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <Button variant="outline" size="icon-sm" onClick={() => cart.updateQuantity(item.id, 1)} aria-label="Increase quantity" className="h-7 w-7">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch gap-2">
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-red-600 h-6 w-6" onClick={() => cart.removeItem(item.id)} aria-label="Remove item">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Money amount={(item.selling_price || item.price || 0) * item.quantity} className="font-semibold text-sm text-foreground" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer subtotal + Send button */}
        {cart.items.length > 0 && (
          <div className="p-4 border-t space-y-3 bg-muted/20 rounded-b-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total amount</span>
              <Money amount={cart.totalAmount} className="text-xl font-semibold text-foreground" />
            </div>

            <Button
              onClick={onSendToCashier}
              disabled={submitting}
              size="lg"
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-medium shadow-2xs"
              id="selling-desk-send-cashier-button-desktop"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Send to Cashier
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* MOBILE STICKY CART BAR (<1024px) */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
        <Card className="w-full max-w-xl border border-border bg-card/95 backdrop-blur-md shadow-lg pointer-events-auto rounded-xl">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                {cart.totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.totalItems}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {cart.totalItems === 0 ? 'Cart empty' : `${cart.totalItems} item${cart.totalItems === 1 ? '' : 's'}`}
                </p>
                {cart.totalAmount > 0 && (
                  <Money amount={cart.totalAmount} className="text-sm font-semibold text-foreground" />
                )}
              </div>
            </div>

            <Button
              onClick={() => setView('cart')}
              disabled={cart.totalItems === 0}
              size="sm"
              className="bg-brand-700 hover:bg-brand-800 text-white font-medium"
              id="selling-desk-view-cart-button"
            >
              View cart
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
