import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/* ─── Initial orders (empty, fetched live from Supabase) ────────── */
const INITIAL_MOCK_ORDERS = []


/* ─── Utility: relative & server timezone date helpers ─────────── */
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

const isToday = (isoDate) => {
  if (!isoDate) return true
  const d = new Date(isoDate)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  const orderStr = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  return todayStr === orderStr
}

const formatPastDate = (isoDate) => {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' })
}

/* ─── Constants ───────────────────────────────────────────────── */
const MODULES = [
  { id: 'payments',   label: 'Payments',   icon: '💳' },
  { id: 'expenses',   label: 'Expenses',   icon: '📋' },
  { id: 'treatments', label: 'Treatments', icon: '💊' },
  { id: 'close_day',  label: 'Close Day',  icon: '🔒' },
]
const EXPENSE_CATS = ['Fuel / Generator','Water','Transport','Staff Expenses','Repairs & Maintenance','Supplies','Misc']
const PAY_METHODS  = ['Cash','POS','Transfer','Credit']

/* ─── Shared Styles Object ────────────────────────────────────── */
const S = {
  card: {
    background: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02), 0 8px 32px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  input: {
    width: '100%',
    height: '48px',
    padding: '0 16px',
    background: '#f8f9fa',
    border: '1.5px solid #e8eaed',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#1a1a2e',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4a4a68',
    marginBottom: '8px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontSize: '13px',
    color: '#8b8ba3',
    marginTop: '2px',
  },
}

/* ═══════════════════════════════════════════════════════════════
   CASHIER PAGE — Premium Desktop POS
   ═══════════════════════════════════════════════════════════════ */
