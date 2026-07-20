import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/* =================================================================
   SAMPLE NIGERIAN DATA (Matching Master Design Prompt Specs)
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
  { id: 'p-1', name: 'Coartem 80/480mg', category: 'Antimalarial', cost_price: 1350, selling_price: 1800, wholesale_price: 1650, stock_left: 42, low_stock_level: 15, nearest_expiry: '2027-04-15', barcode: '6001234567890', supplier: 'Swiss Pharma Ltd', unit_tin: 1, unit_sachet: 6, unit_tab: 24, is_low_stock: false, is_near_expiry: false },
  { id: 'p-2', name: 'Paracetamol 500mg (Emzor)', category: 'Analgesic', cost_price: 35, selling_price: 50, wholesale_price: 45, stock_left: 8, low_stock_level: 20, nearest_expiry: '2026-08-10', barcode: '6009876543210', supplier: 'Emzor Phramaceuticals', unit_tin: 1, unit_sachet: 20, unit_tab: 200, is_low_stock: true, is_near_expiry: true },
  { id: 'p-3', name: 'Ciprofloxacin 500mg', category: 'Antibiotic', cost_price: 180, selling_price: 250, wholesale_price: 220, stock_left: 14, low_stock_level: 15, nearest_expiry: '2026-09-01', barcode: '6005554443322', supplier: 'Fidson Healthcare', unit_tin: 1, unit_sachet: 10, unit_tab: 100, is_low_stock: true, is_near_expiry: true },
  { id: 'p-4', name: 'Amoxil 500mg Capsules', category: 'Antibiotic', cost_price: 420, selling_price: 600, wholesale_price: 550, stock_left: 55, low_stock_level: 10, nearest_expiry: '2027-11-20', barcode: '6001112223334', supplier: 'GlaxoSmithKline', unit_tin: 1, unit_sachet: 10, unit_tab: 100, is_low_stock: false, is_near_expiry: false },
  { id: 'p-5', name: 'ORS Hydration Sachets', category: 'Supplements', cost_price: 45, selling_price: 70, wholesale_price: 60, stock_left: 4, low_stock_level: 25, nearest_expiry: '2026-08-05', barcode: '6007778889990', supplier: 'Juhel Nigeria Ltd', unit_tin: 1, unit_sachet: 50, unit_tab: 50, is_low_stock: true, is_near_expiry: true },
  { id: 'p-6', name: 'Lonart Forte Suppository', category: 'Antimalarial', cost_price: 2100, selling_price: 2800, wholesale_price: 2600, stock_left: 18, low_stock_level: 5, nearest_expiry: '2027-06-30', barcode: '6004443332221', supplier: 'Bliss GVS Pharma', unit_tin: 1, unit_sachet: 1, unit_tab: 6, is_low_stock: false, is_near_expiry: false },
]

const INITIAL_DAY_HISTORY = [
  { id: 'dh-1', date: 'Mon, 20 Jul 2026 (Today)', total_income: 612900, profit: 187300, is_balanced: true, mismatch_amount: 0, closed_by: 'Blessing (Cashier)', closed_at: '8:45 PM', status: 'Balanced', system_cash: 231500, system_pos1: 148200, system_pos2: 96700, system_transfer: 89100, system_credit: 47400, cash_counted: 231500, pos1_counted: 148200, pos2_counted: 96700, transfer_counted: 89100, float: 2000 },
  { id: 'dh-2', date: 'Sun, 19 Jul 2026', total_income: 540200, profit: 162100, is_balanced: false, mismatch_amount: -2500, closed_by: 'Blessing (Cashier)', closed_at: '8:50 PM', status: 'Mismatch -₦2,500', system_cash: 210000, system_pos1: 135000, system_pos2: 85000, system_transfer: 110200, system_credit: 32000, cash_counted: 207500, pos1_counted: 135000, pos2_counted: 85000, transfer_counted: 110200, float: 2000 },
  { id: 'dh-3', date: 'Sat, 18 Jul 2026', total_income: 685000, profit: 210400, is_balanced: true, mismatch_amount: 0, closed_by: 'Blessing (Cashier)', closed_at: '9:05 PM', status: 'Balanced', system_cash: 260000, system_pos1: 170000, system_pos2: 105000, system_transfer: 150000, system_credit: 55000, cash_counted: 260000, pos1_counted: 170000, pos2_counted: 105000, transfer_counted: 150000, float: 2000 },
]

const INITIAL_USERS = [
  { id: 'u-1', name: 'Chidinma Nnaji', username: 'chidinma', role: 'attendant', badge: 'Attendant 1', status: 'Active' },
  { id: 'u-2', name: 'Emeka Okeke', username: 'emeka', role: 'attendant', badge: 'Attendant 2', status: 'Active' },
  { id: 'u-3', name: 'Ngozi Eze', username: 'ngozi', role: 'attendant', badge: 'Attendant 3', status: 'Active' },
  { id: 'u-4', name: 'Ifeoma Adebayo', username: 'ifeoma', role: 'attendant', badge: 'Attendant 4', status: 'Active' },
  { id: 'u-5', name: 'Blessing Igwe', username: 'cashier', role: 'cashier', badge: 'Till Cashier', status: 'Active' },
  { id: 'u-6', name: 'Chief Emmanuel Ozor', username: 'admin', role: 'admin', badge: 'Shop Owner (Admin)', status: 'Active' },
]

/* =================================================================
   MAIN ADMIN PAGE COMPONENT
   ================================================================= */
