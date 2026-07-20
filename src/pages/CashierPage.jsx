import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/* ─── Mock orders for demo / fallback ────────────────────────── */
const INITIAL_MOCK_ORDERS = [
  {
    id: 'mock-27', order_number: 27, attendant_name: 'Chidinma',
    total_amount: 1900, status: 'waiting_for_payment', is_credit: false,
    created_at: new Date().toISOString(),
    items: [
      { product_name: 'Coartem', unit: 'pack', quantity: 1, unit_price: 1800, total_price: 1800 },
      { product_name: 'Paracetamol 500mg', unit: 'tab', quantity: 2, unit_price: 50, total_price: 100 },
    ],
  },
  {
    id: 'mock-26', order_number: 26, attendant_name: 'Emeka',
    total_amount: 570, status: 'waiting_for_payment', is_credit: false,
    created_at: new Date(Date.now() - 60000).toISOString(),
    items: [
      { product_name: 'Paracetamol 500mg', unit: 'tab', quantity: 10, unit_price: 50, total_price: 500 },
      { product_name: 'ORS Sachet', unit: 'sachet', quantity: 1, unit_price: 70, total_price: 70 },
    ],
  },
  {
    id: 'mock-25', order_number: 25, attendant_name: 'Chidinma',
    total_amount: 3200, status: 'waiting_for_payment', is_credit: true,
    customer_name: 'Chief Paul', customer_phone: '08033445566',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    items: [
      { product_name: 'Ciprofloxacin 500mg', unit: 'tab', quantity: 10, unit_price: 250, total_price: 2500 },
      { product_name: 'ORS Sachet', unit: 'sachet', quantity: 7, unit_price: 100, total_price: 700 },
    ],
  },
]

/* ─── SVG Icon Components ─────────────────────────────────────── */
const IconGrid = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const IconChevron = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const IconPrinter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)
const IconLogOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

/* ─── Utility: relative time ──────────────────────────────────── */
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

/* ─── Module nav items ────────────────────────────────────────── */
const MODULES = [
  { id: 'payments',   label: 'Payments',   icon: '💳' },
  { id: 'expenses',   label: 'Expenses',   icon: '📋' },
  { id: 'treatments', label: 'Treatments', icon: '💊' },
  { id: 'close_day',  label: 'Close Day',  icon: '🔒' },
]

const EXPENSE_CATS = ['Fuel / Generator','Water','Transport','Staff Expenses','Repairs & Maintenance','Supplies','Misc']
const PAY_METHODS  = ['Cash','POS','Transfer','Credit']

/* ═══════════════════════════════════════════════════════════════
   CASHIER PAGE — Premium Desktop POS
   ═══════════════════════════════════════════════════════════════ */
