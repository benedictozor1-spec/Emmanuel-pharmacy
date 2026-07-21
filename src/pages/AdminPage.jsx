import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/* =================================================================
   SAMPLE NIGERIAN DATA (Matching Reference Images 1-5 Exactly)
   ================================================================= */
const INITIAL_ATTENDANTS_LEADERBOARD = [
  { id: 'att-1', name: 'Chidinma', sales_count: 34, sales_value: 128400, rank: 1 },
  { id: 'att-2', name: 'Emeka', sales_count: 29, sales_value: 104750, rank: 2 },
  { id: 'att-3', name: 'Ngozi', sales_count: 25, sales_value: 88200, rank: 3 },
  { id: 'att-4', name: 'Ifeoma', sales_count: 21, sales_value: 71900, rank: 4 },
]

const INITIAL_CREDIT_DEBTORS = [
  { id: 'deb-1', customer_name: 'Mrs. Okafor', customer_phone: '08031234567', amount: 12400, date: 'Today, 2:14 PM' },
  { id: 'deb-2', customer_name: 'Chief Paul', customer_phone: '08033445566', amount: 47400, date: 'Today, 11:30 AM' },
  { id: 'deb-3', customer_name: 'Alhaji Musa', customer_phone: '08055667788', amount: 65000, date: 'Yesterday' },
  { id: 'deb-4', customer_name: 'Dr. Benson', customer_phone: '08022334455', amount: 39500, date: '18 Jul 2026' },
]

const INITIAL_PRODUCTS = [
  { id: 'p-1', name: 'Paracetamol 500mg', category: 'Analgesic', selling_price: 50, stock_left: 240, expiry: 'Aug 2027', is_low_stock: false, is_near_expiry: false, cost_price: 35, barcode: '6009876543210' },
  { id: 'p-2', name: 'Amoxicillin 500mg', category: 'Antibiotic', selling_price: 120, stock_left: 8, expiry: 'Sept 2026', is_low_stock: true, is_near_expiry: true, cost_price: 85, barcode: '6001112223334' },
  { id: 'p-3', name: 'Coartem (AL) 20/120mg', category: 'Antimalarial', selling_price: 1800, stock_left: 45, expiry: 'May 2028', is_low_stock: false, is_near_expiry: false, cost_price: 1350, barcode: '6001234567890' },
  { id: 'p-4', name: 'Vitamin C 1000mg', category: 'Supplement', selling_price: 30, stock_left: 500, expiry: 'Nov 2027', is_low_stock: false, is_near_expiry: false, cost_price: 20, barcode: '6007778889990' },
  { id: 'p-5', name: 'Metformin 500mg', category: 'Antidiabetic', selling_price: 80, stock_left: 15, expiry: 'Dec 2026', is_low_stock: true, is_near_expiry: false, cost_price: 55, barcode: '6004443332221' },
  { id: 'p-6', name: 'ORS Sachet', category: 'Rehydration', selling_price: 150, stock_left: 120, expiry: 'Aug 2026', is_low_stock: false, is_near_expiry: true, cost_price: 100, barcode: '6005554443322' },
  { id: 'p-7', name: 'Ciprofloxacin 500mg', category: 'Antibiotic', selling_price: 200, stock_left: 60, expiry: 'Jan 2029', is_low_stock: false, is_near_expiry: false, cost_price: 140, barcode: '6008887776655' },
  { id: 'p-8', name: 'Ibuprofen 400mg', category: 'Analgesic', selling_price: 45, stock_left: 3, expiry: 'Jul 2027', is_low_stock: true, is_near_expiry: false, cost_price: 30, barcode: '6003332221110' },
]

const INITIAL_DAY_HISTORY = [
  { id: 'dh-1', date: 'Sun, 19 Jul 2026', income: 598200, profit: 172400, is_balanced: true, mismatch_amount: 0, status: 'BALANCED', closed_by: 'Blessing (Cashier)' },
  { id: 'dh-2', date: 'Sat, 18 Jul 2026', income: 542600, profit: 149900, is_balanced: false, mismatch_amount: -3200, status: 'MISMATCH ₦3,200', closed_by: 'Blessing (Cashier)' },
  { id: 'dh-3', date: 'Fri, 17 Jul 2026', income: 615000, profit: 178000, is_balanced: true, mismatch_amount: 0, status: 'BALANCED', closed_by: 'Blessing (Cashier)' },
]