export default function AdminPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  // Navigation tab state: 'overview' | 'products' | 'day_history' | 'settings'
  const [activeTab, setActiveTab] = useState('overview')

  // Hard Design Rule: Red Backup Banner state (toggleable in UI to review both states)
  const [backupFailed, setBackupFailed] = useState(true)

  // Debtors Modal State
  const [showDebtorsModal, setShowDebtorsModal] = useState(false)

  // Products Tab State
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [productFilter, setProductFilter] = useState('all') // 'all' | 'low_stock' | 'near_expiry'
  const [productSearch, setProductSearch] = useState('')
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showReceiveStockModal, setShowReceiveStockModal] = useState(false)
  const [selectedProductForStock, setSelectedProductForStock] = useState(null)

  // New Product Form State
  const [newProdName, setNewProdName] = useState('')
  const [newProdCategory, setNewProdCategory] = useState('Antimalarial')
  const [newProdCost, setNewProdCost] = useState('')
  const [newProdRetail, setNewProdRetail] = useState('')
  const [newProdWholesale, setNewProdWholesale] = useState('')
  const [newProdStock, setNewProdStock] = useState('')
  const [newProdLowLevel, setNewProdLowLevel] = useState('15')
  const [newProdExpiry, setNewProdExpiry] = useState('')
  const [newProdBarcode, setNewProdBarcode] = useState('')
  const [newProdSupplier, setNewProdSupplier] = useState('')
  const [newUnitTin, setNewUnitTin] = useState('1')
  const [newUnitSachet, setNewUnitSachet] = useState('10')
  const [newUnitTab, setNewUnitTab] = useState('100')

  // Receive Stock Form State
  const [rxStockQty, setRxStockQty] = useState('')
  const [rxTrueCost, setRxTrueCost] = useState('')
  const [rxPackExpiry, setRxPackExpiry] = useState('')

  // Day History State
  const [dayHistory, setDayHistory] = useState(INITIAL_DAY_HISTORY)
  const [selectedDayDetail, setSelectedDayDetail] = useState(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  // Settings State
  const [dailyExpenseLimit, setDailyExpenseLimit] = useState(25000)
  const [mismatchAlertLimit, setMismatchAlertLimit] = useState(2000)
  const [usersList, setUsersList] = useState(INITIAL_USERS)
  const [lastBackupTime, setLastBackupTime] = useState('2026-07-20 08:30 AM')

  // Sign out
  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode.includes(productSearch)

      if (!matchesSearch) return false

      if (productFilter === 'low_stock') return p.stock_left <= p.low_stock_level
      if (productFilter === 'near_expiry') return p.is_near_expiry || p.nearest_expiry < '2026-10-01'
      return true
    })
  }, [products, productSearch, productFilter])

  // Handle Add Product Submit
  const handleAddProduct = (e) => {
    e.preventDefault()
    if (!newProdName || !newProdRetail) return

    const newProd = {
      id: 'p-' + Date.now(),
      name: newProdName.trim(),
      category: newProdCategory,
      cost_price: Number(newProdCost) || 0,
      selling_price: Number(newProdRetail) || 0,
      wholesale_price: Number(newProdWholesale) || Number(newProdRetail),
      stock_left: Number(newProdStock) || 0,
      low_stock_level: Number(newProdLowLevel) || 10,
      nearest_expiry: newProdExpiry || '2027-12-31',
      barcode: newProdBarcode.trim() || '600' + Math.floor(1000000000 + Math.random() * 9000000000),
      supplier: newProdSupplier.trim() || 'Local Distributor',
      unit_tin: Number(newUnitTin) || 1,
      unit_sachet: Number(newUnitSachet) || 10,
      unit_tab: Number(newUnitTab) || 100,
      is_low_stock: (Number(newProdStock) || 0) <= (Number(newProdLowLevel) || 10),
      is_near_expiry: newProdExpiry ? newProdExpiry < '2026-10-01' : false,
    }

    setProducts([newProd, ...products])
    setShowAddProductModal(false)
    // reset form
    setNewProdName(''); setNewProdCost(''); setNewProdRetail(''); setNewProdStock('')
  }

  // Handle Receive Stock Submit
  const handleReceiveStockSubmit = (e) => {
    e.preventDefault()
    if (!selectedProductForStock || !rxStockQty) return

    const updated = products.map((p) => {
      if (p.id === selectedProductForStock.id) {
        const addedQty = Number(rxStockQty)
        const newStock = p.stock_left + addedQty
        return {
          ...p,
          stock_left: newStock,
          cost_price: rxTrueCost ? Number(rxTrueCost) : p.cost_price,
          nearest_expiry: rxPackExpiry || p.nearest_expiry,
          is_low_stock: newStock <= p.low_stock_level,
        }
      }
      return p
    })

    setProducts(updated)
    setShowReceiveStockModal(false)
    setSelectedProductForStock(null)
    setRxStockQty(''); setRxTrueCost(''); setRxPackExpiry('')
  }

  // Handle Reset Password Action
  const handleResetPassword = (userName) => {
    alert(`Password reset link sent for ${userName}. Role credential remains protected.`)
  }

  // Handle Trigger Backup Action
  const handleTriggerBackup = () => {
    setLastBackupTime(new Date().toLocaleString())
    setBackupFailed(false)
    alert('System backup completed successfully! All data is securely backed up.')
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f8f7f2', color: '#1c1917', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ============================================================ */}
      {/* HARD DESIGN RULE: CONDITIONAL RED BACKUP BANNER             */}
      {/* ============================================================ */}
      {backupFailed && (
        <div style={{ background: '#dc2626', color: '#ffffff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', fontWeight: '700', fontSize: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span>Backup failed — data is not protected. Fix now.</span>
          </div>
          <button
            onClick={() => setBackupFailed(false)}
            style={{ background: '#ffffff', color: '#dc2626', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
          >
            Resolve & Backup Now
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* HEADER BAR (Deep Pharmacy Green #15803d)                     */}
      {/* ============================================================ */}
      <header style={{ background: '#15803d', color: '#ffffff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: '900', fontSize: '18px' }}>
            🇳🇬
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>Emmanuel Pharmacy</h1>
            <p style={{ fontSize: '12px', opacity: 0.85, margin: 0 }}>Admin Dashboard · Owner View</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setBackupFailed(!backupFailed)}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
          >
            {backupFailed ? 'Simulate Healthy' : 'Simulate Backup Alert'}
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', background: 'rgba(0,0,0,0.2)', padding: '6px 14px', borderRadius: '999px' }}>
            Chief Ozor (Admin)
          </span>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#ffffff', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 4-ITEM NAVIGATION (Bottom bar on mobile, Top bar on desktop) */}
      {/* ============================================================ */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #e7e5e4', padding: '0 24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'products', label: 'Products & Stock', icon: '📦' },
          { id: 'day_history', label: 'Day History', icon: '📅' },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '800' : '600',
              color: activeTab === tab.id ? '#15803d' : '#78716c',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #15803d' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ============================================================ */}
      {/* MAIN CONTENT CONTAINERS                                      */}
      {/* ============================================================ */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px 40px' }}>
        {/* ------------------------------------------------------------ */}
        {/* TAB 1: OVERVIEW (The Main Owner Screen)                       */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* HERO SCOREBOARD 1: TODAY'S MONEY */}
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TODAY'S TOTAL REVENUE</span>
                  <h2 style={{ fontSize: '42px', fontWeight: '900', color: '#15803d', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    ₦612,900
                  </h2>
                </div>
                <div style={{ background: '#f5f5f4', padding: '8px 16px', borderRadius: '12px', textCenter: 'right' }}>
                  <span style={{ fontSize: '12px', color: '#78716c', fontWeight: '600', block: 'true' }}>Total Transactions</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#1c1917' }}>142 sales today</span>
                </div>
              </div>

              {/* METHOD BREAKDOWN CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '20px' }}>
                <div style={{ background: '#fcfbf7', padding: '14px', borderRadius: '14px', border: '1px solid #e7e5e4' }}>
                  <span style={{ fontSize: '11px', color: '#78716c', fontWeight: '700' }}>💵 CASH</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#1c1917', marginTop: '4px' }}>₦231,500</div>
                </div>
                <div style={{ background: '#fcfbf7', padding: '14px', borderRadius: '14px', border: '1px solid #e7e5e4' }}>
                  <span style={{ fontSize: '11px', color: '#78716c', fontWeight: '700' }}>💳 POS 1 (Moneypoint)</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#1c1917', marginTop: '4px' }}>₦148,200</div>
                </div>
                <div style={{ background: '#fcfbf7', padding: '14px', borderRadius: '14px', border: '1px solid #e7e5e4' }}>
                  <span style={{ fontSize: '11px', color: '#78716c', fontWeight: '700' }}>💳 POS 2 (FirstBank)</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#1c1917', marginTop: '4px' }}>₦96,700</div>
                </div>
                <div style={{ background: '#fcfbf7', padding: '14px', borderRadius: '14px', border: '1px solid #e7e5e4' }}>
                  <span style={{ fontSize: '11px', color: '#78716c', fontWeight: '700' }}>📱 BANK TRANSFER</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#1c1917', marginTop: '4px' }}>₦89,100</div>
                </div>
                <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '14px', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '800' }}>📝 CREDIT (Owed, not received)</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>₦47,400</div>
                </div>
              </div>
            </div>

            {/* HERO SCOREBOARD 2: PROFIT TODAY (GOLD ACCENT - ADMIN HERO FIGURE) */}
            <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderRadius: '20px', padding: '24px', border: '2px solid #f59e0b', boxShadow: '0 4px 20px rgba(217,119,6,0.1)' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PROFIT TODAY (ADMIN HERO FIGURE)</span>
              <h3 style={{ fontSize: '48px', fontWeight: '900', color: '#b45309', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                ₦187,300
              </h3>
              <p style={{ fontSize: '13px', color: '#78350f', fontWeight: '600', margin: '6px 0 0' }}>
                Calculated automatically: Sales (₦612,900) − Cost of goods (₦407,100) − Expenses (₦18,500)
              </p>
            </div>

            {/* TWO COLUMN ROW: ATTENDANT LEADERBOARD & CREDIT OUTSTANDING */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* ATTENDANT LEADERBOARD */}
              <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e7e5e4' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1c1917', margin: '0 0 14px' }}>Attendant Leaderboard Today</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {INITIAL_ATTENDANTS_LEADERBOARD.map((att) => (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: att.rank === 1 ? '#f0fdf4' : '#fcfbf7',
                        border: att.rank === 1 ? '1.5px solid #86efac' : '1px solid #e7e5e4',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: att.rank === 1 ? '#15803d' : '#e7e5e4', color: att.rank === 1 ? '#fff' : '#78716c', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '12px', fontWeight: '800' }}>
                          {att.rank}
                        </span>
                        <div>
                          <span style={{ fontWeight: '800', fontSize: '14px', color: '#1c1917' }}>{att.name}</span>
                          {att.rank === 1 && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#dcfce7', color: '#166534', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>TOP SELLER</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', fontSize: '14px', color: '#15803d', display: 'block' }}>₦{att.sales_value.toLocaleString()}</span>
                        <span style={{ fontSize: '11px', color: '#78716c' }}>{att.sales_count} sales</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOTAL OWED (CREDIT OUTSTANDING) */}
              <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e7e5e4', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TOTAL OWED BY CUSTOMERS</span>
                  <h3 style={{ fontSize: '36px', fontWeight: '900', color: '#dc2626', margin: '6px 0 0' }}>₦164,300</h3>
                  <p style={{ fontSize: '12px', color: '#78716c', margin: '4px 0 16px' }}>Outstanding credit across all registered customers.</p>
                </div>

                <button
                  onClick={() => setShowDebtorsModal(true)}
                  style={{ width: '100%', padding: '14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '14px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyCenter: 'center', gap: '8px' }}
                >
                  <span>See Everyone Owing Debt</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* EXPENSES VS LIMIT & STOCK SNAPSHOT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* EXPENSES TODAY VS LIMIT */}
              <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e7e5e4' }}>
                <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#1c1917' }}>Expenses Today vs Limit</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 18500 > dailyExpenseLimit ? '#dc2626' : '#15803d' }}>
                    ₦18,500 / ₦{dailyExpenseLimit.toLocaleString()}
                  </span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#f5f5f4', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(18500 / dailyExpenseLimit) * 100}%`, height: '100%', background: 18500 > dailyExpenseLimit ? '#dc2626' : '#15803d', borderRadius: '999px' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#78716c', marginTop: '8px', display: 'block' }}>
                  Limit set to ₦{dailyExpenseLimit.toLocaleString()} in Settings. Progress bar turns red if crossed.
                </span>
              </div>

              {/* STOCK VALUE SNAPSHOT */}
              <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e7e5e4' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase' }}>TOTAL STOCK VALUE ON SHELVES</span>
                <h4 style={{ fontSize: '28px', fontWeight: '900', color: '#1c1917', margin: '4px 0 8px' }}>₦4,850,000</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                    ⚠️ 6 items low stock
                  </span>
                  <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                    ⚠️ 3 near expiry
                  </span>
                </div>
              </div>
            </div>

            {/* ALERTS FEED */}
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e7e5e4' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1c1917', margin: '0 0 12px' }}>Real-time Activity & Alert Feed</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '8px', fontSize: '13px' }}>
                  <span style={{ fontWeight: '800', color: '#b45309' }}>Credit Sale</span> — Mrs. Okafor bought goods worth ₦12,400 recorded by Chidinma · 2:14 PM
                </div>
                <div style={{ padding: '10px 14px', background: '#fcfbf7', borderLeft: '4px solid #15803d', borderRadius: '8px', fontSize: '13px' }}>
                  <span style={{ fontWeight: '800', color: '#15803d' }}>Day Close Reconciliation</span> — Blessing closed Till 2 (Balanced) · 8:45 PM
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* TAB 2: PRODUCTS & STOCK MANAGEMENT                           */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Inventory & Stock Batch Management</h2>
                <p style={{ fontSize: '13px', color: '#78716c', margin: '2px 0 0' }}>Search products, track stock left, unit chains, cost prices, and receive stock batches.</p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  style={{ background: '#15803d', color: '#ffffff', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>+</span> Add New Drug
                </button>
              </div>
            </div>

            {/* SEARCH & FILTER CHIPS */}
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #e7e5e4', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Search drug by name, category, or barcode..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: '100%', height: '46px', padding: '0 16px', background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'all', label: 'All Products (' + products.length + ')' },
                  { id: 'low_stock', label: '⚠️ Low Stock (' + products.filter((p) => p.stock_left <= p.low_stock_level).length + ')' },
                  { id: 'near_expiry', label: '⚠️ Near Expiry (' + products.filter((p) => p.is_near_expiry).length + ')' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setProductFilter(chip.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '800',
                      border: 'none',
                      cursor: 'pointer',
                      background: productFilter === chip.id ? '#15803d' : '#f5f5f4',
                      color: productFilter === chip.id ? '#ffffff' : '#78716c',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PRODUCT LIST TABLE */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e7e5e4', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f4', borderBottom: '1px solid #e7e5e4', color: '#78716c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '14px 16px' }}>Drug Name</th>
                    <th style={{ padding: '14px 16px' }}>Category</th>
                    <th style={{ padding: '14px 16px' }}>Cost Price (Admin Only)</th>
                    <th style={{ padding: '14px 16px' }}>Selling Price</th>
                    <th style={{ padding: '14px 16px' }}>Stock Left</th>
                    <th style={{ padding: '14px 16px' }}>Nearest Expiry</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f5f5f4', background: p.is_low_stock || p.is_near_expiry ? '#fff5f5' : '#ffffff' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#1c1917' }}>
                        {p.name}
                        <span style={{ display: 'block', fontSize: '11px', color: '#78716c', fontWeight: '400' }}>
                          Unit chain: 1 Tin = {p.unit_sachet} Sachets = {p.unit_tab} Tabs
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#78716c' }}>{p.category}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#b45309' }}>
                        ₦{p.cost_price.toLocaleString()} <span style={{ fontSize: '10px', background: '#fef3c7', padding: '2px 4px', borderRadius: '4px' }}>Admin</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#15803d' }}>₦{p.selling_price.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: '800', color: p.stock_left <= p.low_stock_level ? '#dc2626' : '#1c1917' }}>
                          {p.stock_left} left
                        </span>
                        {p.stock_left <= p.low_stock_level && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: '800' }}>⚠️ LOW STOCK</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ color: p.is_near_expiry ? '#dc2626' : '#1c1917', fontWeight: p.is_near_expiry ? '800' : '400' }}>
                          {p.nearest_expiry}
                        </span>
                        {p.is_near_expiry && <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: '800' }}>⚠️ NEAR EXPIRY</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedProductForStock(p)
                            setShowReceiveStockModal(true)
                          }}
                          style={{ background: '#15803d', color: '#ffffff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Receive Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* TAB 3: DAY HISTORY                                           */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'day_history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Cashier Day History & Audits</h2>
              <p style={{ fontSize: '13px', color: '#78716c', margin: '2px 0 0' }}>Inspect past day close reconciliations, cashier counted totals vs system figures, and perform admin order refunds.</p>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e7e5e4', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f4', borderBottom: '1px solid #e7e5e4', color: '#78716c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '14px 16px' }}>Date</th>
                    <th style={{ padding: '14px 16px' }}>Total Income</th>
                    <th style={{ padding: '14px 16px' }}>Profit</th>
                    <th style={{ padding: '14px 16px' }}>Reconciliation Status</th>
                    <th style={{ padding: '14px 16px' }}>Closed By</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dayHistory.map((dh) => (
                    <tr key={dh.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#1c1917' }}>{dh.date}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#15803d' }}>₦{dh.total_income.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#b45309' }}>₦{dh.profit.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '800', background: dh.is_balanced ? '#dcfce7' : '#fef2f2', color: dh.is_balanced ? '#166534' : '#dc2626' }}>
                          {dh.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#78716c' }}>{dh.closed_by} ({dh.closed_at})</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedDayDetail(dh)}
                          style={{ background: '#f5f5f4', color: '#1c1917', border: '1px solid #e7e5e4', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          View Full Breakdown
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* TAB 4: SETTINGS                                              */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1c1917', margin: 0 }}>System Settings & Staff Accounts</h2>
              <p style={{ fontSize: '13px', color: '#78716c', margin: '2px 0 0' }}>Manage daily expense alerts, user accounts, and backup status.</p>
            </div>

            {/* EXPENSE & MISMATCH LIMITS */}
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e7e5e4', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '6px' }}>DAILY EXPENSE LIMIT (₦)</label>
                <input
                  type="number"
                  value={dailyExpenseLimit}
                  onChange={(e) => setDailyExpenseLimit(Number(e.target.value))}
                  style={{ width: '100%', height: '44px', padding: '0 14px', background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: '10px', fontWeight: '800', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#78716c', display: 'block', marginBottom: '6px' }}>DAY CLOSE MISMATCH ALERT LIMIT (₦)</label>
                <input
                  type="number"
                  value={mismatchAlertLimit}
                  onChange={(e) => setMismatchAlertLimit(Number(e.target.value))}
                  style={{ width: '100%', height: '44px', padding: '0 14px', background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: '10px', fontWeight: '800', fontSize: '14px' }}
                />
              </div>
            </div>

            {/* USER ACCOUNTS (EXACTLY 6 ACCOUNTS PER SPEC) */}
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e7e5e4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1c1917', margin: 0 }}>Staff User Accounts (6 Accounts)</h3>
                  <p style={{ fontSize: '12px', color: '#78716c', margin: '2px 0 0' }}>Rule: "One person, one login."</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {usersList.map((u) => (
                  <div key={u.id} style={{ background: '#fcfbf7', padding: '14px', borderRadius: '12px', border: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: '800', fontSize: '14px', color: '#1c1917', display: 'block' }}>{u.name}</span>
                      <span style={{ fontSize: '11px', color: '#78716c' }}>Username: {u.username}</span>
                    </div>
                    <button
                      onClick={() => handleResetPassword(u.name)}
                      style={{ background: '#ffffff', border: '1px solid #e7e5e4', color: '#15803d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Reset Password
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* BACKUP STATUS */}
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#78716c', textTransform: 'uppercase' }}>SYSTEM BACKUP STATUS</span>
                <h4 style={{ fontSize: '16px', fontWeight: '800', color: backupFailed ? '#dc2626' : '#15803d', margin: '4px 0 0' }}>
                  {backupFailed ? '⚠️ Backup Alert: Last Backup Failed' : '✓ Backup Healthy'}
                </h4>
                <p style={{ fontSize: '12px', color: '#78716c', margin: '2px 0 0' }}>Last successful backup: {lastBackupTime}</p>
              </div>

              <button
                onClick={handleTriggerBackup}
                style={{ background: '#15803d', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                Trigger Manual Backup Now
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL 1: DEBTORS LIST                                        */}
      {/* ============================================================ */}
      {showDebtorsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '500px', width: '100%', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Everyone Owing Credit (₦164,300)</h3>
              <button onClick={() => setShowDebtorsModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
              {INITIAL_CREDIT_DEBTORS.map((d) => (
                <div key={d.id} style={{ padding: '12px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: '#1c1917', display: 'block' }}>{d.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#78716c' }}>Tel: {d.customer_phone} · {d.date}</span>
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '15px', color: '#b45309' }}>₦{d.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ADD NEW PRODUCT FORM                                */}
      {/* ============================================================ */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '550px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Add New Product to Inventory</h3>
              <button onClick={() => setShowAddProductModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#78716c' }}>Drug Name *</label>
                <input type="text" required placeholder="e.g. Coartem 80/480mg" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e7e5e4' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#b45309' }}>Cost Price (₦) [Visible to Admin Only] *</label>
                  <input type="number" required placeholder="1350" value={newProdCost} onChange={(e) => setNewProdCost(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#15803d' }}>Selling Price Retail (₦) *</label>
                  <input type="number" required placeholder="1800" value={newProdRetail} onChange={(e) => setNewProdRetail(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #86efac' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#78716c' }}>Initial Stock Qty *</label>
                  <input type="number" required placeholder="42" value={newProdStock} onChange={(e) => setNewProdStock(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e7e5e4' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#78716c' }}>Low Stock Warning Level</label>
                  <input type="number" placeholder="15" value={newProdLowLevel} onChange={(e) => setNewProdLowLevel(e.target.value)} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e7e5e4' }} />
                </div>
              </div>

              <div style={{ background: '#f5f5f4', padding: '12px', borderRadius: '10px', fontSize: '12px' }}>
                <span style={{ fontWeight: '800', color: '#1c1917', display: 'block', marginBottom: '6px' }}>Unit Chain Setup (e.g. 1 Tin = 20 Sachets = 200 Tablets)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: '#78716c' }}>Tin / Box</label>
                    <input type="number" value={newUnitTin} onChange={(e) => setNewUnitTin(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e7e5e4' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#78716c' }}>Sachets</label>
                    <input type="number" value={newUnitSachet} onChange={(e) => setNewUnitSachet(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e7e5e4' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#78716c' }}>Tablets</label>
                    <input type="number" value={newUnitTab} onChange={(e) => setNewUnitTab(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #e7e5e4' }} />
                  </div>
                </div>
              </div>

              <button type="submit" style={{ width: '100%', height: '46px', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', marginTop: '10px' }}>
                Save Product to Database
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: RECEIVE STOCK (BATCH) FORM                           */}
      {/* ============================================================ */}
      {showReceiveStockModal && selectedProductForStock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Receive Stock Batch</h3>
              <button onClick={() => setShowReceiveStockModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#15803d', fontWeight: '800', margin: '0 0 14px' }}>
              Receiving stock for: {selectedProductForStock.name} (Current Stock: {selectedProductForStock.stock_left})
            </p>

            <form onSubmit={handleReceiveStockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#78716c' }}>Quantity Received *</label>
                <input type="number" required placeholder="e.g. 50" value={rxStockQty} onChange={(e) => setRxStockQty(e.target.value)} style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '14px', fontWeight: '800' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#b45309' }}>True Cost Price Paid Per Unit (₦) [Admin Only]</label>
                <input type="number" placeholder={selectedProductForStock.cost_price} value={rxTrueCost} onChange={(e) => setRxTrueCost(e.target.value)} style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', fontSize: '14px', fontWeight: '800' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#78716c' }}>Expiry Date on Pack *</label>
                <input type="date" required value={rxPackExpiry} onChange={(e) => setRxPackExpiry(e.target.value)} style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '14px' }} />
              </div>

              <div style={{ background: '#f5f5f4', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', color: '#78716c', fontWeight: '600' }}>
                ℹ️ Rule: Sales always take from the earliest-expiring batch first.
              </div>

              <button type="submit" style={{ width: '100%', height: '46px', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                Confirm Batch Reception
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: DAY DETAIL VIEW                                      */}
      {/* ============================================================ */}
      {selectedDayDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '550px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1c1917', margin: 0 }}>Day Close Audit: {selectedDayDetail.date}</h3>
                <span style={{ fontSize: '12px', color: '#78716c' }}>Closed by {selectedDayDetail.closed_by}</span>
              </div>
              <button onClick={() => setSelectedDayDetail(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#f5f5f4', padding: '14px', borderRadius: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                <span>Method</span>
                <span>System Expected</span>
                <span>Hand Counted</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash</span><span>₦{selectedDayDetail.system_cash.toLocaleString()}</span><span>₦{selectedDayDetail.cash_counted.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>POS 1</span><span>₦{selectedDayDetail.system_pos1.toLocaleString()}</span><span>₦{selectedDayDetail.pos1_counted.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>POS 2</span><span>₦{selectedDayDetail.system_pos2.toLocaleString()}</span><span>₦{selectedDayDetail.pos2_counted.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Transfer</span><span>₦{selectedDayDetail.system_transfer.toLocaleString()}</span><span>₦{selectedDayDetail.transfer_counted.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '12px', background: selectedDayDetail.is_balanced ? '#dcfce7' : '#fef2f2', color: selectedDayDetail.is_balanced ? '#166534' : '#dc2626', fontWeight: '800', fontSize: '14px', marginBottom: '16px' }}>
              Reconciliation Gap: {selectedDayDetail.status}
            </div>

            <button
              onClick={() => {
                setShowRefundModal(true)
              }}
              style={{ width: '100%', height: '44px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              Admin Order Cancel / Refund (Requires Written Reason)
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: REFUND REASON MODAL                                 */}
      {/* ============================================================ */}
      {showRefundModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '420px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626', margin: '0 0 8px' }}>Cancel / Refund Order</h3>
            <p style={{ fontSize: '12px', color: '#78716c', margin: '0 0 14px' }}>
              Admin action: Records are never deleted. Typed reason is logged permanently with your name and timestamp.
            </p>

            <textarea
              rows={3}
              placeholder="Type written reason for refund..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '13px', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={() => setShowRefundModal(false)}
                style={{ flex: 1, height: '40px', background: '#f5f5f4', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!refundReason.trim()) return alert('Please enter a written reason.')
                  alert(`Order refund logged by Admin (Reason: ${refundReason}). Record updated.`)
                  setShowRefundModal(false)
                  setSelectedDayDetail(null)
                  setRefundReason('')
                }}
                style={{ flex: 1, height: '40px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