export default function CashierPage() {
  const navigate  = useNavigate()
  const { logout, user, fullName, username } = useAuth()

  /* ── Module & Queue state ─────────────────────────────────── */
  const [activeModule, setActiveModule] = useState('payments')
  const [queueTab, setQueueTab]         = useState('waiting')
  const [orders, setOrders]             = useState(INITIAL_MOCK_ORDERS)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  /* ── Payment state ────────────────────────────────────────── */
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState([])
  const [paymentAmounts, setPaymentAmounts] = useState({ Cash:'', POS:'', Transfer:'', Credit:'' })
  const [receiptOrder, setReceiptOrder] = useState(null)

  /* ── Expenses state ───────────────────────────────────────── */
  const [expenses, setExpenses] = useState([
    { id:'exp-1', category:'Fuel / Generator', amount:3500, payment_method:'Cash',
      note:'Petrol for generator evening', recorded_by:'Cashier', created_at: new Date().toISOString() },
  ])
  const [expCategory, setExpCategory] = useState('Fuel / Generator')
  const [expAmount, setExpAmount]     = useState('')
  const [expMethod, setExpMethod]     = useState('Cash')
  const [expNote, setExpNote]         = useState('')

  /* ── Treatments state ─────────────────────────────────────── */
  const [treatments, setTreatments] = useState([
    { id:'treat-1', patient_name:'Mrs. Florence Nnaji', patient_age:42, patient_weight:68,
      diagnosis:'Leg Ulcer Wound Dressing', drug_used:'Gauze, Iodine, Bandage, Ceftriaxone',
      amount_charged:6000, deposit_paid:3000, balance_remaining:3000,
      return_date:'2026-07-22', status:'active' },
  ])
  const [tName,setTName]=useState(''); const [tAge,setTAge]=useState('')
  const [tWeight,setTWeight]=useState(''); const [tDiagnosis,setTDiagnosis]=useState('')
  const [tDrug,setTDrug]=useState(''); const [tCharge,setTCharge]=useState('')
  const [tDeposit,setTDeposit]=useState(''); const [tReturnDate,setTReturnDate]=useState('')

  /* ── Close Day state ──────────────────────────────────────── */
  const [countedCash, setCountedCash]         = useState('')
  const [countedPos1, setCountedPos1]         = useState('')
  const [countedPos2, setCountedPos2]         = useState('')
  const [countedTransfer, setCountedTransfer] = useState('')
  const [changeFloat, setChangeFloat]         = useState('2000')
  const [dayLocked, setDayLocked]             = useState(false)

  /* ═══════ Data fetching ═══════════════════════════════════ */
  const loadOrders = useCallback(async () => {
    if (!supabase) return
    setLoadingOrders(true)
    try {
      const { data, error } = await supabase
        .from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false })
      if (!error && data?.length > 0) {
        setOrders(data)
        if (!selectedOrderId) {
          const first = data.find(o => o.status === 'waiting_for_payment')
          if (first) setSelectedOrderId(first.id)
        }
      }
    } catch { console.warn('Using mock orders queue') }
    finally { setLoadingOrders(false) }
  }, [selectedOrderId])

  useEffect(() => { loadOrders() }, [])

  /* ═══════ Derived data ════════════════════════════════════ */
  const waitingOrders = useMemo(() =>
    orders.filter(o => {
      const ok = o.status === 'waiting_for_payment' && !o.is_credit
      if (!searchQuery.trim()) return ok
      const q = searchQuery.toLowerCase()
      return ok && (String(o.order_number).includes(q) || o.attendant_name?.toLowerCase().includes(q))
    }), [orders, searchQuery])

  const creditOrders = useMemo(() =>
    orders.filter(o => {
      const ok = o.is_credit || o.customer_name
      if (!searchQuery.trim()) return ok
      const q = searchQuery.toLowerCase()
      return ok && (String(o.order_number).includes(q) || o.customer_name?.toLowerCase().includes(q) || o.customer_phone?.includes(q))
    }), [orders, searchQuery])

  const activeOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId])

  useEffect(() => {
    if (activeOrder) {
      const total = Number(activeOrder.total_amount)
      const amounts = { Cash:'', POS:'', Transfer:'', Credit:'' }
      selectedPaymentMethods.forEach(m => { amounts[m] = String(total) })
      setPaymentAmounts(amounts)
    }
  }, [activeOrder, selectedPaymentMethods])

  const enteredPaymentTotal = useMemo(() => {
    let sum = 0
    selectedPaymentMethods.forEach(m => { sum += Number(paymentAmounts[m]) || 0 })
    return sum
  }, [selectedPaymentMethods, paymentAmounts])

  const isBalanced = useMemo(() => {
    if (!activeOrder) return false
    return Math.abs(enteredPaymentTotal - Number(activeOrder.total_amount)) < 0.01
  }, [enteredPaymentTotal, activeOrder])

  /* System totals (Close Day) */
  const systemTotals = useMemo(() => {
    const paid = orders.filter(o => o.status === 'paid')
    let cash=0, pos1=0, pos2=0, transfer=0, credit=0
    paid.forEach(o => {
      if (o.payment_method === 'Cash') cash += Number(o.total_amount)
      else if (o.payment_method === 'POS' || o.payment_method === 'POS 1') pos1 += Number(o.total_amount)
      else if (o.payment_method === 'POS 2') pos2 += Number(o.total_amount)
      else if (o.payment_method === 'Transfer') transfer += Number(o.total_amount)
    })
    orders.filter(o => o.is_credit).forEach(o => { credit += Number(o.total_amount) })
    const totalExp = expenses.reduce((s,e) => s + Number(e.amount), 0)
    return { cash, pos1, pos2, transfer, credit, totalExp, grandTotal: cash+pos1+pos2+transfer-totalExp }
  }, [orders, expenses])

  const closeDayDifference = useMemo(() => {
    const total = (Number(countedCash)||0)+(Number(countedPos1)||0)+(Number(countedPos2)||0)+(Number(countedTransfer)||0)-(Number(changeFloat)||0)
    return total - systemTotals.grandTotal
  }, [countedCash,countedPos1,countedPos2,countedTransfer,changeFloat,systemTotals])

  /* ═══════ Actions ═════════════════════════════════════════ */
  const togglePaymentMethod = m => {
    setSelectedPaymentMethods(prev =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter(x=>x!==m) : prev) : [...prev, m])
  }

  const handleConfirmPayment = async () => {
    if (!activeOrder || !isBalanced) return
    const methodLabel = selectedPaymentMethods.join(' + ')
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status:'paid', payment_method:methodLabel } : o))
    if (supabase && !activeOrder.id.startsWith('mock'))
      await supabase.from('orders').update({ status:'paid', payment_method:methodLabel }).eq('id', activeOrder.id)
    setReceiptOrder({ ...activeOrder, payment_method: methodLabel })
    setSelectedOrderId(null)
    setSelectedPaymentMethods([])
  }

  const handleAddExpense = e => {
    e.preventDefault()
    if (!expAmount || Number(expAmount) <= 0) return
    setExpenses(prev => [{ id:'exp-'+Date.now(), category:expCategory, amount:Number(expAmount),
      payment_method:expMethod, note:expNote.trim(), recorded_by: fullName||username||'Cashier',
      created_at: new Date().toISOString() }, ...prev])
    setExpAmount(''); setExpNote('')
  }

  const handleAddTreatment = e => {
    e.preventDefault()
    if (!tName.trim() || !tDiagnosis.trim() || !tCharge) return
    const charge=Number(tCharge), deposit=Number(tDeposit)||0
    setTreatments(prev => [{ id:'treat-'+Date.now(), patient_name:tName.trim(), patient_age:Number(tAge)||null,
      patient_weight:Number(tWeight)||null, diagnosis:tDiagnosis.trim(), drug_used:tDrug.trim(),
      amount_charged:charge, deposit_paid:deposit, balance_remaining:charge-deposit,
      return_date:tReturnDate||null, status:'active' }, ...prev])
    setTName('');setTAge('');setTWeight('');setTDiagnosis('');setTDrug('');setTCharge('');setTDeposit('');setTReturnDate('')
  }

  const handleLogout = async () => { await logout(); navigate('/', { replace:true }) }

  /* ═══════ Render helpers ══════════════════════════════════ */
  const displayOrders = queueTab === 'waiting' ? waitingOrders : creditOrders
  const cashierName   = fullName || username || 'Blessing'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric' })

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-dvh flex flex-col" style={{ background:'linear-gradient(165deg, #0f1b3d 0%, #162557 35%, #1a3278 65%, #1e40af 100%)' }}>

      {/* ─── Top Header ─────────────────────────────────────── */}
      <header className="relative z-20 px-4 sm:px-8 pt-5 pb-4">
        {/* Decorative glow blobs */}
        <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full opacity-[.06] pointer-events-none"
          style={{ background:'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
        <div className="absolute -top-10 right-10 w-48 h-48 rounded-full opacity-[.04] pointer-events-none"
          style={{ background:'radial-gradient(circle, #93c5fd, transparent 70%)' }} />

        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          {/* Left: brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background:'linear-gradient(135deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 100%)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.12)' }}>
              <IconGrid />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-white tracking-tight leading-tight">
                Cashier · <span className="text-blue-200/90">{MODULES.find(m=>m.id===activeModule)?.label}</span>
              </h1>
              <p className="text-[11px] text-blue-300/60 font-medium">Emmanuel Pharmacy</p>
            </div>
          </div>

          {/* Right: user pill + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-blue-100/70 bg-white/[.07] border border-white/[.08] rounded-full px-4 py-2"
              style={{ backdropFilter:'blur(8px)' }}>
              <span className="text-[10px] text-blue-200/50">{dateStr}</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/90 font-semibold">{cashierName}</span>
              <span className="text-blue-200/40">·</span>
              <span className="text-blue-200/50">Till 2</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/90 transition-colors font-medium px-2 py-1.5 rounded-lg hover:bg-white/[.06]">
              <IconLogOut />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Module switcher tabs */}
        <nav className="max-w-[1440px] mx-auto mt-5 flex gap-1">
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setActiveModule(m.id)}
              className={`group relative px-5 py-2.5 rounded-t-2xl text-[12px] font-semibold transition-all duration-300 ${
                activeModule === m.id
                  ? 'text-neutral-900'
                  : 'text-blue-200/60 hover:text-white/90 hover:bg-white/[.06]'
              }`}>
              {activeModule === m.id && (
                <span className="absolute inset-0 rounded-t-2xl bg-[#eef1f8]" style={{ boxShadow:'0 -2px 12px rgba(0,0,0,.04)' }} />
              )}
              <span className="relative flex items-center gap-1.5">
                <span className="text-[13px]">{m.icon}</span>
                {m.label}
              </span>
            </button>
          ))}
        </nav>
      </header>

      {/* ─── Main Content Area ──────────────────────────────── */}
      <main className="flex-1 rounded-t-3xl relative z-10"
        style={{ background:'linear-gradient(180deg, #eef1f8 0%, #e8ecf4 100%)' }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 1 — CASHIER PAYMENTS                 ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'payments' && (
            <div className="flex flex-col lg:flex-row gap-5 items-start">

              {/* ── Left: Queue Sidebar ─────────────────────── */}
              <div className="cashier-slide-left w-full lg:w-[380px] shrink-0 glass-elevated rounded-2xl overflow-hidden">
                {/* Queue Tab Header */}
                <div className="flex border-b border-neutral-200/60">
                  {[
                    { key:'waiting', label:'Waiting for Payment', count: waitingOrders.length },
                    { key:'credit',  label:'Unpaid / Credit',     count: creditOrders.length },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setQueueTab(tab.key)}
                      className={`flex-1 py-3.5 flex items-center justify-center gap-2 text-[12px] font-semibold transition-all relative ${
                        queueTab === tab.key ? 'text-[#1e40af]' : 'text-neutral-400 hover:text-neutral-600'
                      }`}>
                      {tab.label}
                      <span className={`min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 transition-all ${
                        queueTab === tab.key
                          ? 'bg-[#1e40af] text-white shadow-sm shadow-blue-500/20'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}>{tab.count}</span>
                      {queueTab === tab.key && (
                        <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full bg-[#1e40af]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="px-4 pt-4 pb-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"><IconSearch /></span>
                    <input type="text" id="cashier-search-input"
                      placeholder="Search order number..."
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-neutral-100/70 border border-transparent rounded-xl text-[12px] font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:bg-white focus:border-blue-300 focus:shadow-sm focus:shadow-blue-100/50 transition-all"
                    />
                  </div>
                </div>

                {/* Order list */}
                <div className="px-3 pb-4 cashier-scroll overflow-y-auto" style={{ maxHeight:'calc(100vh - 320px)' }}>
                  {displayOrders.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-neutral-100 text-neutral-300 flex items-center justify-center text-lg">📭</div>
                      <p className="text-[12px] text-neutral-400 font-medium">No orders in queue</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {displayOrders.map((order, i) => {
                        const sel = order.id === selectedOrderId
                        return (
                          <button key={order.id}
                            onClick={() => { setSelectedOrderId(order.id); setSelectedPaymentMethods([]); }}
                            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all duration-200 group ${
                              sel
                                ? 'bg-blue-50 border border-blue-200/70 shadow-sm shadow-blue-100/40'
                                : 'bg-transparent border border-transparent hover:bg-white hover:border-neutral-200/60 hover:shadow-sm'
                            }`}
                            style={{ animationDelay: `${i * 50}ms` }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0 transition-all ${
                                sel
                                  ? 'bg-[#1e40af] text-white shadow-md shadow-blue-500/25'
                                  : 'bg-blue-50/80 text-[#1e40af] group-hover:bg-blue-100/80'
                              }`}>{order.order_number}</div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-neutral-900 text-[13px] truncate">
                                  Order #{order.order_number}
                                  {order.is_credit && <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md align-middle">CREDIT</span>}
                                </h3>
                                <p className="text-[11px] text-neutral-400 font-medium">
                                  {order.items?.length || 1} items · {timeAgo(order.created_at)}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-neutral-900 text-[13px] tabular-nums shrink-0 pl-2">
                              ₦{Number(order.total_amount).toLocaleString()}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: Payment Panel ────────────────────── */}
              <div className="cashier-slide-right flex-1 glass-elevated rounded-2xl min-h-[560px] flex flex-col">
                {!activeOrder ? (
                  /* ── Empty State ─────────────────────────── */
                  <div className="flex-1 flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/80 text-[#3b82f6] flex items-center justify-center mb-5 shadow-sm shadow-blue-100/40 animate-float">
                      <IconChevron />
                    </div>
                    <h3 className="font-bold text-neutral-800 text-lg mb-1.5 tracking-tight">Select an order to take payment</h3>
                    <p className="text-[13px] text-neutral-400 max-w-xs text-center leading-relaxed font-medium">
                      Pick an order from the queue on the left, or type its number in the search box.
                    </p>
                  </div>
                ) : (
                  /* ── Active Order ────────────────────────── */
                  <div className="flex flex-col h-full">
                    {/* Order header */}
                    <div className="p-6 pb-4 border-b border-neutral-200/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[.14em] block mb-0.5">ORDER</span>
                          <h2 className="text-[38px] font-extrabold text-neutral-900 tracking-tighter leading-none">
                            #{activeOrder.order_number}
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-blue-500 block">
                            {activeOrder.items?.length || 1} items
                          </span>
                          <span className="text-[11px] text-neutral-400">{timeAgo(activeOrder.created_at)}</span>
                          {activeOrder.attendant_name && (
                            <span className="block text-[10px] text-neutral-300 mt-0.5">by {activeOrder.attendant_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    <div className="flex-1 px-6 py-4 cashier-scroll overflow-y-auto">
                      <div className="space-y-0">
                        {activeOrder.items?.map((item, idx) => (
                          <div key={idx}
                            className="flex items-center justify-between py-3 border-b border-neutral-100/80 last:border-b-0 group/item">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-50 text-neutral-600 font-bold text-[11px] flex items-center justify-center border border-neutral-200/40 group-hover/item:border-blue-200 group-hover/item:text-blue-600 transition-colors">
                                {item.quantity}
                              </span>
                              <div>
                                <h4 className="font-semibold text-neutral-900 text-[13px]">{item.product_name}</h4>
                                <p className="text-[11px] text-neutral-400">₦{Number(item.unit_price).toLocaleString()} each</p>
                              </div>
                            </div>
                            <span className="font-bold text-neutral-800 text-[13px] tabular-nums">
                              ₦{(Number(item.total_price) || Number(item.unit_price) * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment footer */}
                    <div className="border-t border-neutral-200/50 p-6 space-y-5"
                      style={{ background:'linear-gradient(180deg, rgba(248,250,255,.8) 0%, rgba(255,255,255,.95) 100%)' }}>

                      {/* Total */}
                      <div className="flex items-end justify-between">
                        <span className="text-neutral-500 font-medium text-[13px]">Total due</span>
                        <span className="text-[36px] font-black text-neutral-900 tracking-tight leading-none tabular-nums">
                          ₦{Number(activeOrder.total_amount).toLocaleString()}
                        </span>
                      </div>

                      {/* Payment method pills */}
                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-[.14em] block mb-2.5">
                          Payment Method · Select one or more to split
                        </label>
                        <div className="grid grid-cols-4 gap-2.5">
                          {PAY_METHODS.map(m => {
                            const active = selectedPaymentMethods.includes(m)
                            return (
                              <button key={m} type="button" onClick={() => togglePaymentMethod(m)}
                                className={`h-11 rounded-xl font-semibold text-[13px] border-2 transition-all duration-200 ${
                                  active
                                    ? 'bg-[#1e40af] text-white border-[#1e40af] shadow-lg shadow-blue-500/20 scale-[1.02]'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40'
                                }`}>
                                {m}
                              </button>
                            )
                          })}
                        </div>

                        {/* Payment amount inputs */}
                        {selectedPaymentMethods.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 justify-center animate-fade-in">
                            {selectedPaymentMethods.map(m => (
                              <div key={m} className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-[12px]">₦</span>
                                <input type="number"
                                  value={paymentAmounts[m] || ''}
                                  onChange={e => setPaymentAmounts(prev => ({...prev, [m]: e.target.value }))}
                                  placeholder={m}
                                  className="w-36 h-10 pl-7 pr-3 bg-white border-2 border-neutral-200 rounded-xl font-bold text-[13px] text-center text-neutral-900 outline-none focus:border-[#1e40af] focus:shadow-sm focus:shadow-blue-100/50 transition-all tabular-nums"
                                />
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-white text-neutral-400 px-1.5 rounded">{m}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Balance indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-neutral-400 font-medium tabular-nums">
                          Entered ₦{enteredPaymentTotal.toLocaleString()}
                        </span>
                        {selectedPaymentMethods.length > 0 && (
                          isBalanced ? (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full cashier-ping">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Balanced ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                              <span className="w-2 h-2 rounded-full bg-red-400" />
                              Gap: ₦{Math.abs(Number(activeOrder.total_amount) - enteredPaymentTotal).toLocaleString()}
                            </span>
                          )
                        )}
                      </div>

                      {/* Confirm button */}
                      <button onClick={handleConfirmPayment} disabled={!isBalanced} id="confirm-print-receipt-button"
                        className={`w-full h-[52px] font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300 ${
                          isBalanced
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 active:scale-[.98] hover:scale-[1.01]'
                            : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        }`}>
                        <IconPrinter />
                        Confirm & Print Receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 2 — EXPENSES LOG                     ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 cashier-slide-left">
              {/* Add expense form */}
              <div className="glass-elevated rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-[15px] font-bold text-neutral-900 mb-0.5">Log Shop Expense</h2>
                  <p className="text-[11px] text-neutral-400">Record any outgoing cash or POS payment.</p>
                </div>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1.5">Expense Category *</label>
                    <select value={expCategory} onChange={e=>setExpCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] font-medium outline-none focus:border-blue-400 transition-colors">
                      {EXPENSE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1.5">Amount (₦) *</label>
                    <input type="number" placeholder="e.g. 3500" required value={expAmount} onChange={e=>setExpAmount(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] font-bold outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1.5">Payment Method *</label>
                    <select value={expMethod} onChange={e=>setExpMethod(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] font-medium outline-none focus:border-blue-400 transition-colors">
                      {['Cash','POS','POS 2','Transfer'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1.5">Note</label>
                    <input type="text" placeholder="e.g. Petrol for generator" value={expNote} onChange={e=>setExpNote(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <button type="submit"
                    className="w-full h-11 bg-gradient-to-r from-neutral-800 to-neutral-900 hover:from-neutral-900 hover:to-black text-white font-bold text-[12px] rounded-xl shadow-md shadow-neutral-400/15 transition-all active:scale-[.98]">
                    Save Expense
                  </button>
                </form>
              </div>

              {/* Expenses table */}
              <div className="lg:col-span-2 glass-elevated rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-[15px] font-bold text-neutral-900">Today's Expenses</h2>
                    <p className="text-[11px] text-neutral-400">Deducted automatically during Close Day.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 font-medium block">Total Today</span>
                    <span className="text-[22px] font-black text-red-500 tabular-nums">
                      ₦{expenses.reduce((s,e)=>s+Number(e.amount),0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-neutral-100">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="bg-neutral-50/80 text-neutral-500 font-semibold text-[10px] uppercase tracking-wider">
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Note</th>
                        <th className="px-4 py-3">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100/80">
                      {expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-neutral-900">{exp.category}</td>
                          <td className="px-4 py-3 font-bold text-red-500 tabular-nums">₦{Number(exp.amount).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-semibold">{exp.payment_method}</span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{exp.note || '—'}</td>
                          <td className="px-4 py-3 text-neutral-400">{exp.recorded_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 3 — TREATMENTS                       ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'treatments' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 cashier-slide-left">
              {/* Add Treatment Form */}
              <div className="glass-elevated rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-neutral-900 mb-0.5">Record Treatment</h2>
                  <p className="text-[11px] text-neutral-400">Log wound dressing, injections, or procedures.</p>
                </div>
                <form onSubmit={handleAddTreatment} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Patient Name *</label>
                    <input type="text" required placeholder="e.g. Mrs. Florence Nnaji" value={tName} onChange={e=>setTName(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Age</label>
                      <input type="number" placeholder="42" value={tAge} onChange={e=>setTAge(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Weight (kg)</label>
                      <input type="number" placeholder="68" value={tWeight} onChange={e=>setTWeight(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Diagnosis / Treatment *</label>
                    <input type="text" required placeholder="e.g. Leg Ulcer Wound Dressing" value={tDiagnosis} onChange={e=>setTDiagnosis(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Drugs & Supplies Used</label>
                    <input type="text" placeholder="e.g. Gauze, Iodine, Bandage" value={tDrug} onChange={e=>setTDrug(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Total Charge (₦) *</label>
                      <input type="number" required placeholder="6000" value={tCharge} onChange={e=>setTCharge(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] font-bold outline-none focus:border-blue-400 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Deposit Paid (₦)</label>
                      <input type="number" placeholder="3000" value={tDeposit} onChange={e=>setTDeposit(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] font-bold text-emerald-600 outline-none focus:border-blue-400 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Return Visit Date</label>
                    <input type="date" value={tReturnDate} onChange={e=>setTReturnDate(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <button type="submit"
                    className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold text-[12px] rounded-xl shadow-md shadow-purple-400/15 transition-all active:scale-[.98] mt-1">
                    Save Treatment Record
                  </button>
                </form>
              </div>

              {/* Treatments list */}
              <div className="lg:col-span-2 glass-elevated rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-neutral-900">Active Patient Treatments</h2>
                  <p className="text-[11px] text-neutral-400">Track deposits, balances, and return visit schedules.</p>
                </div>
                <div className="space-y-3">
                  {treatments.map(t => (
                    <div key={t.id} className="p-4 rounded-xl border border-neutral-200/60 bg-gradient-to-r from-white to-neutral-50/50 flex flex-col md:flex-row justify-between gap-4 hover:shadow-sm transition-all">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-neutral-900 text-[13px]">{t.patient_name}</h3>
                          {t.patient_age && <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">({t.patient_age}yrs, {t.patient_weight||'—'}kg)</span>}
                        </div>
                        <p className="text-[12px] font-semibold text-purple-700">{t.diagnosis}</p>
                        <p className="text-[11px] text-neutral-500">Drugs: {t.drug_used}</p>
                        {t.return_date && (
                          <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                            <span>📅</span> Return: {t.return_date}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex flex-col justify-between items-end shrink-0">
                        <div>
                          <span className="text-[10px] text-neutral-400 font-medium block">Balance</span>
                          <span className="text-xl font-black text-red-500 tabular-nums">₦{t.balance_remaining.toLocaleString()}</span>
                          <span className="text-[10px] text-neutral-400 block">Charged: ₦{t.amount_charged.toLocaleString()} | Deposit: ₦{t.deposit_paid.toLocaleString()}</span>
                        </div>
                        {t.balance_remaining > 0 && (
                          <button onClick={() => {
                            const p = prompt(`Collect balance for ${t.patient_name} (₦${t.balance_remaining}):`, t.balance_remaining)
                            if (p && !isNaN(p)) {
                              const amt = Number(p)
                              setTreatments(prev => prev.map(item => item.id === t.id
                                ? { ...item, deposit_paid: item.deposit_paid+amt, balance_remaining: item.amount_charged-(item.deposit_paid+amt) }
                                : item))
                            }
                          }}
                            className="mt-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-[11px] rounded-lg hover:shadow-md hover:shadow-emerald-400/20 transition-all active:scale-[.97]">
                            Collect Balance
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 4 — CLOSE DAY                        ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'close_day' && (
            <div className="glass-elevated rounded-2xl p-6 sm:p-8 space-y-6 cashier-slide-left max-w-5xl mx-auto">
              <div>
                <h2 className="text-[16px] font-bold text-neutral-900">Daily Cashier Reconciliation</h2>
                <p className="text-[12px] text-neutral-400">Compare system figures against hand-counted totals. Any gap is highlighted.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System figures */}
                <div className="bg-gradient-to-br from-blue-50/70 to-blue-100/30 p-5 rounded-xl border border-blue-200/30 space-y-3">
                  <h3 className="font-bold text-[10px] uppercase tracking-[.14em] text-blue-800/50 border-b border-blue-200/30 pb-2">System Calculated</h3>
                  <div className="space-y-2 text-[12px]">
                    {[
                      ['Expected Cash', systemTotals.cash],
                      ['Expected POS 1', systemTotals.pos1],
                      ['Expected POS 2', systemTotals.pos2],
                      ['Expected Transfer', systemTotals.transfer],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-neutral-600">{label}</span>
                        <span className="font-bold tabular-nums">₦{val.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>Credit Owed</span>
                      <span className="tabular-nums">₦{systemTotals.credit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-500 border-t border-blue-200/30 pt-2">
                      <span>Less Expenses</span>
                      <span className="font-bold tabular-nums">- ₦{systemTotals.totalExp.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[14px] font-black text-[#1e40af] border-t border-blue-300/30 pt-2">
                      <span>System Net</span>
                      <span className="tabular-nums">₦{systemTotals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Hand counted */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[10px] uppercase tracking-[.14em] text-neutral-400 border-b border-neutral-200/60 pb-2">Hand-Counted Figures</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Physical Cash', countedCash, setCountedCash],
                      ['POS 1 Slip', countedPos1, setCountedPos1],
                      ['POS 2 Slip', countedPos2, setCountedPos2],
                      ['Transfer Slip', countedTransfer, setCountedTransfer],
                    ].map(([label, val, setter]) => (
                      <div key={label}>
                        <label className="text-[11px] font-semibold text-neutral-600 block mb-1">{label} (₦)</label>
                        <input type="number" placeholder="0" value={val} onChange={e=>setter(e.target.value)}
                          className="w-full h-10 px-3 border border-neutral-200 rounded-xl text-[12px] font-bold outline-none focus:border-blue-400 transition-colors tabular-nums" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 block mb-1">Change Float (₦)</label>
                    <input type="number" placeholder="2000" value={changeFloat} onChange={e=>setChangeFloat(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-200 rounded-xl text-[12px] font-bold outline-none focus:border-blue-400 transition-colors tabular-nums" />
                  </div>

                  {/* Gap indicator */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    closeDayDifference === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : closeDayDifference < 0
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}>
                    <div>
                      <span className="font-bold text-[11px] block">Reconciliation Gap</span>
                      <span className="text-[10px] opacity-70">
                        {closeDayDifference === 0 ? 'Perfect match!' : closeDayDifference < 0 ? `Shortage ₦${Math.abs(closeDayDifference).toLocaleString()}` : `Overage ₦${closeDayDifference.toLocaleString()}`}
                      </span>
                    </div>
                    <span className="text-[22px] font-black tabular-nums">₦{closeDayDifference.toLocaleString()}</span>
                  </div>

                  <button onClick={() => setDayLocked(true)} disabled={dayLocked}
                    className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-[13px] rounded-xl shadow-lg shadow-red-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]">
                    {dayLocked ? '✓ Day Locked & Submitted' : 'Lock Day & Submit Summary'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ╔═══════════════════════════════════════════════════╗
         ║  RECEIPT MODAL                                   ║
         ╚═══════════════════════════════════════════════════╝ */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.6)', backdropFilter:'blur(6px)' }}>
          <div className="cashier-scale-fade glass-elevated rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="receipt-paper border border-dashed border-neutral-300 p-5 rounded-xl bg-white font-mono text-[12px] text-neutral-800 space-y-2">
              <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 pb-3">
                <h2 className="font-bold text-[14px] text-black tracking-wide">EMMANUEL PHARMACY</h2>
                <p className="text-[10px] text-neutral-500">Quality Care & Genuine Medicines</p>
                <p className="text-[10px] text-neutral-500">Tel: 080-EMMANUEL</p>
              </div>
              <div className="flex justify-between text-[11px] font-bold border-b border-dashed border-neutral-300 pb-2 pt-1">
                <span>ORDER #{receiptOrder.order_number}</span>
                <span>{new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
              </div>
              <div className="text-[10px] space-y-0.5 py-1">
                <p>Date: {new Date().toLocaleDateString()}</p>
                <p>Attendant: {receiptOrder.attendant_name}</p>
                <p>Cashier: {cashierName}</p>
              </div>
              <div className="border-t border-b border-dashed border-neutral-300 py-2 space-y-1">
                {receiptOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="tabular-nums">₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1 space-y-1">
                <div className="flex justify-between font-bold text-[13px] text-black">
                  <span>TOTAL PAID</span>
                  <span className="tabular-nums">₦{Number(receiptOrder.total_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Method:</span>
                  <span className="font-semibold">{receiptOrder.payment_method}</span>
                </div>
              </div>
              <div className="text-center pt-3 border-t border-dashed border-neutral-300 text-[10px] text-neutral-400">
                <p>Thank you for your patronage!</p>
                <p>No refund without receipt</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReceiptOrder(null)}
                className="flex-1 h-10 border border-neutral-200 rounded-xl font-semibold text-[12px] text-neutral-600 hover:bg-neutral-50 transition-colors">
                Close
              </button>
              <button onClick={() => { window.print(); setReceiptOrder(null) }}
                className="flex-1 h-10 bg-gradient-to-r from-[#1e40af] to-blue-700 text-white font-bold text-[12px] rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 hover:shadow-lg transition-all active:scale-[.98]">
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