const INITIAL_USERS = [
  { id: 'u-1', name: 'Chidinma', role: 'ATTENDANT' },
  { id: 'u-2', name: 'Emeka', role: 'ATTENDANT' },
  { id: 'u-3', name: 'Ngozi', role: 'ATTENDANT' },
  { id: 'u-4', name: 'Ifeoma', role: 'ATTENDANT' },
  { id: 'u-5', name: 'Blessing', role: 'CASHIER' },
  { id: 'u-6', name: 'Baba Emmanuel', role: 'ADMIN' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  // Navigation tab state: 'overview' | 'performance' | 'products' | 'day_history' | 'settings'
  const [activeTab, setActiveTab] = useState('overview')

  // Red Backup Banner (toggleable in demo header to show both states)
  const [backupFailed, setBackupFailed] = useState(true)

  // Performance Tab State
  const [perfTimeframe, setPerfTimeframe] = useState('This Week') // 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom'
  const [perfMetric, setPerfMetric] = useState('Revenue') // 'Revenue' | 'Profit' | 'No. of Sales'

  // Debtors Modal State
  const [showDebtorsModal, setShowDebtorsModal] = useState(false)

  // Products Tab State
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [productFilter, setProductFilter] = useState('all') // 'all' | 'low_stock' | 'near_expiry'
  const [productSearch, setProductSearch] = useState('')
  const [showAddProductModal, setShowAddProductModal] = useState(false)

  // Add Product Form
  const [newProdName, setNewProdName] = useState('')
  const [newProdCat, setNewProdCat] = useState('Analgesic')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdStock, setNewProdStock] = useState('')
  const [newProdExpiry, setNewProdExpiry] = useState('')

  // Day History State
  const [dayHistory, setDayHistory] = useState(INITIAL_DAY_HISTORY)
  const [selectedDay, setSelectedDay] = useState(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  // Settings State
  const [dailyExpenseLimit, setDailyExpenseLimit] = useState(25000)
  const [mismatchAlertLimit, setMismatchAlertLimit] = useState(5000)

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase())

      if (!matchSearch) return false

      if (productFilter === 'low_stock') return p.is_low_stock || p.stock_left <= 15
      if (productFilter === 'near_expiry') return p.is_near_expiry
      return true
    })
  }, [products, productSearch, productFilter])

  // Handle Add Product Submit
  const handleAddProduct = (e) => {
    e.preventDefault()
    if (!newProdName || !newProdPrice) return

    const newProd = {
      id: 'p-' + Date.now(),
      name: newProdName.trim(),
      category: newProdCat,
      selling_price: Number(newProdPrice),
      stock_left: Number(newProdStock) || 0,
      expiry: newProdExpiry || 'Dec 2027',
      is_low_stock: (Number(newProdStock) || 0) <= 15,
      is_near_expiry: false,
      cost_price: Math.round(Number(newProdPrice) * 0.75),
      barcode: '600' + Math.floor(1000000000 + Math.random() * 9000000000),
    }

    setProducts([newProd, ...products])
    setShowAddProductModal(false)
    setNewProdName(''); setNewProdPrice(''); setNewProdStock(''); setNewProdExpiry('')
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f3ee', color: '#1c1917', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ============================================================ */}
      {/* DESKTOP LAYOUT (240px Sidebar + Main Content Area)           */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', minHeight: '100dvh' }}>
        {/* SIDEBAR (Desktop) */}
        <aside
          style={{
            width: '240px',
            background: '#ffffff',
            borderRight: '1px solid #e7e5e4',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
          className="hidden md:flex"
        >
          <div style={{ spaceY: '24px' }}>
            {/* Brand Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px', marginBottom: '32px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#2563eb', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                EP
              </div>
              <div>
                <h1 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Emmanuel</h1>
                <h1 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Pharmacy</h1>
              </div>
            </div>

            {/* Sidebar Nav Items */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { id: 'overview', label: 'Overview', icon: '田' },
                { id: 'performance', label: 'Performance', icon: '📈' },
                { id: 'products', label: 'Products', icon: '🛍️' },
                { id: 'day_history', label: 'Day History', icon: '📅' },
                { id: 'settings', label: 'Settings', icon: '⚙️' },
              ].map((item) => {
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: active ? '700' : '600',
                      color: active ? '#2563eb' : '#64748b',
                      background: active ? '#eff6ff' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* User Sign Out Footer */}
          <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                color: '#ef4444',
                background: '#fef2f2',
                border: 'none',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span>🚪 Sign Out</span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* TOP HEADER BAR */}
          <header style={{ background: '#ffffff', padding: '16px 28px', borderBottom: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, textTransform: 'capitalize' }}>
                {activeTab.replace('_', ' ')}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                {activeTab === 'overview' && 'Emmanuel Pharmacy · Today, 20 Jul'}
                {activeTab === 'performance' && 'Business trends · Emmanuel Pharmacy'}
                {activeTab === 'products' && `${products.length} products in stock`}
                {activeTab === 'day_history' && `${dayHistory.length} closed days`}
                {activeTab === 'settings' && 'Shop configuration & team'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setBackupFailed(!backupFailed)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                {backupFailed ? 'Demo: Dismiss Red Banner' : 'Demo: Show Red Banner'}
              </button>
              <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '700' }}>
                🟢 {fullName || username || 'Baba Emmanuel'} (Admin)
              </div>
            </div>
          </header>

          {/* MAIN BODY AREA */}
          <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
            {/* ============================================================ */}
            {/* 1. OVERVIEW SCREEN (Matching Admin Overview-selection2.png)   */}
            {/* ============================================================ */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' }}>
                {/* CONDITIONAL RED BACKUP BANNER (Matching Reference 2) */}
                {backupFailed && (
                  <div style={{ background: '#dc2626', color: '#ffffff', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '700', fontSize: '14px' }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <span>Backup failed — data is not protected. Fix now.</span>
                  </div>
                )}

                {/* TOP ROW: TODAY'S MONEY (SOLID BLUE CARD) & PROFIT CARD */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* TODAY'S MONEY (SOLID BLUE CARD) */}
                  <div style={{ background: '#1e40af', color: '#ffffff', borderRadius: '20px', padding: '24px', boxShadow: '0 8px 24px rgba(30,64,175,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TODAY'S MONEY</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '999px' }}>142 sales</span>
                    </div>

                    <h3 style={{ fontSize: '42px', fontWeight: '900', color: '#ffffff', margin: '0 0 20px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                      ₦612,900
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ opacity: 0.8 }}>Cash</span>
                        <span style={{ fontWeight: '800' }}>₦231,500</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ opacity: 0.8 }}>POS</span>
                        <span style={{ fontWeight: '800' }}>₦244,900</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ opacity: 0.8 }}>Transfer</span>
                        <span style={{ fontWeight: '800' }}>₦89,100</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px stroke rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Credit</span>
                          <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: '4px' }}>OWED, NOT RECEIVED</span>
                        </div>
                        <span style={{ fontWeight: '800' }}>₦47,400</span>
                      </div>
                    </div>
                  </div>

                  {/* PROFIT CARD (SOLID WHITE CARD) */}
                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PROFIT</span>
                    <h3 style={{ fontSize: '48px', fontWeight: '900', color: '#0f172a', margin: '8px 0 0', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                      ₦187,300
                    </h3>
                  </div>
                </div>

                {/* BOTTOM ROW: LEADERBOARD & TOTAL OWED / EXPENSES */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* ATTENDANT LEADERBOARD */}
                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
                      ATTENDANT LEADERBOARD · TODAY
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {INITIAL_ATTENDANTS_LEADERBOARD.map((att) => (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '12px 14px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: att.rank === 1 ? '#2563eb' : '#e2e8f0', color: att.rank === 1 ? '#ffffff' : '#64748b', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                              {att.rank}
                            </div>
                            <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{att.name}</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a', display: 'block' }}>₦{att.sales_value.toLocaleString()}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{att.sales_count} sales</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TOTAL OWED & EXPENSES VS LIMIT */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* TOTAL OWED CARD */}
                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TOTAL OWED</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>NOT CASH</span>
                      </div>

                      <h4 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', margin: '4px 0 12px', fontVariantNumeric: 'tabular-nums' }}>
                        ₦164,300
                      </h4>

                      <button
                        onClick={() => setShowDebtorsModal(true)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                      >
                        See everyone owing →
                      </button>
                    </div>

                    {/* EXPENSES VS LIMIT CARD */}
                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                        EXPENSES VS LIMIT
                      </span>

                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#2563eb' }}>
                        ₦18,500 of ₦25,000 limit
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. PERFORMANCE SCREEN (Matching Admin Overview-selection.png) */}
            {/* ============================================================ */}
            {activeTab === 'performance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' }}>
                {/* TIMEFRAME PILL SELECTOR ROW */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Today', 'This Week', 'This Month', 'This Year', 'Custom'].map((tf) => {
                    const active = perfTimeframe === tf
                    return (
                      <button
                        key={tf}
                        onClick={() => setPerfTimeframe(tf)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '999px',
                          fontSize: '13px',
                          fontWeight: active ? '800' : '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: active ? '#2563eb' : '#ffffff',
                          color: active ? '#ffffff' : '#64748b',
                          boxShadow: active ? '0 4px 12px rgba(37,99,235,0.2)' : 'none',
                        }}
                      >
                        {tf}
                      </button>
                    )
                  })}
                </div>

                {/* CHART CONTAINER CARD */}
                <div style={{ background: '#ffffff', borderRadius: '20px', padding: '28px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                      ₦3,701,512
                    </h3>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626', background: '#fef2f2', padding: '4px 10px', borderRadius: '8px' }}>
                      ▼ -3.6%
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>Revenue · this week vs last week</p>

                  {/* TREND SVG WAVE CHART */}
                  <div style={{ height: '200px', width: '100%', marginBottom: '24px' }}>
                    <svg viewBox="0 0 600 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 100 Q 100 40 200 80 T 400 30 T 600 110 L 600 150 L 0 150 Z" fill="url(#chartGrad)" />
                      <path d="M 0 100 Q 100 40 200 80 T 400 30 T 600 110" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* METRIC SELECTOR PILLS */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Revenue', 'Profit', 'No. of Sales'].map((m) => {
                      const active = perfMetric === m
                      return (
                        <button
                          key={m}
                          onClick={() => setPerfMetric(m)}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '999px',
                            fontSize: '13px',
                            fontWeight: active ? '800' : '600',
                            border: 'none',
                            cursor: 'pointer',
                            background: active ? '#2563eb' : '#f1f5f9',
                            color: active ? '#ffffff' : '#64748b',
                          }}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 4 METRIC CARDS GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e7e5e4' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL REVENUE</span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '6px 0 4px' }}>₦3,701,512</h4>
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '800' }}>▼ -3.6%</span>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e7e5e4' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL PROFIT</span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '6px 0 4px' }}>₦1,045,445</h4>
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '800' }}>▼ -4.1%</span>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e7e5e4' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>NUMBER OF SALES</span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '6px 0 4px' }}>857</h4>
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '800' }}>▼ -4.9%</span>
                  </div>

                  <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e7e5e4' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>AVERAGE SALE VALUE</span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: '6px 0 4px' }}>₦4,319</h4>
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '800' }}>▲ +1.3%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 3. PRODUCTS SCREEN (Matching Admin Overview-selection3.png)   */}
            {/* ============================================================ */}
            {activeTab === 'products' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' }}>
                {/* SEARCH & FILTER ROW */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '280px' }}>
                    <input
                      type="text"
                      placeholder="Search product or barcode..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      style={{ flex: 1, height: '42px', padding: '0 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '999px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'low_stock', label: 'Low stock' },
                      { id: 'near_expiry', label: 'Near expiry' },
                    ].map((chip) => {
                      const active = productFilter === chip.id
                      return (
                        <button
                          key={chip.id}
                          onClick={() => setProductFilter(chip.id)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: active ? '800' : '600',
                            border: 'none',
                            cursor: 'pointer',
                            background: active ? '#2563eb' : '#ffffff',
                            color: active ? '#ffffff' : '#64748b',
                            boxShadow: active ? '0 4px 12px rgba(37,99,235,0.2)' : 'none',
                          }}
                        >
                          {chip.label}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setShowAddProductModal(true)}
                      style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                    >
                      + Add product
                    </button>
                  </div>
                </div>

                {/* PRODUCT TABLE CARD */}
                <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e7e5e4', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <tbody>
                      {filteredProducts.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a' }}>
                            {p.name}
                            <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>{p.category}</span>
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: '800', color: '#2563eb' }}>
                            ₦{p.selling_price.toLocaleString()}/unit
                          </td>
                          <td style={{ padding: '16px 20px', color: p.is_low_stock || p.stock_left <= 15 ? '#dc2626' : '#64748b', fontWeight: p.is_low_stock || p.stock_left <= 15 ? '800' : '600' }}>
                            {p.stock_left} left
                          </td>
                          <td style={{ padding: '16px 20px', color: p.is_near_expiry ? '#dc2626' : '#64748b', fontWeight: p.is_near_expiry ? '800' : '600' }}>
                            Exp {p.expiry}
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <button
                              style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#2563eb', fontWeight: '800', cursor: 'pointer' }}
                            >
                              +
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 4. DAY HISTORY SCREEN (Matching Admin Overview-selection4.png)*/}
            {/* ============================================================ */}
            {activeTab === 'day_history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button style={{ padding: '8px 16px', borderRadius: '999px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    All months
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dayHistory.map((dh) => (
                    <div
                      key={dh.id}
                      onClick={() => setSelectedDay(dh)}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '18px 24px',
                        border: '1px solid #e7e5e4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>
                        {dh.date}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Income <strong style={{ color: '#0f172a' }}>₦{dh.income.toLocaleString()}</strong>
                        </span>

                        <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: '700' }}>
                          Profit ₦{dh.profit.toLocaleString()}
                        </span>

                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: dh.is_balanced ? '#dcfce7' : '#fef2f2',
                            color: dh.is_balanced ? '#166534' : '#dc2626',
                          }}
                        >
                          {dh.status}
                        </span>

                        <span style={{ color: '#94a3b8' }}>v</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. SETTINGS SCREEN (Matching Admin Overview-selection5.png)   */}
            {/* ============================================================ */}
            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', maxWidth: '1100px' }}>
                {/* LEFT COLUMN: DAILY LIMITS & BACKUP STATUS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* DAILY LIMITS */}
                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
                      DAILY LIMITS
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Daily expense limit (N)</label>
                        <input
                          type="number"
                          value={dailyExpenseLimit}
                          onChange={(e) => setDailyExpenseLimit(Number(e.target.value))}
                          style={{ width: '100%', height: '44px', padding: '0 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: '700' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Mismatch alert limit (N)</label>
                        <input
                          type="number"
                          value={mismatchAlertLimit}
                          onChange={(e) => setMismatchAlertLimit(Number(e.target.value))}
                          style={{ width: '100%', height: '44px', padding: '0 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: '700' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* BACKUP STATUS */}
                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '12px' }}>
                      BACKUP STATUS
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '800', fontSize: '14px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
                      <span>Backup failed</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Last successful backup: yesterday, 9:58 PM</p>
                  </div>
                </div>

                {/* RIGHT COLUMN: USER ACCOUNTS (Matching Reference 5) */}
                <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
                    USER ACCOUNTS
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {INITIAL_USERS.map((u) => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{u.name}</span>
                          <span style={{ fontSize: '9px', fontWeight: '800', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                            {u.role}
                          </span>
                        </div>

                        <button
                          onClick={() => alert(`Password reset link issued for ${u.name}`)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Reset password
                        </button>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '16px', marginBot: 0 }}>
                    One person, one login.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: DEBTORS MODAL                                       */}
      {/* ============================================================ */}
      {showDebtorsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '500px', width: '100%', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Everyone Owing Debt (₦164,300)</h3>
              <button onClick={() => setShowDebtorsModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
              {INITIAL_CREDIT_DEBTORS.map((d) => (
                <div key={d.id} style={{ padding: '12px 14px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a', display: 'block' }}>{d.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Tel: {d.customer_phone} · {d.date}</span>
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '15px', color: '#b45309' }}>₦{d.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ADD PRODUCT MODAL                                   */}
      {/* ============================================================ */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Add New Product</h3>
              <button onClick={() => setShowAddProductModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Product Name *</label>
                <input type="text" required placeholder="e.g. Paracetamol 500mg" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Category</label>
                  <select value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    {['Analgesic', 'Antibiotic', 'Antimalarial', 'Supplement', 'Antidiabetic', 'Rehydration'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>Selling Price (₦) *</label>
                  <input type="number" required placeholder="50" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Initial Stock Qty</label>
                  <input type="number" placeholder="240" value={newProdStock} onChange={(e) => setNewProdStock(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Expiry Month/Year</label>
                  <input type="text" placeholder="Aug 2027" value={newProdExpiry} onChange={(e) => setNewProdExpiry(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', height: '44px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>
                Save Product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