export default function CashierPage() {
  const navigate  = useNavigate()
  const { logout, user, fullName, username } = useAuth()

  /* ── State ────────────────────────────────────────────────── */
  const [activeModule, setActiveModule] = useState('payments')
  const [queueTab, setQueueTab]         = useState('waiting')
  const [orders, setOrders]             = useState(INITIAL_MOCK_ORDERS)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState([])
  const [paymentAmounts, setPaymentAmounts] = useState({ Cash:'', POS:'', Transfer:'', Credit:'' })
  const [customerName, setCustomerName]       = useState('')
  const [customerPhone, setCustomerPhone]      = useState('')
  const [receiptOrder, setReceiptOrder] = useState(null)
  const [paymentError, setPaymentError] = useState(null)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const prevSelectedOrderIdRef = useRef(null)

  const [expenses, setExpenses] = useState([
    { id:'exp-1', category:'Fuel / Generator', amount:3500, payment_method:'Cash',
      note:'Petrol for generator evening', recorded_by:'Cashier', created_at: new Date().toISOString() },
  ])
  const [expCategory, setExpCategory] = useState('Fuel / Generator')
  const [expAmount, setExpAmount]     = useState('')
  const [expMethod, setExpMethod]     = useState('Cash')
  const [expNote, setExpNote]         = useState('')

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

  const [countedCash, setCountedCash]         = useState('')
  const [countedPos1, setCountedPos1]         = useState('')
  const [countedPos2, setCountedPos2]         = useState('')
  const [countedTransfer, setCountedTransfer] = useState('')
  const [changeFloat, setChangeFloat]         = useState('2000')
  const [dayLocked, setDayLocked]             = useState(false)

  const [inputFocus, setInputFocus] = useState(null) // track which input is focused

  const [lastCloseAt, setLastCloseAt]         = useState(null)
  const [creditRepayments, setCreditRepayments] = useState([])

  /* ═══════ Data fetching ═══════════════════════════════════ */
  const loadOrders = useCallback(async () => {
    if (!supabase) return
    setLoadingOrders(true)
    try {
      const { data, error } = await supabase
        .from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false })
      if (!error && data?.length > 0) {
        setOrders(data)
        setSelectedOrderId(prevId => {
          if (prevId && data.some(o => o.id === prevId && o.status !== 'paid' && o.status !== 'cancelled')) return prevId
          const first = data.find(o => o.status === 'waiting_for_payment')
          return first ? first.id : null
        })
      }
    } catch { console.warn('Using orders queue') }
    finally { setLoadingOrders(false) }
  }, [])

  const loadLastDayClose = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('day_closes')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (data?.length > 0) {
        setLastCloseAt(data[0].created_at)
      }
    } catch { console.warn('No previous day close found') }
  }, [])

  const loadCreditRepayments = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('credit_repayments')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setCreditRepayments(data)
    } catch { console.warn('Could not load credit repayments') }
  }, [])

  useEffect(() => {
    loadOrders()
    loadLastDayClose()
    loadCreditRepayments()

    const interval = setInterval(() => {
      loadOrders()
      loadCreditRepayments()
    }, 3000)

    return () => clearInterval(interval)
  }, [loadOrders, loadLastDayClose, loadCreditRepayments])

  /* ═══════ Derived data ════════════════════════════════════ */
  const waitingOrders = useMemo(() =>
    orders.filter(o => {
      const ok = o.status === 'waiting_for_payment' && !o.is_credit
      if (!searchQuery.trim()) return ok
      const q = searchQuery.toLowerCase().trim()
      const numStr = String(o.order_number)
      return ok && (numStr.includes(q) || (`#${numStr}`).includes(q) || o.attendant_name?.toLowerCase().includes(q))
    }), [orders, searchQuery])

  const creditOrders = useMemo(() =>
    orders.filter(o => {
      const ok = (o.is_credit || o.customer_name) && o.status !== 'paid' && o.status !== 'cancelled'
      if (!searchQuery.trim()) return ok
      const q = searchQuery.toLowerCase().trim()
      const numStr = String(o.order_number)
      return ok && (numStr.includes(q) || (`#${numStr}`).includes(q) || o.customer_name?.toLowerCase().includes(q) || o.customer_phone?.includes(q))
    }), [orders, searchQuery])

  const displayOrders = useMemo(() => queueTab === 'waiting' ? waitingOrders : creditOrders, [queueTab, waitingOrders, creditOrders])

  // Split queue into Today's orders and Past Days / Stale orders
  const { todayOrders, pastOrders } = useMemo(() => {
    const today = []
    const past = []
    displayOrders.forEach(o => {
      if (isToday(o.created_at)) today.push(o)
      else past.push(o)
    })
    return { todayOrders: today, pastOrders: past }
  }, [displayOrders])

  const activeOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId])

  // Auto-select first matching order when searching if active order is not in search results
  useEffect(() => {
    if (searchQuery.trim() && displayOrders.length > 0) {
      if (!displayOrders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(displayOrders[0].id)
      }
    }
  }, [searchQuery, displayOrders, selectedOrderId])

  const handleCancelOrder = async (e, orderId) => {
    e.stopPropagation()
    if (!window.confirm('Cancel this stale order? It will be removed from the queue.')) return
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
    setSelectedOrderId(prev => prev === orderId ? null : prev)
    if (supabase && !orderId.startsWith('mock')) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    }
  }

  // Reset selected methods and typed amounts ONLY when cashier switches to a DIFFERENT order ID
  useEffect(() => {
    if (prevSelectedOrderIdRef.current !== selectedOrderId) {
      prevSelectedOrderIdRef.current = selectedOrderId
      setSelectedPaymentMethods([])
      setPaymentAmounts({ Cash:'', POS:'', Transfer:'', Credit:'' })
      setPaymentError(null)
      if (activeOrder) {
        setCustomerName(activeOrder.customer_name || '')
        setCustomerPhone(activeOrder.customer_phone || '')
      } else {
        setCustomerName('')
        setCustomerPhone('')
      }
    }
  }, [selectedOrderId, activeOrder])

  // Auto-fill full total only when a single method is selected; keep typed amounts when methods are split
  useEffect(() => {
    if (activeOrder && selectedPaymentMethods.length === 1) {
      const singleMethod = selectedPaymentMethods[0]
      const totalStr = String(activeOrder.total_amount)
      setPaymentAmounts({
        Cash: singleMethod === 'Cash' ? totalStr : '',
        POS: singleMethod === 'POS' ? totalStr : '',
        Transfer: singleMethod === 'Transfer' ? totalStr : '',
        Credit: singleMethod === 'Credit' ? totalStr : '',
      })
    }
  }, [activeOrder, selectedPaymentMethods])

  const enteredPaymentTotal = useMemo(() => {
    let sum = 0
    selectedPaymentMethods.forEach(m => { sum += Number(paymentAmounts[m]) || 0 })
    return sum
  }, [selectedPaymentMethods, paymentAmounts])

  const hasCreditSelected = selectedPaymentMethods.includes('Credit')
  const isCreditValid = !hasCreditSelected || (customerName.trim().length > 0 && customerPhone.trim().length > 0)

  const isBalanced = useMemo(() => {
    if (!activeOrder) return false
    return Math.abs(enteredPaymentTotal - Number(activeOrder.total_amount)) < 0.01 && isCreditValid
  }, [enteredPaymentTotal, activeOrder, isCreditValid])

  // System totals cover all activity since PREVIOUS day-close (paid_at > lastCloseAt), with split breakdowns & credit repayments
  const systemTotals = useMemo(() => {
    const paid = orders.filter(o => {
      if (o.status !== 'paid') return false
      if (!lastCloseAt) return true
      const paidTime = o.paid_at || o.updated_at || o.created_at
      return new Date(paidTime) > new Date(lastCloseAt)
    })

    let cash=0, pos1=0, pos2=0, transfer=0, credit=0

    // 1. Sum paid orders using payment_breakdown JSONB or payment_method fallback (all POS machines unified into pos1)
    paid.forEach(o => {
      if (o.payment_breakdown && typeof o.payment_breakdown === 'object' && Object.keys(o.payment_breakdown).length > 0) {
        Object.entries(o.payment_breakdown).forEach(([method, amt]) => {
          const numAmt = Number(amt) || 0
          if (method === 'Cash') cash += numAmt
          else if (method === 'POS' || method === 'POS 1' || method === 'POS 2') pos1 += numAmt
          else if (method === 'Transfer') transfer += numAmt
        })
      } else {
        if (o.payment_method === 'Cash') cash += Number(o.total_amount)
        else if (o.payment_method === 'POS' || o.payment_method === 'POS 1' || o.payment_method === 'POS 2') pos1 += Number(o.total_amount)
        else if (o.payment_method === 'Transfer') transfer += Number(o.total_amount)
        else cash += Number(o.total_amount)
      }
    })

    // 2. Include credit_repayments collected within window (created_at > lastCloseAt)
    const relevantRepayments = creditRepayments.filter(cr => {
      if (!lastCloseAt) return true
      return new Date(cr.created_at) > new Date(lastCloseAt)
    })
    relevantRepayments.forEach(cr => {
      const amt = Number(cr.amount_paid) || 0
      if (cr.payment_method === 'Cash') cash += amt
      else if (cr.payment_method === 'POS 1' || cr.payment_method === 'POS 2' || cr.payment_method === 'POS') pos1 += amt
      else if (cr.payment_method === 'Transfer') transfer += amt
    })

    // 3. Relevant credit issued within window (counted ONLY when status is 'paid' or finalized, windowed by paid_at > lastCloseAt)
    const relevantCredit = orders.filter(o => {
      if (o.status !== 'paid') return false
      if (!lastCloseAt) return true
      const paidTime = o.paid_at || o.updated_at || o.created_at
      return new Date(paidTime) > new Date(lastCloseAt)
    })
    relevantCredit.forEach(o => {
      if (o.payment_breakdown && typeof o.payment_breakdown === 'object' && o.payment_breakdown.Credit != null) {
        credit += Number(o.payment_breakdown.Credit) || 0
      } else if (o.is_credit) {
        credit += Number(o.total_amount) || 0
      }
    })

    // 4. Relevant expenses within window
    const relevantExpenses = expenses.filter(e => {
      if (!lastCloseAt) return true
      return new Date(e.created_at) > new Date(lastCloseAt)
    })
    const totalExp = relevantExpenses.reduce((s,e) => s + Number(e.amount), 0)

    return { cash, pos1, pos2: 0, transfer, credit, totalExp, grandTotal: cash+pos1+transfer-totalExp, previousCloseAt: lastCloseAt }
  }, [orders, expenses, creditRepayments, lastCloseAt])

  const closeDayDifference = useMemo(() => {
    const total = (Number(countedCash)||0)+(Number(countedPos1)||0)+(Number(countedTransfer)||0)-(Number(changeFloat)||0)
    return total - systemTotals.grandTotal
  }, [countedCash,countedPos1,countedTransfer,changeFloat,systemTotals])

  /* ═══════ Actions ═════════════════════════════════════════ */
  const togglePaymentMethod = m => {
    setSelectedPaymentMethods(prev =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter(x=>x!==m) : prev) : [...prev, m])
  }

  const handleConfirmPayment = async () => {
    if (!activeOrder || !isBalanced || isSubmittingPayment) return
    const hasCredit = selectedPaymentMethods.includes('Credit')
    if (hasCredit && (!customerName.trim() || !customerPhone.trim())) return

    setIsSubmittingPayment(true)
    setPaymentError(null)

    const methodLabel = selectedPaymentMethods.join(' + ')
    const breakdownObj = {}
    selectedPaymentMethods.forEach(m => {
      const amt = Number(paymentAmounts[m]) || (selectedPaymentMethods.length === 1 ? Number(activeOrder.total_amount) : 0)
      if (amt > 0) breakdownObj[m] = amt
    })

    const updatePayload = {
      status: 'paid',
      payment_method: methodLabel,
      payment_breakdown: breakdownObj,
      is_credit: hasCredit,
      customer_name: hasCredit ? customerName.trim() : (activeOrder.customer_name || null),
      customer_phone: hasCredit ? customerPhone.trim() : (activeOrder.customer_phone || null),
    }

    try {
      if (supabase && typeof activeOrder.id === 'string' && !activeOrder.id.startsWith('mock')) {
        const { data, error } = await supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', activeOrder.id)
          .select()

        if (error || !data || data.length === 0) {
          const detail = error ? (error.message || error.details || error.code || JSON.stringify(error)) : '0 rows updated by database (check user role or permissions)'
          console.error('Payment confirmation error on Supabase update:', error || '0 rows updated', data)
          setPaymentError(`Payment failed to save to server: ${detail}. The order remains in the queue.`)
          setIsSubmittingPayment(false)
          return
        }

        const confirmedOrder = data[0]
        const savedRow = { ...activeOrder, ...confirmedOrder, items: activeOrder.items }

        // Notify Admin of Credit Sale
        if (hasCredit) {
          try {
            await supabase.from('notifications').insert({
              type: 'credit_sale',
              title: '⚠️ Credit Sale Processed',
              message: `Cashier ${fullName || username || 'Cashier'} processed a Credit Sale of ₦${Number(activeOrder.total_amount).toLocaleString()} for ${customerName.trim()} (${customerPhone.trim()}) on Order #${activeOrder.order_number}`,
              data: {
                order_id: activeOrder.id,
                order_number: activeOrder.order_number,
                total_amount: activeOrder.total_amount,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                cashier_name: fullName || username || 'Cashier',
              }
            })
          } catch (notifErr) {
            console.warn('Could not insert credit sale admin notification:', notifErr)
          }
        }

        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, ...savedRow } : o))
        setReceiptOrder(savedRow)
        setSelectedOrderId(null)
        setSelectedPaymentMethods([])
      } else {
        const savedRow = { ...activeOrder, ...updatePayload }
        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, ...savedRow } : o))
        setReceiptOrder(savedRow)
        setSelectedOrderId(null)
        setSelectedPaymentMethods([])
      }
    } catch (err) {
      console.error('Payment confirmation exception:', err)
      setPaymentError(`Payment failed: ${err.message || 'Network error'}. Order remains in queue.`)
    } finally {
      setIsSubmittingPayment(false)
    }
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
  const cashierName   = fullName || username || 'Blessing'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric' })

  /* Reusable input style with focus highlight */
  const getInputStyle = (name) => ({
    ...S.input,
    borderColor: inputFocus === name ? '#1e40af' : '#e8eaed',
    boxShadow: inputFocus === name ? '0 0 0 3px rgba(30,64,175,0.08)' : 'none',
  })

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', background:'#f0ede6' }}>

      {/* ─── TOP HEADER BAR ──────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(135deg, #0f1f4e 0%, #1a2f6b 50%, #1e40af 100%)',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{
            width:'38px', height:'38px', borderRadius:'10px',
            background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize:'17px', fontWeight:'700', color:'white', letterSpacing:'-0.01em', lineHeight:'1.2' }}>
              Cashier · <span style={{ color:'rgba(191,219,254,0.85)' }}>{MODULES.find(m=>m.id===activeModule)?.label}</span>
            </h1>
            <p style={{ fontSize:'11px', color:'rgba(147,197,253,0.5)', fontWeight:'500' }}>Emmanuel Pharmacy</p>
          </div>
        </div>

        {/* Right: user info */}
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:'10px',
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'999px', padding:'6px 18px', fontSize:'12px', color:'rgba(255,255,255,0.7)',
          }}>
            <span style={{ fontSize:'11px', color:'rgba(191,219,254,0.4)' }}>{dateStr}</span>
            <span style={{ width:'1px', height:'14px', background:'rgba(255,255,255,0.1)' }} />
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#34d399' }} />
            <span style={{ color:'white', fontWeight:'600' }}>{cashierName}</span>
            <span style={{ color:'rgba(191,219,254,0.3)' }}>·</span>
            <span style={{ color:'rgba(191,219,254,0.4)' }}>Till 2</span>
          </div>
          <button onClick={handleLogout} style={{
            display:'flex', alignItems:'center', gap:'6px',
            background:'none', border:'none', cursor:'pointer',
            fontSize:'12px', color:'rgba(255,255,255,0.4)', fontFamily:'inherit',
            padding:'6px 8px', borderRadius:'8px', transition:'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,0.9)'; e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.4)'; e.currentTarget.style.background='none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── MODULE TAB BAR ──────────────────────────────── */}
      <nav style={{
        background: '#1a2f6b',
        padding: '0 32px',
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
            padding: '12px 24px',
            fontSize: '13px',
            fontWeight: activeModule === m.id ? '700' : '500',
            fontFamily: 'inherit',
            background: activeModule === m.id ? '#f0ede6' : 'transparent',
            color: activeModule === m.id ? '#1a1a2e' : 'rgba(191,219,254,0.55)',
            border: 'none',
            borderRadius: activeModule === m.id ? '14px 14px 0 0' : '14px 14px 0 0',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            position: 'relative',
          }}
            onMouseEnter={e => { if (activeModule !== m.id) e.currentTarget.style.color='rgba(255,255,255,0.85)' }}
            onMouseLeave={e => { if (activeModule !== m.id) e.currentTarget.style.color='rgba(191,219,254,0.55)' }}>
            <span style={{ fontSize:'14px' }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </nav>

      {/* ─── MAIN CONTENT ────────────────────────────────── */}
      <main style={{ flex:1, padding:'28px 32px 40px', overflow:'auto' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto' }}>

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 1 — CASHIER PAYMENTS                 ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'payments' && (
            <div style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>

              {/* ── Left: Queue Sidebar ─────────────────── */}
              <div className="cashier-slide-left" style={{ ...S.card, width:'380px', flexShrink:0, overflow:'hidden' }}>
                {/* Tabs */}
                <div style={{ display:'flex', borderBottom:'1px solid #f0f0f0' }}>
                  {[
                    { key:'waiting', label:'Waiting for Payment', count: waitingOrders.length },
                    { key:'credit',  label:'Unpaid / Credit',     count: creditOrders.length },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setQueueTab(tab.key)} style={{
                      flex:1, padding:'16px 8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                      fontSize:'13px', fontWeight: queueTab === tab.key ? '700' : '500',
                      fontFamily:'inherit', background:'none', border:'none', cursor:'pointer',
                      color: queueTab === tab.key ? '#1a1a2e' : '#a0a0b8',
                      borderBottom: queueTab === tab.key ? '3px solid #1e40af' : '3px solid transparent',
                      transition: 'all 0.2s',
                    }}>
                      {tab.label}
                      <span style={{
                        minWidth:'22px', height:'22px', borderRadius:'999px',
                        background: queueTab === tab.key ? '#1e40af' : '#f0f0f5',
                        color: queueTab === tab.key ? 'white' : '#8b8ba3',
                        fontSize:'11px', fontWeight:'700',
                        display:'flex', alignItems:'center', justifyContent:'center', padding:'0 6px',
                      }}>{tab.count}</span>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ padding:'16px 20px 8px' }}>
                  <div style={{ position:'relative' }}>
                    <svg style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:'#b0b0c8' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input type="text" id="cashier-search-input"
                      placeholder="Search order number..."
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        ...S.input, height:'44px', paddingLeft:'42px',
                        background:'#f5f5f8', borderColor: inputFocus==='search' ? '#1e40af' : '#ebebf0',
                        boxShadow: inputFocus==='search' ? '0 0 0 3px rgba(30,64,175,0.08)' : 'none',
                        borderRadius:'12px', fontSize:'13px',
                      }}
                      onFocus={() => setInputFocus('search')}
                      onBlur={() => setInputFocus(null)}
                    />
                  </div>
                </div>

                {/* Order list */}
                <div className="cashier-scroll" style={{ padding:'4px 12px 16px', maxHeight:'calc(100vh - 310px)', overflowY:'auto' }}>
                  {displayOrders.length === 0 ? (
                    <div style={{ padding:'60px 20px', textAlign:'center' }}>
                      <div style={{ fontSize:'32px', marginBottom:'12px', opacity:0.4 }}>📭</div>
                      <p style={{ fontSize:'13px', color:'#a0a0b8', fontWeight:'500' }}>No orders in queue</p>
                    </div>
                  ) : (
                    <>
                      {/* Today's Orders */}
                      {todayOrders.length > 0 && (
                        <div>
                          {pastOrders.length > 0 && (
                            <div style={{ fontSize:'11px', fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:'0.08em', padding:'6px 8px 6px' }}>
                              Today's Queue ({todayOrders.length})
                            </div>
                          )}
                          {todayOrders.map(order => {
                            const sel = order.id === selectedOrderId
                            return (
                              <div key={order.id}
                                onClick={() => { setSelectedOrderId(order.id); setSelectedPaymentMethods([]); }}
                                style={{
                                  width:'100%', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between',
                                  padding:'14px 16px', marginBottom:'6px',
                                  borderRadius:'14px', cursor:'pointer', fontFamily:'inherit',
                                  background: sel ? '#eef3ff' : 'transparent',
                                  border: sel ? '1.5px solid #bfdbfe' : '1.5px solid transparent',
                                  boxShadow: sel ? '0 2px 8px rgba(30,64,175,0.08)' : 'none',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { if (!sel) { e.currentTarget.style.background='#fafafa'; e.currentTarget.style.border='1.5px solid #f0f0f5' } }}
                                onMouseLeave={e => { if (!sel) { e.currentTarget.style.background='transparent'; e.currentTarget.style.border='1.5px solid transparent' } }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'14px', minWidth:0, flex:1 }}>
                                  <div style={{
                                    width:'44px', height:'44px', borderRadius:'12px',
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontWeight:'800', fontSize:'15px', flexShrink:0,
                                    background: sel ? '#1e40af' : '#eef3ff',
                                    color: sel ? 'white' : '#1e40af',
                                    boxShadow: sel ? '0 4px 12px rgba(30,64,175,0.2)' : 'none',
                                    transition: 'all 0.2s',
                                  }}>{order.order_number}</div>
                                  <div style={{ minWidth:0, flex:1 }}>
                                    <div style={{ fontSize:'14px', fontWeight:'700', color:'#1a1a2e', lineHeight:'1.3' }}>
                                      Order #{order.order_number}
                                      {order.is_credit && (
                                        <span style={{ marginLeft:'8px', fontSize:'10px', fontWeight:'700', background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:'6px', verticalAlign:'middle' }}>CREDIT</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize:'12px', color:'#a0a0b8', fontWeight:'500', marginTop:'2px' }}>
                                      {order.items?.length || 1} items · {timeAgo(order.created_at)}
                                    </div>
                                  </div>
                                </div>
                                <span style={{ fontWeight:'800', color:'#1a1a2e', fontSize:'14px', flexShrink:0, paddingLeft:'8px', fontVariantNumeric:'tabular-nums' }}>
                                  ₦{Number(order.total_amount).toLocaleString()}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Previous Days / Stale Orders */}
                      {pastOrders.length > 0 && (
                        <div style={{ marginTop: todayOrders.length > 0 ? '14px' : '0' }}>
                          <div style={{ background:'#fffbe0', border:'1px solid #fde68a', borderRadius:'10px', padding:'8px 12px', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <div>
                              <span style={{ fontSize:'11px', fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'0.06em', display:'block' }}>
                                ⚠️ Stale Orders ({pastOrders.length})
                              </span>
                              <span style={{ fontSize:'10px', color:'#92400e' }}>Unpaid from previous days — verify before processing</span>
                            </div>
                          </div>

                          {pastOrders.map(order => {
                            const sel = order.id === selectedOrderId
                            return (
                              <div key={order.id}
                                onClick={() => { setSelectedOrderId(order.id); setSelectedPaymentMethods([]); }}
                                style={{
                                  width:'100%', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between',
                                  padding:'14px 16px', marginBottom:'6px',
                                  borderRadius:'14px', cursor:'pointer', fontFamily:'inherit',
                                  background: sel ? '#eef3ff' : '#fffbeb',
                                  border: sel ? '1.5px solid #bfdbfe' : '1.5px solid #fde68a',
                                  boxShadow: sel ? '0 2px 8px rgba(30,64,175,0.08)' : 'none',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { if (!sel) { e.currentTarget.style.background='#fef3c7' } }}
                                onMouseLeave={e => { if (!sel) { e.currentTarget.style.background='#fffbeb' } }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'14px', minWidth:0, flex:1 }}>
                                  <div style={{
                                    width:'44px', height:'44px', borderRadius:'12px',
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontWeight:'800', fontSize:'15px', flexShrink:0,
                                    background: sel ? '#1e40af' : '#d97706',
                                    color: 'white',
                                    boxShadow: sel ? '0 4px 12px rgba(30,64,175,0.2)' : 'none',
                                    transition: 'all 0.2s',
                                  }}>{order.order_number}</div>
                                  <div style={{ minWidth:0, flex:1 }}>
                                    <div style={{ fontSize:'14px', fontWeight:'700', color:'#1a1a2e', lineHeight:'1.3' }}>
                                      Order #{order.order_number}
                                      {order.is_credit && (
                                        <span style={{ marginLeft:'8px', fontSize:'10px', fontWeight:'700', background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:'6px', verticalAlign:'middle' }}>CREDIT</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize:'12px', color:'#78350f', fontWeight:'500', marginTop:'2px' }}>
                                      {order.items?.length || 1} items · {new Date(order.created_at).toLocaleDateString('en-NG', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Africa/Lagos' })}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign:'right', flexShrink:0, paddingLeft:'8px' }}>
                                  <div style={{ fontWeight:'800', color:'#1a1a2e', fontSize:'14px', fontVariantNumeric:'tabular-nums' }}>
                                    ₦{Number(order.total_amount).toLocaleString()}
                                  </div>
                                  <button
                                    onClick={(e) => handleCancelOrder(e, order.id)}
                                    style={{
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      marginTop: '4px',
                                      fontFamily: 'inherit',
                                      display: 'inline-block',
                                    }}
                                    title="Cancel stale order from previous day"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Right: Payment Panel ────────────────── */}
              <div className="cashier-slide-right" style={{ ...S.card, flex:1, minHeight:'560px', display:'flex', flexDirection:'column' }}>
                {!activeOrder ? (
                  /* ── Empty State ──────────────────────── */
                  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 40px' }}>
                    <div className="animate-float" style={{
                      width:'72px', height:'72px', borderRadius:'20px',
                      background:'linear-gradient(135deg, #eef3ff, #dbeafe)',
                      display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'24px',
                      boxShadow:'0 4px 16px rgba(30,64,175,0.1)',
                    }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                    <h3 style={{ fontSize:'20px', fontWeight:'800', color:'#1a1a2e', marginBottom:'8px', letterSpacing:'-0.02em' }}>
                      Select an order to take payment
                    </h3>
                    <p style={{ fontSize:'14px', color:'#a0a0b8', maxWidth:'340px', textAlign:'center', lineHeight:'1.6' }}>
                      Pick an order from the queue on the left, or type its number in the search box.
                    </p>
                  </div>
                ) : (
                  /* ── Active Order ─────────────────────── */
                  <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
                    {/* Order header */}
                    <div style={{ padding:'28px 32px 20px', borderBottom:'1px solid #f0f0f5' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <span style={{ fontSize:'11px', fontWeight:'700', color:'#a0a0b8', textTransform:'uppercase', letterSpacing:'0.12em' }}>ORDER</span>
                          <h2 style={{ fontSize:'42px', fontWeight:'900', color:'#1a1a2e', letterSpacing:'-0.03em', lineHeight:'1', marginTop:'2px' }}>
                            #{activeOrder.order_number}
                          </h2>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <span style={{
                            display:'inline-block', fontSize:'12px', fontWeight:'600',
                            background:'#eef3ff', color:'#1e40af', padding:'4px 12px', borderRadius:'8px',
                          }}>{activeOrder.items?.length || 1} items</span>
                          <div style={{ fontSize:'12px', color:'#a0a0b8', marginTop:'6px' }}>{timeAgo(activeOrder.created_at)}</div>
                          {activeOrder.attendant_name && (
                            <div style={{ fontSize:'11px', color:'#c8c8d8', marginTop:'2px' }}>by {activeOrder.attendant_name}</div>
                          )}
                          <div style={{ marginTop:'8px' }}>
                            <button
                              onClick={(e) => handleCancelOrder(e, activeOrder.id)}
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontFamily: 'inherit',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Cancel order"
                            >
                              ✕ Cancel Order
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    <div className="cashier-scroll" style={{ flex:1, padding:'8px 32px', overflowY:'auto' }}>
                      {activeOrder.items?.map((item, idx) => (
                        <div key={idx} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'16px 0', borderBottom:'1px solid #f5f5f8',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                            <span style={{
                              width:'32px', height:'32px', borderRadius:'9px',
                              background:'#f5f5f8', border:'1px solid #ebebf0',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontWeight:'700', fontSize:'13px', color:'#4a4a68',
                            }}>{item.quantity}</span>
                            <div>
                              <div style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e' }}>{item.product_name}</div>
                              <div style={{ fontSize:'12px', color:'#a0a0b8', marginTop:'2px' }}>₦{Number(item.unit_price).toLocaleString()} each</div>
                            </div>
                          </div>
                          <span style={{ fontWeight:'700', color:'#1a1a2e', fontSize:'14px', fontVariantNumeric:'tabular-nums' }}>
                            ₦{(Number(item.total_price) || Number(item.unit_price) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Payment footer */}
                    <div style={{ borderTop:'1px solid #f0f0f5', padding:'24px 32px 28px', background:'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)' }}>
                      {/* Total */}
                      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'24px' }}>
                        <span style={{ fontSize:'16px', fontWeight:'600', color:'#6b6b85' }}>Total due</span>
                        <span style={{ fontSize:'40px', fontWeight:'900', color:'#1a1a2e', letterSpacing:'-0.03em', lineHeight:'1', fontVariantNumeric:'tabular-nums' }}>
                          ₦{Number(activeOrder.total_amount).toLocaleString()}
                        </span>
                      </div>

                      {/* Payment method pills */}
                      <div style={{ marginBottom:'20px' }}>
                        <label style={{ fontSize:'11px', fontWeight:'700', color:'#a0a0b8', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'12px', display:'block' }}>
                          Payment Method · Select one or more to split
                        </label>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'10px' }}>
                          {PAY_METHODS.map(m => {
                            const active = selectedPaymentMethods.includes(m)
                            return (
                              <button key={m} type="button" onClick={() => togglePaymentMethod(m)} style={{
                                height:'48px', borderRadius:'14px', fontWeight:'700', fontSize:'14px',
                                fontFamily:'inherit', cursor:'pointer',
                                background: active ? '#1e40af' : 'white',
                                color: active ? 'white' : '#4a4a68',
                                border: active ? '2px solid #1e40af' : '2px solid #e8eaed',
                                boxShadow: active ? '0 4px 16px rgba(30,64,175,0.2)' : 'none',
                                transform: active ? 'scale(1.02)' : 'scale(1)',
                                transition: 'all 0.2s ease',
                              }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor='#93c5fd'; e.currentTarget.style.color='#1e40af'; e.currentTarget.style.background='#f8faff' } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor='#e8eaed'; e.currentTarget.style.color='#4a4a68'; e.currentTarget.style.background='white' } }}>
                                {m}
                              </button>
                            )
                          })}
                        </div>

                        {/* Payment inputs */}
                        {selectedPaymentMethods.length > 0 && (
                          <div className="animate-fade-in" style={{ marginTop:'14px', display:'flex', flexWrap:'wrap', gap:'10px', justifyContent:'center' }}>
                            {selectedPaymentMethods.map(m => (
                              <div key={m} style={{ position:'relative' }}>
                                <span style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', fontWeight:'700', color:'#a0a0b8', fontSize:'14px' }}>₦</span>
                                <input type="number"
                                  value={paymentAmounts[m] || ''}
                                  onChange={e => setPaymentAmounts(prev => ({...prev, [m]: e.target.value }))}
                                  placeholder={m}
                                  style={{
                                    width:'160px', height:'48px', paddingLeft:'32px', paddingRight:'14px',
                                    background:'white', border:'2px solid #e8eaed', borderRadius:'12px',
                                    fontWeight:'700', fontSize:'15px', textAlign:'center', color:'#1a1a2e',
                                    outline:'none', fontFamily:'inherit', fontVariantNumeric:'tabular-nums',
                                    transition:'border-color 0.2s, box-shadow 0.2s',
                                  }}
                                  onFocus={e => { e.target.style.borderColor='#1e40af'; e.target.style.boxShadow='0 0 0 3px rgba(30,64,175,0.08)' }}
                                  onBlur={e => { e.target.style.borderColor='#e8eaed'; e.target.style.boxShadow='none' }}
                                />
                                <span style={{ position:'absolute', top:'-8px', left:'50%', transform:'translateX(-50%)', fontSize:'10px', fontWeight:'700', background:'white', color:'#a0a0b8', padding:'0 6px', borderRadius:'4px' }}>{m}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Credit Customer Details (Mandatory if Credit selected) */}
                        {hasCreditSelected && (
                          <div style={{ marginTop:'14px', background:'#fef3c7', border:'1.5px solid #fde68a', padding:'14px', borderRadius:'14px' }}>
                            <span style={{ fontSize:'11px', fontWeight:'800', color:'#92400e', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'8px' }}>
                              ⚠ Required for Credit Sale (Enforced)
                            </span>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                              <div>
                                <label style={{ fontSize:'11px', fontWeight:'700', color:'#92400e', display:'block', marginBottom:'4px' }}>Customer Name *</label>
                                <input type="text" placeholder="e.g. Mrs. Okafor" value={customerName} onChange={e=>setCustomerName(e.target.value)}
                                  style={{ width:'100%', height:'40px', padding:'0 12px', borderRadius:'8px', border:'1px solid #fcd34d', fontSize:'13px', fontFamily:'inherit', background:'white' }} />
                              </div>
                              <div>
                                <label style={{ fontSize:'11px', fontWeight:'700', color:'#92400e', display:'block', marginBottom:'4px' }}>Customer Phone *</label>
                                <input type="tel" placeholder="08031234567" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                                  style={{ width:'100%', height:'40px', padding:'0 12px', borderRadius:'8px', border:'1px solid #fcd34d', fontSize:'13px', fontFamily:'inherit', background:'white' }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Balance indicator */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                        <span style={{ fontSize:'13px', color:'#a0a0b8', fontWeight:'500', fontVariantNumeric:'tabular-nums' }}>
                          Entered ₦{enteredPaymentTotal.toLocaleString()}
                        </span>
                        {selectedPaymentMethods.length > 0 && (
                          isBalanced ? (
                            <span className="cashier-ping" style={{
                              display:'inline-flex', alignItems:'center', gap:'8px',
                              fontSize:'13px', fontWeight:'700', color:'#16a34a',
                              background:'#f0fdf4', padding:'6px 16px', borderRadius:'999px',
                            }}>
                              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e' }} />
                              Balanced ✓
                            </span>
                          ) : (
                            <span style={{
                              display:'inline-flex', alignItems:'center', gap:'8px',
                              fontSize:'13px', fontWeight:'600', color:'#dc2626',
                              background:'#fef2f2', padding:'6px 16px', borderRadius:'999px',
                            }}>
                              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444' }} />
                              Gap: ₦{Math.abs(Number(activeOrder.total_amount) - enteredPaymentTotal).toLocaleString()}
                            </span>
                          )
                        )}
                      </div>

                      {/* Payment Error Banner */}
                      {paymentError && (
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', padding:'12px 16px', borderRadius:'12px', fontSize:'13px', fontWeight:700, marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ fontSize:'16px' }}>❌</span>
                          <span>{paymentError}</span>
                        </div>
                      )}

                      {/* Confirm button */}
                      <button onClick={handleConfirmPayment} disabled={!isBalanced || isSubmittingPayment} id="confirm-print-receipt-button"
                        style={{
                          width:'100%', height:'56px', borderRadius:'16px',
                          fontWeight:'700', fontSize:'15px', fontFamily:'inherit',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                          cursor: (isBalanced && !isSubmittingPayment) ? 'pointer' : 'not-allowed',
                          background: (isBalanced && !isSubmittingPayment) ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#e8eaed',
                          color: (isBalanced && !isSubmittingPayment) ? 'white' : '#a0a0b8',
                          border: 'none',
                          boxShadow: (isBalanced && !isSubmittingPayment) ? '0 6px 20px rgba(22,163,74,0.25)' : 'none',
                          transition: 'all 0.25s ease',
                          opacity: isSubmittingPayment ? 0.7 : 1,
                        }}>
                        {isSubmittingPayment ? (
                          <>
                            <div style={{ width:'18px', height:'18px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                            Saving & Verifying Server...
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 6 2 18 2 18 9" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <rect x="6" y="14" width="12" height="8" />
                            </svg>
                            Confirm & Print Receipt
                          </>
                        )}
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
            <div className="cashier-slide-left" style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:'24px' }}>
              {/* Add expense form */}
              <div style={{ ...S.card, padding:'28px' }}>
                <h2 style={{ ...S.sectionTitle, fontSize:'18px' }}>Log Shop Expense</h2>
                <p style={{ ...S.sectionSub, marginBottom:'24px' }}>Record any outgoing cash or POS payment.</p>
                <form onSubmit={handleAddExpense}>
                  <div style={{ marginBottom:'20px' }}>
                    <label style={S.label}>Expense Category *</label>
                    <select value={expCategory} onChange={e=>setExpCategory(e.target.value)} style={{
                      ...S.input, cursor:'pointer', appearance:'none',
                      backgroundImage:`url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat:'no-repeat', backgroundPosition:'right 16px center',
                      borderColor: inputFocus==='expCat' ? '#1e40af' : '#e8eaed',
                      boxShadow: inputFocus==='expCat' ? '0 0 0 3px rgba(30,64,175,0.08)' : 'none',
                    }}
                      onFocus={() => setInputFocus('expCat')} onBlur={() => setInputFocus(null)}>
                      {EXPENSE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:'20px' }}>
                    <label style={S.label}>Amount (₦) *</label>
                    <input type="number" placeholder="e.g. 3500" required value={expAmount} onChange={e=>setExpAmount(e.target.value)}
                      style={getInputStyle('expAmt')} onFocus={() => setInputFocus('expAmt')} onBlur={() => setInputFocus(null)} />
                  </div>
                  <div style={{ marginBottom:'20px' }}>
                    <label style={S.label}>Payment Method *</label>
                    <select value={expMethod} onChange={e=>setExpMethod(e.target.value)} style={{
                      ...S.input, cursor:'pointer', appearance:'none',
                      backgroundImage:`url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat:'no-repeat', backgroundPosition:'right 16px center',
                      borderColor: inputFocus==='expMethod' ? '#1e40af' : '#e8eaed',
                      boxShadow: inputFocus==='expMethod' ? '0 0 0 3px rgba(30,64,175,0.08)' : 'none',
                    }}
                      onFocus={() => setInputFocus('expMethod')} onBlur={() => setInputFocus(null)}>
                      {['Cash','POS','POS 2','Transfer'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:'24px' }}>
                    <label style={S.label}>Description / Note</label>
                    <input type="text" placeholder="e.g. Petrol for generator evening" value={expNote} onChange={e=>setExpNote(e.target.value)}
                      style={getInputStyle('expNote')} onFocus={() => setInputFocus('expNote')} onBlur={() => setInputFocus(null)} />
                  </div>
                  <button type="submit" style={{
                    width:'100%', height:'52px', borderRadius:'14px', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg, #1a1a2e, #0f0f1e)',
                    color:'white', fontWeight:'700', fontSize:'14px', fontFamily:'inherit',
                    boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
                    transition:'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform='scale(1.01)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)' }}>
                    Save Expense
                  </button>
                </form>
              </div>

              {/* Expenses table */}
              <div style={{ ...S.card, padding:'28px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
                  <div>
                    <h2 style={{ ...S.sectionTitle, fontSize:'18px' }}>Today's Expenses</h2>
                    <p style={S.sectionSub}>Deducted automatically during Close Day reconciliation.</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'11px', color:'#a0a0b8', fontWeight:'600', display:'block' }}>Total Today</span>
                    <span style={{ fontSize:'28px', fontWeight:'900', color:'#dc2626', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>
                      ₦{expenses.reduce((s,e)=>s+Number(e.amount),0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div style={{ borderRadius:'14px', border:'1px solid #f0f0f5', overflow:'hidden' }}>
                  <table style={{ width:'100%', textAlign:'left', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'#f8f9fc' }}>
                        {['Category','Amount','Method','Note','Logged By'].map(h => (
                          <th key={h} style={{ padding:'14px 20px', fontSize:'11px', fontWeight:'700', color:'#8b8ba3', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'1px solid #f0f0f5' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(exp => (
                        <tr key={exp.id} style={{ borderBottom:'1px solid #f8f8fb', transition:'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='#fafbff'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'16px 20px', fontWeight:'600', color:'#1a1a2e' }}>{exp.category}</td>
                          <td style={{ padding:'16px 20px', fontWeight:'800', color:'#dc2626', fontVariantNumeric:'tabular-nums' }}>₦{Number(exp.amount).toLocaleString()}</td>
                          <td style={{ padding:'16px 20px' }}>
                            <span style={{ padding:'4px 10px', borderRadius:'8px', background:'#f0f0f5', fontSize:'11px', fontWeight:'600', color:'#4a4a68' }}>{exp.payment_method}</span>
                          </td>
                          <td style={{ padding:'16px 20px', color:'#8b8ba3' }}>{exp.note || '—'}</td>
                          <td style={{ padding:'16px 20px', color:'#a0a0b8' }}>{exp.recorded_by}</td>
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
            <div className="cashier-slide-left" style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:'24px' }}>
              <div style={{ ...S.card, padding:'28px' }}>
                <h2 style={{ ...S.sectionTitle, fontSize:'18px' }}>Record Treatment</h2>
                <p style={{ ...S.sectionSub, marginBottom:'20px' }}>Log wound dressing, injections, or procedures.</p>
                <form onSubmit={handleAddTreatment}>
                  <div style={{ marginBottom:'16px' }}>
                    <label style={S.label}>Patient Name *</label>
                    <input type="text" required placeholder="e.g. Mrs. Florence Nnaji" value={tName} onChange={e=>setTName(e.target.value)}
                      style={getInputStyle('tName')} onFocus={()=>setInputFocus('tName')} onBlur={()=>setInputFocus(null)} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                    <div>
                      <label style={S.label}>Age</label>
                      <input type="number" placeholder="42" value={tAge} onChange={e=>setTAge(e.target.value)}
                        style={getInputStyle('tAge')} onFocus={()=>setInputFocus('tAge')} onBlur={()=>setInputFocus(null)} />
                    </div>
                    <div>
                      <label style={S.label}>Weight (kg)</label>
                      <input type="number" placeholder="68" value={tWeight} onChange={e=>setTWeight(e.target.value)}
                        style={getInputStyle('tWt')} onFocus={()=>setInputFocus('tWt')} onBlur={()=>setInputFocus(null)} />
                    </div>
                  </div>
                  <div style={{ marginBottom:'16px' }}>
                    <label style={S.label}>Diagnosis / Treatment *</label>
                    <input type="text" required placeholder="e.g. Leg Ulcer Wound Dressing" value={tDiagnosis} onChange={e=>setTDiagnosis(e.target.value)}
                      style={getInputStyle('tDiag')} onFocus={()=>setInputFocus('tDiag')} onBlur={()=>setInputFocus(null)} />
                  </div>
                  <div style={{ marginBottom:'16px' }}>
                    <label style={S.label}>Drugs & Supplies Used</label>
                    <input type="text" placeholder="e.g. Gauze, Iodine, Bandage" value={tDrug} onChange={e=>setTDrug(e.target.value)}
                      style={getInputStyle('tDrug')} onFocus={()=>setInputFocus('tDrug')} onBlur={()=>setInputFocus(null)} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                    <div>
                      <label style={S.label}>Total Charge (₦) *</label>
                      <input type="number" required placeholder="6000" value={tCharge} onChange={e=>setTCharge(e.target.value)}
                        style={{...getInputStyle('tCh'), fontWeight:'700'}} onFocus={()=>setInputFocus('tCh')} onBlur={()=>setInputFocus(null)} />
                    </div>
                    <div>
                      <label style={S.label}>Deposit Paid (₦)</label>
                      <input type="number" placeholder="3000" value={tDeposit} onChange={e=>setTDeposit(e.target.value)}
                        style={{...getInputStyle('tDep'), fontWeight:'700', color:'#16a34a'}} onFocus={()=>setInputFocus('tDep')} onBlur={()=>setInputFocus(null)} />
                    </div>
                  </div>
                  <div style={{ marginBottom:'20px' }}>
                    <label style={S.label}>Return Visit Date</label>
                    <input type="date" value={tReturnDate} onChange={e=>setTReturnDate(e.target.value)}
                      style={getInputStyle('tDate')} onFocus={()=>setInputFocus('tDate')} onBlur={()=>setInputFocus(null)} />
                  </div>
                  <button type="submit" style={{
                    width:'100%', height:'52px', borderRadius:'14px', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    color:'white', fontWeight:'700', fontSize:'14px', fontFamily:'inherit',
                    boxShadow:'0 4px 16px rgba(109,40,217,0.2)',
                    transition:'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform='scale(1.01)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='scale(1)' }}>
                    Save Treatment Record
                  </button>
                </form>
              </div>

              <div style={{ ...S.card, padding:'28px' }}>
                <h2 style={{ ...S.sectionTitle, fontSize:'18px', marginBottom:'4px' }}>Active Patient Treatments</h2>
                <p style={{ ...S.sectionSub, marginBottom:'20px' }}>Track deposits, balances, and return visit schedules.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {treatments.map(t => (
                    <div key={t.id} style={{
                      padding:'20px 24px', borderRadius:'16px',
                      border:'1px solid #f0f0f5', background:'linear-gradient(135deg, #fafbff 0%, #f8f9fc 100%)',
                      display:'flex', justifyContent:'space-between', gap:'20px', flexWrap:'wrap',
                      transition:'box-shadow 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'6px' }}>
                          <span style={{ fontSize:'15px', fontWeight:'700', color:'#1a1a2e' }}>{t.patient_name}</span>
                          {t.patient_age && <span style={{ fontSize:'11px', color:'#a0a0b8', background:'#f0f0f5', padding:'2px 8px', borderRadius:'6px' }}>({t.patient_age}yrs, {t.patient_weight||'—'}kg)</span>}
                        </div>
                        <p style={{ fontSize:'13px', fontWeight:'600', color:'#7c3aed', marginBottom:'4px' }}>{t.diagnosis}</p>
                        <p style={{ fontSize:'12px', color:'#8b8ba3' }}>Drugs: {t.drug_used}</p>
                        {t.return_date && <p style={{ fontSize:'12px', fontWeight:'600', color:'#d97706', marginTop:'6px' }}>📅 Return: {t.return_date}</p>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', justifyContent:'space-between', alignItems:'flex-end' }}>
                        <div>
                          <span style={{ fontSize:'11px', color:'#a0a0b8', fontWeight:'600', display:'block' }}>Balance</span>
                          <span style={{ fontSize:'22px', fontWeight:'900', color:'#dc2626', fontVariantNumeric:'tabular-nums' }}>₦{t.balance_remaining.toLocaleString()}</span>
                          <span style={{ fontSize:'11px', color:'#a0a0b8', display:'block' }}>
                            Charged: ₦{t.amount_charged.toLocaleString()} | Dep: ₦{t.deposit_paid.toLocaleString()}
                          </span>
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
                          }} style={{
                            marginTop:'10px', padding:'8px 16px', borderRadius:'10px', border:'none', cursor:'pointer',
                            background:'linear-gradient(135deg, #16a34a, #15803d)',
                            color:'white', fontWeight:'700', fontSize:'12px', fontFamily:'inherit',
                            boxShadow:'0 2px 8px rgba(22,163,74,0.2)', transition:'all 0.2s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
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
            <div className="cashier-slide-left" style={{ ...S.card, padding:'32px', maxWidth:'1000px', margin:'0 auto' }}>
              <h2 style={S.sectionTitle}>Daily Cashier Reconciliation</h2>
              <p style={{ ...S.sectionSub, marginBottom:'28px' }}>Compare system figures against hand-counted totals. Any gap is highlighted.</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'28px' }}>
                {/* System figures */}
                <div style={{ background:'linear-gradient(135deg, #eef3ff, #e8eef8)', padding:'24px', borderRadius:'16px', border:'1px solid rgba(30,64,175,0.08)' }}>
                  <h3 style={{ fontSize:'11px', fontWeight:'700', color:'rgba(30,64,175,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', borderBottom:'1px solid rgba(30,64,175,0.08)', paddingBottom:'10px', marginBottom:'16px' }}>System Calculated</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px', fontSize:'13px' }}>
                    {[['Expected Cash', systemTotals.cash],['Expected POS', systemTotals.pos1],['Expected Transfer', systemTotals.transfer]].map(([label, val]) => (
                      <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color:'#4a4a68' }}>{label}</span>
                        <span style={{ fontWeight:'700', fontVariantNumeric:'tabular-nums' }}>₦{val.toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', color:'#d97706', fontWeight:'600' }}>
                      <span>Credit Owed</span><span style={{ fontVariantNumeric:'tabular-nums' }}>₦{systemTotals.credit.toLocaleString()}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', color:'#dc2626', borderTop:'1px solid rgba(30,64,175,0.08)', paddingTop:'12px' }}>
                      <span>Less Expenses</span><span style={{ fontWeight:'700', fontVariantNumeric:'tabular-nums' }}>- ₦{systemTotals.totalExp.toLocaleString()}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'16px', fontWeight:'900', color:'#1e40af', borderTop:'1px solid rgba(30,64,175,0.12)', paddingTop:'12px' }}>
                      <span>System Net</span><span style={{ fontVariantNumeric:'tabular-nums' }}>₦{systemTotals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Hand counted */}
                <div>
                  <h3 style={{ fontSize:'11px', fontWeight:'700', color:'#a0a0b8', textTransform:'uppercase', letterSpacing:'0.12em', borderBottom:'1px solid #f0f0f5', paddingBottom:'10px', marginBottom:'16px' }}>Hand-Counted Figures</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                    {[['Physical Cash', countedCash, setCountedCash, 'cc'],['POS Slips (Total)', countedPos1, setCountedPos1, 'p1'],['Transfer Slip', countedTransfer, setCountedTransfer, 'tr']].map(([label, val, setter, key]) => (
                      <div key={key}>
                        <label style={{ ...S.label, fontSize:'11px' }}>{label} (₦)</label>
                        <input type="number" placeholder="0" value={val} onChange={e=>setter(e.target.value)}
                          style={{...getInputStyle(key), fontWeight:'700', fontVariantNumeric:'tabular-nums'}} onFocus={()=>setInputFocus(key)} onBlur={()=>setInputFocus(null)} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom:'20px' }}>
                    <label style={{ ...S.label, fontSize:'12px' }}>Change Float (₦)</label>
                    <input type="number" placeholder="2000" value={changeFloat} onChange={e=>setChangeFloat(e.target.value)}
                      style={{...getInputStyle('cf'), fontWeight:'700', fontVariantNumeric:'tabular-nums'}} onFocus={()=>setInputFocus('cf')} onBlur={()=>setInputFocus(null)} />
                  </div>

                  {/* Gap indicator */}
                  <div style={{
                    padding:'18px 20px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px',
                    background: closeDayDifference === 0 ? '#f0fdf4' : closeDayDifference < 0 ? '#fef2f2' : '#eef3ff',
                    border: `1.5px solid ${closeDayDifference === 0 ? '#bbf7d0' : closeDayDifference < 0 ? '#fecaca' : '#bfdbfe'}`,
                    color: closeDayDifference === 0 ? '#15803d' : closeDayDifference < 0 ? '#b91c1c' : '#1e40af',
                  }}>
                    <div>
                      <span style={{ fontWeight:'700', fontSize:'13px', display:'block' }}>Reconciliation Gap</span>
                      <span style={{ fontSize:'11px', opacity:0.7 }}>
                        {closeDayDifference === 0 ? 'Perfect match!' : closeDayDifference < 0 ? `Shortage ₦${Math.abs(closeDayDifference).toLocaleString()}` : `Overage ₦${closeDayDifference.toLocaleString()}`}
                      </span>
                    </div>
                    <span style={{ fontSize:'24px', fontWeight:'900', fontVariantNumeric:'tabular-nums' }}>₦{closeDayDifference.toLocaleString()}</span>
                  </div>

                  <button onClick={() => setDayLocked(true)} disabled={dayLocked} style={{
                    width:'100%', height:'52px', borderRadius:'14px', border:'none',
                    cursor: dayLocked ? 'not-allowed' : 'pointer',
                    background: dayLocked ? '#e8eaed' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: dayLocked ? '#a0a0b8' : 'white',
                    fontWeight:'700', fontSize:'14px', fontFamily:'inherit',
                    boxShadow: dayLocked ? 'none' : '0 4px 16px rgba(220,38,38,0.2)',
                    transition:'all 0.2s',
                  }}
                    onMouseEnter={e => { if (!dayLocked) e.currentTarget.style.transform='scale(1.01)' }}
                    onMouseLeave={e => { if (!dayLocked) e.currentTarget.style.transform='scale(1)' }}>
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
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)' }}>
          <div className="cashier-scale-fade" style={{ ...S.card, maxWidth:'420px', width:'100%', padding:'24px' }}>
            <div className="receipt-paper" style={{ border:'1.5px dashed #d4d4d8', padding:'24px 18px', borderRadius:'14px', background:'white', fontFamily:'monospace', fontSize:'12px', color:'#1a1a2e' }}>
              {/* Header & Logo Container */}
              <div style={{ textAlign:'center', borderBottom:'1.5px dashed #e4e4e7', paddingBottom:'14px', marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'8px' }}>
                  {/* Logo Slot: renders uploaded logo image if available, else elegant pill emblem */}
                  <img
                    src="/logo.png"
                    alt="Emmanuel Pharmacy Logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    style={{ maxHeight:'48px', objectFit:'contain', marginBottom:'4px' }}
                  />
                  <div style={{
                    display:'none', width:'42px', height:'42px', borderRadius:'12px',
                    background:'linear-gradient(135deg, #1e40af, #3b82f6)',
                    alignItems:'center', justifyContent:'center', color:'white', fontWeight:'900', fontSize:'20px',
                    boxShadow:'0 2px 8px rgba(30,64,175,0.25)'
                  }}>
                    💊
                  </div>
                </div>

                <h2 style={{ fontWeight:'900', fontSize:'16px', color:'black', letterSpacing:'0.04em', margin:0 }}>
                  EMMANUEL PHARMACY
                </h2>
                <p style={{ fontSize:'10px', fontWeight:'600', color:'#4b5563', marginTop:'2px', fontStyle:'italic' }}>
                  Quality Care & Genuine Medicines
                </p>

                {/* Contact & Branch Information */}
                <div style={{ marginTop:'10px', fontSize:'9.5px', color:'#374151', lineHeight:'1.5', textAlign:'center' }}>
                  <div style={{ fontWeight:'700', color:'#111827', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    📍 Main Branch (HQ)
                  </div>
                  <div>12 Commercial Avenue, Main Market, Enugu</div>
                  <div>Tel: +234 803 123 4567, +234 802 987 6543</div>
                  <div>Email: emmanuelpharmacy.ng@gmail.com</div>

                  <div style={{ marginTop:'6px', fontWeight:'700', color:'#111827', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    📍 Branch 2
                  </div>
                  <div>45 Agbani Road, Opposite Park, Enugu</div>
                  <div>Tel: +234 805 111 2223</div>
                </div>
              </div>

              {/* Reference & Timestamp */}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', fontWeight:'700', borderBottom:'1.5px dashed #e4e4e7', paddingBottom:'8px', marginBottom:'8px' }}>
                <span>REF: {receiptOrder.receipt_ref}</span>
                <span>{(receiptOrder.paid_at || receiptOrder.created_at) ? new Date(receiptOrder.paid_at || receiptOrder.created_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour:'2-digit', minute:'2-digit' }) : ''} WAT</span>
              </div>

              {/* Order Meta & Staff */}
              <div style={{ fontSize:'11px', marginBottom:'10px', lineHeight:'1.7', color:'#374151' }}>
                <p>Date: {(receiptOrder.paid_at || receiptOrder.created_at) ? new Date(receiptOrder.paid_at || receiptOrder.created_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) : ''}</p>
                <p>Location Served: Main Branch (HQ)</p>
                <p>Attendant: {receiptOrder.attendant_name || 'attendant1'}</p>
                <p>Cashier: {cashierName}</p>
                {(receiptOrder.customer_name || receiptOrder.is_credit) && (
                  <p style={{ fontWeight:'700', color:'#1e40af' }}>
                    Customer: {receiptOrder.customer_name || 'N/A'} {receiptOrder.customer_phone ? `(${receiptOrder.customer_phone})` : ''}
                  </p>
                )}
              </div>

              {/* Purchased Items List */}
              <div style={{ borderTop:'1.5px dashed #e4e4e7', borderBottom:'1.5px dashed #e4e4e7', padding:'8px 0', marginBottom:'10px' }}>
                {receiptOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
                    <span>{item.quantity}x {item.product_name}</span>
                    <span style={{ fontVariantNumeric:'tabular-nums' }}>₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Total & Payment Method */}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'800', fontSize:'14px', color:'black', marginBottom:'4px' }}>
                <span>TOTAL PAID</span>
                <span style={{ fontVariantNumeric:'tabular-nums' }}>₦{Number(receiptOrder.total_amount).toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'12px' }}>
                <span>Method:</span><span style={{ fontWeight:'700', color:'#1e40af' }}>{receiptOrder.payment_method}</span>
              </div>

              {/* Footer */}
              <div style={{ textAlign:'center', borderTop:'1.5px dashed #e4e4e7', paddingTop:'10px', fontSize:'9.5px', color:'#6b7280', lineHeight:'1.5' }}>
                <p style={{ fontWeight:'700', color:'#111827' }}>Thank you for your patronage!</p>
                <p>No refund without receipt</p>
                <p>Keep medicines out of reach of children</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display:'flex', gap:'10px', marginTop:'18px' }}>
              <button onClick={() => setReceiptOrder(null)} style={{
                flex:1, height:'48px', borderRadius:'12px', border:'1.5px solid #e8eaed',
                background:'white', fontWeight:'600', fontSize:'13px', color:'#4a4a68',
                fontFamily:'inherit', cursor:'pointer', transition:'all 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
                onMouseLeave={e => e.currentTarget.style.background='white'}>
                Close
              </button>
              <button onClick={() => { window.print(); setReceiptOrder(null) }} style={{
                flex:1, height:'48px', borderRadius:'12px', border:'none',
                background:'linear-gradient(135deg, #1e40af, #1a2f6b)',
                color:'white', fontWeight:'700', fontSize:'13px', fontFamily:'inherit',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                boxShadow:'0 4px 16px rgba(30,64,175,0.2)', transition:'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)' }}>
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
