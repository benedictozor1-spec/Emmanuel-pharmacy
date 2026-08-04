import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import { printThermalReceipt } from '../utils/printReceipt'
import SyncStatusBadge from '../components/SyncStatusBadge'

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import Money, { formatMoney } from '../components/ui/money'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Separator } from '../components/ui/separator'
import { cn } from '../lib/utils'
import { 
  LogOut, CreditCard, Receipt, Pill, Lock, Clock, ChevronRight, ChevronDown, Printer, X, Loader2, CheckCircle2, 
  AlertCircle, Plus, Minus, DollarSign, Banknote, Smartphone, ArrowLeftRight, UserCircle, Phone, AlertTriangle, 
  Wallet, TrendingUp, TrendingDown, Search, Activity, Inbox
} from 'lucide-react'

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
  { id: 'payments',   label: 'Payments',   icon: <CreditCard className="w-4 h-4" /> },
  { id: 'expenses',   label: 'Expenses',   icon: <Receipt className="w-4 h-4" /> },
  { id: 'treatments', label: 'Treatments', icon: <Pill className="w-4 h-4" /> },
  { id: 'close_day',  label: 'Close Day',  icon: <Lock className="w-4 h-4" /> },
]
const EXPENSE_CATS = ['Fuel / Generator','Water','Transport','Staff Expenses','Repairs & Maintenance','Supplies','Misc']
const PAY_METHODS  = ['Cash','POS','Transfer','Credit']


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

  const [expenses, setExpenses] = useState([])
  const [expCategory, setExpCategory] = useState('Fuel / Generator')
  const [expAmount, setExpAmount]     = useState('')
  const [expMethod, setExpMethod]     = useState('Cash')
  const [expNote, setExpNote]         = useState('')

  const [treatments, setTreatments] = useState([])
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

  const [dailyExpenseLimit, setDailyExpenseLimit]   = useState(25000)
  const [mismatchAlertLimit, setMismatchAlertLimit] = useState(5000)

  const [lastCloseAt, setLastCloseAt]         = useState(null)
  const [creditRepayments, setCreditRepayments] = useState([])

  /* ═══════ Data fetching ═══════════════════════════════════ */
  const loadOrders = useCallback(async () => {
    if (!supabase) return
    setLoadingOrders(true)
    try {
      const { data, error } = await supabase
        .from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false })
      if (!error && data) {
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

  const loadExpenses = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setExpenses(data)
    } catch { console.warn('Could not load expenses from DB') }
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

  const loadShopSettings = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase.from('shop_settings').select('*').eq('id', 1).single()
      if (data) {
        if (data.daily_expense_limit) setDailyExpenseLimit(Number(data.daily_expense_limit))
        if (data.mismatch_alert_limit) setMismatchAlertLimit(Number(data.mismatch_alert_limit))
      }
    } catch { console.warn('Could not load shop settings in cashier') }
  }, [])

  const loadTreatments = useCallback(async () => {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('treatments')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setTreatments(data.map(t => ({
          id: t.id,
          patient_name: t.patient_name,
          patient_age: t.patient_age,
          patient_weight: t.patient_weight,
          diagnosis: t.diagnosis,
          drug_used: t.drug_used,
          amount_charged: Number(t.amount_charged) || 0,
          deposit_paid: Number(t.deposit_paid) || 0,
          balance_remaining: Number(t.balance_remaining) || 0,
          return_date: t.return_date,
          status: t.status || 'active',
          recorded_by: t.recorded_by || 'Cashier'
        })))
      }
    } catch { console.warn('Could not load treatments from DB') }
  }, [])

  useEffect(() => {
    loadOrders()
    loadExpenses()
    loadLastDayClose()
    loadCreditRepayments()
    loadShopSettings()
    loadTreatments()

    const interval = setInterval(() => {
      loadOrders()
      loadExpenses()
      loadCreditRepayments()
      loadTreatments()
    }, 3000)

    return () => clearInterval(interval)
  }, [loadOrders, loadExpenses, loadLastDayClose, loadCreditRepayments, loadShopSettings, loadTreatments])

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
      if (supabase && navigator.onLine && typeof activeOrder.id === 'string' && !activeOrder.id.startsWith('mock')) {
        const { data, error } = await supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', activeOrder.id)
          .select()

        if (!error && data && data.length > 0) {
          const confirmedOrder = data[0]
          const savedRow = { ...activeOrder, ...confirmedOrder, items: activeOrder.items, is_offline_pending: false }

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
          setIsSubmittingPayment(false)
          return
        }
      }
    } catch (err) {
      console.warn('⚠️ Network error on payment update, queuing offline payment:', err)
    }

    // --- Offline Payment Queue Fallback ---
    queueOfflinePayment({
      order_id: activeOrder.id,
      payment_method: methodLabel,
      cashier_name: fullName || username || 'Cashier',
      total_amount: activeOrder.total_amount,
      cash_amount: breakdownObj.Cash || 0,
      pos1_amount: breakdownObj.POS || 0,
      transfer_amount: breakdownObj.Transfer || 0,
      credit_amount: breakdownObj.Credit || 0,
      customer_name: hasCredit ? customerName.trim() : (activeOrder.customer_name || null),
      customer_phone: hasCredit ? customerPhone.trim() : (activeOrder.customer_phone || null),
      is_credit: hasCredit
    })

    const offlineReceiptOrder = {
      ...activeOrder,
      ...updatePayload,
      status: 'pending_sync',
      is_offline_pending: true
    }

    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, ...offlineReceiptOrder } : o))
    setReceiptOrder(offlineReceiptOrder)
    setSelectedOrderId(null)
    setSelectedPaymentMethods([])
    setIsSubmittingPayment(false)
  }

  const handleAddExpense = async e => {
    e.preventDefault()
    if (!expAmount || Number(expAmount) <= 0) return
    const amt = Number(expAmount)
    const currentExpSum = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const newTotalExp = currentExpSum + amt

    const newExp = {
      id: 'exp-' + Date.now(),
      category: expCategory,
      amount: amt,
      payment_method: expMethod,
      note: expNote.trim(),
      recorded_by: fullName || username || 'Cashier',
      created_at: new Date().toISOString()
    }
    setExpenses(prev => [newExp, ...prev])

    if (supabase) {
      try {
        await supabase.from('expenses').insert({
          category: expCategory,
          amount: amt,
          payment_method: expMethod,
          note: expNote.trim(),
          recorded_by: fullName || username || 'Cashier'
        })

        if (newTotalExp > dailyExpenseLimit) {
          await supabase.from('notifications').insert({
            title: '⚠️ Daily Expense Limit Exceeded',
            message: `Cashier ${cashierName} logged ₦${amt.toLocaleString()} (${expCategory}). Daily expenses reached ₦${newTotalExp.toLocaleString()} (Limit: ₦${dailyExpenseLimit.toLocaleString()}).`,
            is_read: false
          })
        }
      } catch (err) {
        console.warn('Expense DB save warning:', err)
      }
    }

    setExpAmount('')
    setExpNote('')
  }

  const handleLockDay = async () => {
    setDayLocked(true)
    const cCash = Number(countedCash) || 0
    const cPos = Number(countedPos1) || 0
    const cTrans = Number(countedTransfer) || 0
    const diff = closeDayDifference

    if (supabase) {
      try {
        await supabase.from('day_closes').insert({
          close_date: new Date().toISOString(),
          system_total: systemTotals.grandTotal,
          system_cash: systemTotals.cash,
          system_pos1: systemTotals.pos1,
          system_transfer: systemTotals.transfer,
          system_credit: systemTotals.credit,
          system_expenses: systemTotals.totalExp,
          counted_cash: cCash,
          counted_pos1: cPos,
          counted_transfer: cTrans,
          total_difference: diff,
          closed_by: cashierName
        })

        if (Math.abs(diff) > mismatchAlertLimit) {
          await supabase.from('notifications').insert({
            title: '⚠️ Day Close Cash Mismatch Alert',
            message: `Shift close by ${cashierName} has a cash mismatch of ₦${Math.abs(diff).toLocaleString()} (Limit: ₦${mismatchAlertLimit.toLocaleString()}).`,
            is_read: false
          })
        }
      } catch (err) {
        console.warn('Day close DB insert error:', err)
      }
    }
  }

  const handleAddTreatment = async e => {
    e.preventDefault()
    if (!tName.trim() || !tDiagnosis.trim() || !tCharge) return
    const charge = Number(tCharge)
    const deposit = Number(tDeposit) || 0
    const balance = charge - deposit

    const newTreat = {
      id: 'treat-' + Date.now(),
      patient_name: tName.trim(),
      patient_age: Number(tAge) || null,
      patient_weight: Number(tWeight) || null,
      diagnosis: tDiagnosis.trim(),
      drug_used: tDrug.trim(),
      amount_charged: charge,
      deposit_paid: deposit,
      balance_remaining: balance,
      return_date: tReturnDate || null,
      status: 'active',
      recorded_by: cashierName
    }
    setTreatments(prev => [newTreat, ...prev])

    if (supabase) {
      try {
        await supabase.from('treatments').insert({
          patient_name: tName.trim(),
          patient_age: Number(tAge) || null,
          patient_weight: Number(tWeight) || null,
          diagnosis: tDiagnosis.trim(),
          drug_used: tDrug.trim(),
          amount_charged: charge,
          deposit_paid: deposit,
          balance_remaining: balance,
          return_date: tReturnDate || null,
          status: 'active',
          recorded_by: cashierName
        })
        loadTreatments()
      } catch (err) {
        console.warn('DB treatments insert error:', err)
      }
    }

    setTName(''); setTAge(''); setTWeight(''); setTDiagnosis('')
    setTDrug(''); setTCharge(''); setTDeposit(''); setTReturnDate('')
  }

  const handleCollectBalance = async (treatment, amtCollected) => {
    const amt = Number(amtCollected)
    if (isNaN(amt) || amt <= 0) return

    const newDep = treatment.deposit_paid + amt
    const newBal = Math.max(0, treatment.amount_charged - newDep)
    const newStatus = newBal === 0 ? 'completed' : 'active'

    setTreatments(prev => prev.map(item => item.id === treatment.id
      ? { ...item, deposit_paid: newDep, balance_remaining: newBal, status: newStatus }
      : item))

    if (supabase && String(treatment.id).includes('-') === false) {
      try {
        await supabase.from('treatments').update({
          deposit_paid: newDep,
          balance_remaining: newBal,
          status: newStatus,
          updated_at: new Date().toISOString()
        }).eq('id', treatment.id)
        loadTreatments()
      } catch (err) {
        console.warn('DB collect balance error:', err)
      }
    }
  }

  const handleLogout = async () => { await logout(); navigate('/', { replace:true }) }

  /* ═══════ Render helpers ══════════════════════════════════ */
  const cashierName   = fullName || username || 'Blessing'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric' })

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ─── TOP HEADER BAR ──────────────────────────────── */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-8 h-16 flex items-center justify-between relative z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.jpg"
              alt="Logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              className="w-full h-full object-contain"
            />
            <div className="hidden text-blue-900"><Activity size={20} /></div>
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-white tracking-tight leading-tight">
              Cashier · <span className="text-blue-200/85">{MODULES.find(m=>m.id===activeModule)?.label}</span>
            </h1>
            <p className="text-[11px] text-blue-300/50 font-medium">Emmanuel Pharmacy</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <SyncStatusBadge />
          <div className="flex items-center gap-2.5 bg-white/10 border border-white/10 rounded-full px-4.5 py-1.5 text-xs text-white/70">
            <span className="text-[11px] text-blue-200/40">{dateStr}</span>
            <span className="w-px h-3.5 bg-white/10" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-white font-semibold">{cashierName}</span>
            <span className="text-blue-200/30">·</span>
            <span className="text-blue-200/40">Till 2</span>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="text-white/60 hover:text-white/90 hover:bg-white/10 h-8 px-2 rounded-lg gap-1.5 text-xs">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* ─── MODULE TAB BAR ──────────────────────────────── */}
      <nav className="bg-[#1a2f6b] px-8 flex gap-1 border-b border-white/10">
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setActiveModule(m.id)} className={cn(
            "px-6 py-3 text-[13px] font-medium flex items-center gap-1.5 transition-all rounded-t-xl",
            activeModule === m.id ? "bg-slate-50 text-foreground font-bold" : "text-blue-200/55 hover:text-white/85 bg-transparent"
          )}>
            {m.icon}
            {m.label}
          </button>
        ))}
      </nav>

      {/* ─── MAIN CONTENT ────────────────────────────────── */}
      <main className="flex-1 p-7 overflow-auto">
        <div className="max-w-[1400px] mx-auto">

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 1 — CASHIER PAYMENTS                 ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'payments' && (
            <div className="flex gap-6 items-start">
              
              {/* ── Left: Queue Sidebar ─────────────────── */}
              <Card className="w-[380px] shrink-0 overflow-hidden flex flex-col rounded-xl border shadow-xs h-[calc(100vh-140px)]">
                {/* Tabs */}
                <div className="flex border-b">
                  {[
                    { key:'waiting', label:'Waiting for Payment', count: waitingOrders.length },
                    { key:'credit',  label:'Unpaid / Credit',     count: creditOrders.length },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setQueueTab(tab.key)} className={cn(
                      "flex-1 py-4 flex items-center justify-center gap-2 text-[13px] transition-all border-b-[3px]",
                      queueTab === tab.key ? "text-foreground font-bold border-blue-800" : "text-muted-foreground border-transparent hover:text-foreground/80 font-medium"
                    )}>
                      {tab.label}
                      <Badge variant={queueTab === tab.key ? "default" : "secondary"} className={cn(
                        "h-[22px] min-w-[22px] px-1.5 justify-center rounded-full text-[11px]",
                        queueTab === tab.key ? "bg-blue-800" : ""
                      )}>
                        {tab.count}
                      </Badge>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="p-4 pb-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Search order number..." 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      className="pl-9 h-11 bg-muted/50 rounded-xl"
                    />
                  </div>
                </div>

                {/* Order list */}
                <div className="flex-1 overflow-y-auto p-3">
                  {displayOrders.length === 0 ? (
                    <div className="py-16 px-5 text-center">
                      <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-[13px] text-muted-foreground font-medium">No orders in queue</p>
                    </div>
                  ) : (
                    <>
                      {/* Today's Orders */}
                      {todayOrders.length > 0 && (
                        <div>
                          {pastOrders.length > 0 && (
                            <div className="text-[11px] font-extrabold text-blue-800 uppercase tracking-widest px-2 py-1.5">
                              Today's Queue ({todayOrders.length})
                            </div>
                          )}
                          {todayOrders.map(order => {
                            const sel = order.id === selectedOrderId
                            return (
                              <div key={order.id}
                                onClick={() => { setSelectedOrderId(order.id); setSelectedPaymentMethods([]); }}
                                className={cn(
                                  "w-full text-left flex items-center justify-between p-3.5 mb-1.5 rounded-xl cursor-pointer transition-all border-2",
                                  sel ? "bg-blue-50/50 border-blue-200 shadow-sm" : "hover:bg-muted/50 border-transparent"
                                )}>
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                  <div className={cn(
                                    "w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-[15px] shrink-0 transition-all",
                                    sel ? "bg-blue-800 text-white shadow-md shadow-blue-900/20" : "bg-blue-50 text-blue-800"
                                  )}>
                                    {order.order_number}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-foreground leading-tight truncate">
                                      Order #{order.order_number}
                                      {order.is_credit && (
                                        <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100/50 text-amber-900 border-amber-200 py-0 h-4 rounded-md">CREDIT</Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-medium mt-0.5">
                                      {order.items?.length || 1} items · {timeAgo(order.created_at)}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-extrabold text-foreground text-sm shrink-0 pl-2 tabular-nums">
                                  <Money amount={order.total_amount} />
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Previous Days / Stale Orders */}
                      {pastOrders.length > 0 && (
                        <div className={todayOrders.length > 0 ? "mt-3.5" : ""}>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider block">
                                ⚠️ Stale Orders ({pastOrders.length})
                              </span>
                              <span className="text-[10px] text-amber-800">Unpaid from previous days — verify before processing</span>
                            </div>
                          </div>

                          {pastOrders.map(order => {
                            const sel = order.id === selectedOrderId
                            return (
                              <div key={order.id}
                                onClick={() => { setSelectedOrderId(order.id); setSelectedPaymentMethods([]); }}
                                className={cn(
                                  "w-full text-left flex items-center justify-between p-3.5 mb-1.5 rounded-xl cursor-pointer transition-all border-2",
                                  sel ? "bg-blue-50/50 border-blue-200 shadow-sm" : "bg-amber-50/40 border-amber-200 hover:bg-amber-100/50"
                                )}>
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                  <div className={cn(
                                    "w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-[15px] shrink-0 transition-all",
                                    sel ? "bg-blue-800 text-white shadow-md" : "bg-amber-600 text-white"
                                  )}>
                                    {order.order_number}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-foreground leading-tight truncate">
                                      Order #{order.order_number}
                                      {order.is_credit && (
                                        <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100/50 text-amber-900 border-amber-200 py-0 h-4 rounded-md">CREDIT</Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-amber-900 font-medium mt-0.5">
                                      {order.items?.length || 1} items · {new Date(order.created_at).toLocaleDateString('en-NG', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Africa/Lagos' })}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 pl-2">
                                  <div className="font-extrabold text-foreground text-sm tabular-nums">
                                    <Money amount={order.total_amount} />
                                  </div>
                                  <Button 
                                    size="sm"
                                    variant="destructive"
                                    className="h-6 text-[11px] px-2 mt-1 rounded-md"
                                    onClick={(e) => handleCancelOrder(e, order.id)}
                                    title="Cancel stale order from previous day"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>

              {/* ── Right: Payment Panel ────────────────── */}
              <Card className="flex-1 min-h-[560px] flex flex-col rounded-xl border shadow-xs h-[calc(100vh-140px)] overflow-hidden">
                {!activeOrder ? (
                  /* ── Empty State ──────────────────────── */
                  <div className="flex-1 flex flex-col items-center justify-center p-10">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                      <CreditCard className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-extrabold text-foreground mb-2 tracking-tight">
                      Select an order to take payment
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center leading-relaxed">
                      Pick an order from the queue on the left, or type its number in the search box.
                    </p>
                  </div>
                ) : (
                  /* ── Active Order ─────────────────────── */
                  <div className="flex flex-col h-full">
                    {/* Order header */}
                    <div className="p-7 border-b border-border shrink-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">ORDER</span>
                          <h2 className="text-4xl font-black text-foreground tracking-tight leading-none mt-1">
                            #{activeOrder.order_number}
                          </h2>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-blue-50 text-blue-800 hover:bg-blue-100 py-1 px-3 text-xs font-semibold rounded-lg shadow-none border-0">
                            {activeOrder.items?.length || 1} items
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1.5">{timeAgo(activeOrder.created_at)}</div>
                          {activeOrder.attendant_name && (
                            <div className="text-[11px] text-muted-foreground/70 mt-0.5">by {activeOrder.attendant_name}</div>
                          )}
                          <div className="mt-2">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-7 text-[11px] px-2.5 rounded-md gap-1"
                              onClick={(e) => handleCancelOrder(e, activeOrder.id)}
                            >
                              <X className="w-3 h-3" /> Cancel Order
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    <div className="flex-1 p-4 px-8 overflow-y-auto">
                      {activeOrder.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-4 border-b border-muted/50 last:border-0">
                          <div className="flex items-center gap-3.5">
                            <div className="w-8 h-8 rounded-lg bg-muted border flex items-center justify-center font-bold text-[13px] text-muted-foreground">
                              {item.quantity}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{item.product_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5"><Money amount={item.unit_price} /> each</div>
                            </div>
                          </div>
                          <span className="font-bold text-foreground text-sm tabular-nums">
                            <Money amount={(Number(item.total_price) || Number(item.unit_price) * item.quantity)} />
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Payment footer */}
                    <div className="border-t border-border p-6 px-8 bg-slate-50/50 shrink-0">
                      {/* Total */}
                      <div className="flex items-end justify-between mb-6">
                        <span className="text-base font-semibold text-muted-foreground">Total due</span>
                        <span className="text-4xl font-black text-foreground tracking-tight leading-none tabular-nums">
                          <Money amount={activeOrder.total_amount} />
                        </span>
                      </div>

                      {/* Payment method pills */}
                      <div className="mb-5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 block">
                          Payment Method · Select one or more to split
                        </label>
                        <div className="grid grid-cols-4 gap-2.5">
                          {PAY_METHODS.map(m => {
                            const active = selectedPaymentMethods.includes(m)
                            return (
                              <button key={m} type="button" onClick={() => togglePaymentMethod(m)} className={cn(
                                "h-12 rounded-xl font-bold text-sm transition-all border-2 flex items-center justify-center",
                                active ? "bg-blue-800 text-white border-blue-800 shadow-md shadow-blue-900/20 scale-[1.02]" : "bg-background text-foreground border-border hover:border-blue-300 hover:text-blue-800 hover:bg-blue-50/50"
                              )}>
                                {m}
                              </button>
                            )
                          })}
                        </div>

                        {/* Payment inputs */}
                        {selectedPaymentMethods.length > 0 && (
                          <div className="mt-3.5 flex flex-wrap gap-2.5 justify-center animate-in fade-in zoom-in duration-200">
                            {selectedPaymentMethods.map(m => (
                              <div key={m} className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">₦</span>
                                <Input type="number"
                                  value={paymentAmounts[m] || ''}
                                  onChange={e => setPaymentAmounts(prev => ({...prev, [m]: e.target.value }))}
                                  placeholder={m}
                                  className="w-40 h-12 pl-8 pr-3.5 font-bold text-[15px] text-center text-foreground tabular-nums rounded-xl border-2 focus-visible:ring-blue-800"
                                />
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-background text-muted-foreground px-1.5 rounded-md border shadow-xs">{m}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Credit Customer Details */}
                        {hasCreditSelected && (
                          <div className="mt-3.5 bg-amber-50 border-2 border-amber-200 p-3.5 rounded-xl animate-in slide-in-from-top-2">
                            <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider block mb-2">
                              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" /> Required for Credit Sale
                            </span>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">Customer Name *</label>
                                <Input type="text" placeholder="e.g. Mrs. Okafor" value={customerName} onChange={e=>setCustomerName(e.target.value)}
                                  className="h-10 bg-background border-amber-300 focus-visible:ring-amber-500 rounded-lg" />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-amber-800 block mb-1">Customer Phone *</label>
                                <Input type="tel" placeholder="08031234567" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                                  className="h-10 bg-background border-amber-300 focus-visible:ring-amber-500 rounded-lg" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Balance indicator */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[13px] text-muted-foreground font-medium tabular-nums">
                          Entered <Money amount={enteredPaymentTotal} />
                        </span>
                        {selectedPaymentMethods.length > 0 && (
                          isBalanced ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-3 py-1 gap-1.5 animate-pulse rounded-full text-[13px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Balanced
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 px-3 py-1 gap-1.5 rounded-full text-[13px]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Gap: <Money amount={Math.abs(Number(activeOrder.total_amount) - enteredPaymentTotal)} />
                            </Badge>
                          )
                        )}
                      </div>

                      {/* Payment Error Banner */}
                      {paymentError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-[13px] font-bold mb-4 flex items-center gap-2.5">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <span>{paymentError}</span>
                        </div>
                      )}

                      {/* Confirm button */}
                      <Button 
                        onClick={handleConfirmPayment} 
                        disabled={!isBalanced || isSubmittingPayment}
                        className={cn(
                          "w-full h-14 rounded-2xl font-bold text-[15px] gap-2 transition-all",
                          (isBalanced && !isSubmittingPayment) ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" : ""
                        )}
                        size="lg"
                      >
                        {isSubmittingPayment ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving & Verifying Server...
                          </>
                        ) : (
                          <>
                            <Printer className="w-5 h-5" />
                            Confirm & Print Receipt
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 2 — EXPENSES LOG                     ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'expenses' && (
            <div className="grid grid-cols-[380px_1fr] gap-6 items-start">
              {/* Add expense form */}
              <Card className="p-7 rounded-xl border shadow-xs">
                <h2 className="text-lg font-extrabold text-foreground tracking-tight">Log Shop Expense</h2>
                <p className="text-[13px] text-muted-foreground mb-6">Record any outgoing cash or POS payment.</p>
                <form onSubmit={handleAddExpense} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground">Expense Category *</label>
                    <select value={expCategory} onChange={e=>setExpCategory(e.target.value)} 
                      className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer">
                      {EXPENSE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground">Amount (₦) *</label>
                    <Input type="number" placeholder="e.g. 3500" required value={expAmount} onChange={e=>setExpAmount(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground">Payment Method *</label>
                    <select value={expMethod} onChange={e=>setExpMethod(e.target.value)} 
                      className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer">
                      {['Cash','POS','POS 2','Transfer'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 pb-2">
                    <label className="text-[13px] font-semibold text-foreground">Description / Note</label>
                    <Input type="text" placeholder="e.g. Petrol for generator evening" value={expNote} onChange={e=>setExpNote(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold">
                    Save Expense
                  </Button>
                </form>
              </Card>

              {/* Expenses table */}
              <Card className="p-7 rounded-xl border shadow-xs min-h-[500px]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg font-extrabold text-foreground tracking-tight">Today's Expenses</h2>
                    <p className="text-[13px] text-muted-foreground">Deducted automatically during Close Day reconciliation.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground font-semibold block">Total Today</span>
                    <span className="text-2xl font-black text-foreground tabular-nums tracking-tight">
                      <Money amount={expenses.reduce((s,e)=>s+Number(e.amount),0)} />
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        {['Category','Amount','Method','Note','Logged By'].map(h => (
                          <th key={h} className="p-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                         <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No expenses logged today.</td></tr>
                      ) : expenses.map(exp => (
                        <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 font-semibold text-foreground">{exp.category}</td>
                          <td className="p-3.5 font-bold text-foreground tabular-nums"><Money amount={exp.amount} /></td>
                          <td className="p-3.5">
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5">{exp.payment_method}</Badge>
                          </td>
                          <td className="p-3.5 text-muted-foreground">{exp.note || '—'}</td>
                          <td className="p-3.5 text-muted-foreground">{exp.recorded_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 3 — TREATMENTS                       ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'treatments' && (
            <div className="grid grid-cols-[380px_1fr] gap-6 items-start">
              <Card className="p-7 rounded-xl border shadow-xs">
                <h2 className="text-lg font-extrabold text-foreground tracking-tight">Record Treatment</h2>
                <p className="text-[13px] text-muted-foreground mb-5">Log wound dressing, injections, or procedures.</p>
                <form onSubmit={handleAddTreatment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-foreground">Patient Name *</label>
                    <Input type="text" required placeholder="e.g. Mrs. Florence Nnaji" value={tName} onChange={e=>setTName(e.target.value)} className="h-11 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Age</label>
                      <Input type="number" placeholder="42" value={tAge} onChange={e=>setTAge(e.target.value)} className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Weight (kg)</label>
                      <Input type="number" placeholder="68" value={tWeight} onChange={e=>setTWeight(e.target.value)} className="h-11 rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-foreground">Diagnosis / Treatment *</label>
                    <Input type="text" required placeholder="e.g. Leg Ulcer Wound Dressing" value={tDiagnosis} onChange={e=>setTDiagnosis(e.target.value)} className="h-11 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-foreground">Drugs & Supplies Used</label>
                    <Input type="text" placeholder="e.g. Gauze, Iodine, Bandage" value={tDrug} onChange={e=>setTDrug(e.target.value)} className="h-11 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Total Charge (₦) *</label>
                      <Input type="number" required placeholder="6000" value={tCharge} onChange={e=>setTCharge(e.target.value)} className="h-11 rounded-lg font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Deposit Paid (₦)</label>
                      <Input type="number" placeholder="3000" value={tDeposit} onChange={e=>setTDeposit(e.target.value)} className="h-11 rounded-lg font-bold text-emerald-600" />
                    </div>
                  </div>
                  <div className="space-y-1.5 pb-2">
                    <label className="text-[13px] font-semibold text-foreground">Return Visit Date</label>
                    <Input type="date" value={tReturnDate} onChange={e=>setTReturnDate(e.target.value)} className="h-11 rounded-lg" />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold">
                    Save Treatment Record
                  </Button>
                </form>
              </Card>

              <Card className="p-7 rounded-xl border shadow-xs min-h-[500px]">
                <h2 className="text-lg font-extrabold text-foreground tracking-tight mb-1">Active Patient Treatments</h2>
                <p className="text-[13px] text-muted-foreground mb-6">Track deposits, balances, and return visit schedules.</p>
                <div className="flex flex-col gap-3.5">
                  {treatments.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">No active treatments logged.</div>
                  ) : treatments.map(t => (
                    <div key={t.id} className="p-5 rounded-2xl border bg-muted/20 flex justify-between gap-5 flex-wrap transition-shadow hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                          <span className="text-[15px] font-bold text-foreground">{t.patient_name}</span>
                          {t.patient_age && <Badge variant="secondary" className="px-2 py-0 text-[11px] font-normal h-5 rounded-md">({t.patient_age}yrs, {t.patient_weight||'—'}kg)</Badge>}
                        </div>
                        <p className="text-[13px] font-semibold text-purple-700 mb-1">{t.diagnosis}</p>
                        <p className="text-xs text-muted-foreground">Drugs: {t.drug_used}</p>
                        {t.return_date && <p className="text-xs font-semibold text-amber-600 mt-2">📅 Return: {t.return_date}</p>}
                      </div>
                      <div className="text-right shrink-0 flex flex-col justify-between items-end">
                        <div>
                          <span className="text-[11px] text-muted-foreground font-semibold block">Balance</span>
                          <span className="text-2xl font-black text-foreground tabular-nums"><Money amount={t.balance_remaining} /></span>
                          <span className="text-[11px] text-muted-foreground block mt-1">
                            Charged: <Money amount={t.amount_charged} /> | Dep: <Money amount={t.deposit_paid} />
                          </span>
                        </div>
                        {t.balance_remaining > 0 && (
                          <Button 
                            size="sm"
                            className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 h-8 text-xs font-bold"
                            onClick={() => {
                              const p = prompt(`Collect balance for ${t.patient_name} (₦${t.balance_remaining.toLocaleString()}):`, t.balance_remaining)
                              if (p && !isNaN(p)) {
                                handleCollectBalance(t, p)
                              }
                            }}
                          >
                            Collect Balance
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ╔═══════════════════════════════════════════════╗
             ║  MODULE 4 — CLOSE DAY                        ║
             ╚═══════════════════════════════════════════════╝ */}
          {activeModule === 'close_day' && (
            <Card className="p-8 max-w-4xl mx-auto rounded-xl border shadow-xs">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Daily Cashier Reconciliation</h2>
              <p className="text-[13px] text-muted-foreground mb-8">Compare system figures against hand-counted totals. Any gap is highlighted.</p>

              <div className="grid grid-cols-2 gap-8">
                {/* System figures */}
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-[11px] font-bold text-blue-800/60 uppercase tracking-widest border-b border-blue-100 pb-2.5 mb-4">System Calculated</h3>
                  <div className="flex flex-col gap-3 text-[13px]">
                    {[['Expected Cash', systemTotals.cash],['Expected POS', systemTotals.pos1],['Expected Transfer', systemTotals.transfer]].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-bold tabular-nums"><Money amount={val} /></span>
                      </div>
                    ))}
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>Credit Owed</span><span className="tabular-nums"><Money amount={systemTotals.credit} /></span>
                    </div>
                    <div className="flex justify-between text-red-600 border-t border-blue-100 pt-3 mt-1">
                      <span>Less Expenses</span><span className="font-bold tabular-nums">- <Money amount={systemTotals.totalExp} /></span>
                    </div>
                    <div className="flex justify-between text-base font-black text-blue-900 border-t border-blue-200 pt-3 mt-1">
                      <span>System Net</span><span className="tabular-nums"><Money amount={systemTotals.grandTotal} /></span>
                    </div>
                  </div>
                </div>

                {/* Hand counted */}
                <div>
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-2.5 mb-4">Hand-Counted Figures</h3>
                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    {[['Physical Cash', countedCash, setCountedCash, 'cc'],['POS Slips (Total)', countedPos1, setCountedPos1, 'p1'],['Transfer Slip', countedTransfer, setCountedTransfer, 'tr']].map(([label, val, setter, key]) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-foreground">{label} (₦)</label>
                        <Input type="number" placeholder="0" value={val} onChange={e=>setter(e.target.value)}
                          className="font-bold tabular-nums h-10 rounded-lg" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 mb-5">
                    <label className="text-xs font-semibold text-foreground">Change Float (₦)</label>
                    <Input type="number" placeholder="2000" value={changeFloat} onChange={e=>setChangeFloat(e.target.value)}
                      className="font-bold tabular-nums h-11 rounded-lg" />
                  </div>

                  {/* Gap indicator */}
                  <div className={cn(
                    "p-4 rounded-xl flex items-center justify-between mb-5 border-2",
                    closeDayDifference === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : 
                    closeDayDifference < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"
                  )}>
                    <div>
                      <span className="font-bold text-[13px] block">Reconciliation Gap</span>
                      <span className="text-[11px] opacity-80 font-medium">
                        {closeDayDifference === 0 ? 'Perfect match!' : closeDayDifference < 0 ? `Shortage ₦${Math.abs(closeDayDifference).toLocaleString()}` : `Overage ₦${closeDayDifference.toLocaleString()}`}
                      </span>
                    </div>
                    <span className="text-2xl font-black tabular-nums"><Money amount={closeDayDifference} /></span>
                  </div>

                  <Button onClick={handleLockDay} disabled={dayLocked} className={cn(
                    "w-full h-12 rounded-xl font-bold text-sm transition-all",
                    dayLocked ? "bg-muted text-muted-foreground" : "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20"
                  )}>
                    {dayLocked ? '✓ Day Locked & Submitted' : 'Lock Day & Submit Summary'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

        </div>
      </main>

      {/* ╔═══════════════════════════════════════════════════╗
         ║  RECEIPT MODAL                                   ║
         ╚═══════════════════════════════════════════════════╝ */}
      <Dialog open={!!receiptOrder} onOpenChange={(open) => !open && setReceiptOrder(null)}>
        <DialogContent className="sm:max-w-[420px] p-6 bg-transparent border-none shadow-none text-center">
          <DialogTitle className="sr-only">Receipt</DialogTitle>
          <DialogDescription className="sr-only">Order receipt details</DialogDescription>
          
          <div className="w-full">
            <div id="printable-thermal-receipt" className="receipt-paper border border-dashed border-zinc-300 p-6 px-4 rounded-xl bg-white font-mono text-xs text-zinc-900 mx-auto w-full text-left">
              {/* Header & Logo Container */}
              <div className="text-center border-b border-dashed border-zinc-300 pb-3 mb-3">
                <div className="flex justify-center mb-2">
                  <img
                    src="/logo.jpg"
                    alt="Emmanuel Pharmacy Logo"
                    onError={(e) => {
                      if (e.currentTarget.src.endsWith('/logo.jpg')) {
                        e.currentTarget.src = '/logo.png';
                      } else {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                      }
                    }}
                    className="max-h-14 object-contain mb-1"
                  />
                  <div className="hidden w-10 h-10 rounded-xl bg-gradient-to-br from-blue-800 to-blue-500 items-center justify-center text-white font-black text-xl shadow-sm">
                    <Pill className="w-5 h-5" />
                  </div>
                </div>

                <h2 className="font-black text-base text-black tracking-wider m-0">
                  EMMANUEL PHARMACY
                </h2>
                <p className="text-[10.5px] font-bold text-blue-800 mt-1 italic">
                  "Your health, our priority"
                </p>

                {(receiptOrder?.is_offline_pending || receiptOrder?.status === 'pending_sync') && (
                  <div className="mt-2 bg-red-50 border border-dashed border-red-500 text-red-700 p-1.5 rounded-lg font-bold text-[11px] text-center">
                    ⚠️ STATUS: PENDING SYNC (OFFLINE)
                  </div>
                )}

                {/* Contact & Branch Information */}
                <div className="mt-2.5 text-[9.5px] text-zinc-700 leading-relaxed text-center">
                  <div className="font-bold text-zinc-900 uppercase tracking-wider">
                    📍 Main Branch (HQ)
                  </div>
                  <div>Dr. Collins Okorie Str. Hausa Qtrs.</div>
                  <div>Tel: 07064611925</div>
                  <div>Email: chukwunonsoozo@gmail.com</div>

                  <div className="mt-1.5 font-bold text-zinc-900 uppercase tracking-wider">
                    📍 Branch 2
                  </div>
                  <div>No 198 Nkaliki road, Abakaliki</div>
                  <div>Tel: 07064611925</div>
                </div>
              </div>

              {/* Reference & Timestamp */}
              <div className="flex justify-between text-xs font-bold border-b border-dashed border-zinc-300 pb-2 mb-2">
                <span>REF: {receiptOrder?.receipt_ref}</span>
                <span>{(receiptOrder?.paid_at || receiptOrder?.created_at) ? new Date(receiptOrder?.paid_at || receiptOrder?.created_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour:'2-digit', minute:'2-digit' }) : ''} WAT</span>
              </div>

              {/* Order Meta & Staff */}
              <div className="text-[11px] mb-2.5 leading-relaxed text-zinc-700">
                <p>Date: {(receiptOrder?.paid_at || receiptOrder?.created_at) ? new Date(receiptOrder?.paid_at || receiptOrder?.created_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) : ''}</p>
                <p>Location Served: Main Branch (Dr. Collins Okorie Str.)</p>
                <p>Attendant: {receiptOrder?.attendant_name || 'attendant1'}</p>
                <p>Cashier: {cashierName}</p>
                {(receiptOrder?.customer_name || receiptOrder?.is_credit) && (
                  <p className="font-bold text-blue-800 mt-0.5">
                    Customer: {receiptOrder?.customer_name || 'N/A'} {receiptOrder?.customer_phone ? `(${receiptOrder?.customer_phone})` : ''}
                  </p>
                )}
              </div>

              {/* Purchased Items List */}
              <div className="border-t border-b border-dashed border-zinc-300 py-2 mb-2.5">
                {receiptOrder?.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="tabular-nums font-medium"><Money amount={(item.total_price || item.unit_price * item.quantity)} /></span>
                  </div>
                ))}
              </div>

              {/* Total & Payment Method */}
              <div className="flex justify-between font-black text-sm text-black mb-1">
                <span>{(receiptOrder?.is_offline_pending || receiptOrder?.status === 'pending_sync') ? 'TOTAL QUEUED' : 'TOTAL PAID'}</span>
                <span className="tabular-nums"><Money amount={receiptOrder?.total_amount} /></span>
              </div>
              <div className="flex justify-between text-[11px] mb-3">
                <span>Method:</span><span className="font-bold text-blue-800">{receiptOrder?.payment_method} {(receiptOrder?.is_offline_pending || receiptOrder?.status === 'pending_sync') ? '(Offline Queued)' : ''}</span>
              </div>

              {/* Footer */}
              <div className="text-center border-t border-dashed border-zinc-300 pt-2.5 text-[9.5px] text-zinc-500 leading-relaxed">
                {(receiptOrder?.is_offline_pending || receiptOrder?.status === 'pending_sync') && (
                  <p className="font-bold text-red-600 mb-1">
                    ⚠️ UNCONFIRMED SALE — QUEUED OFFLINE ON DEVICE
                  </p>
                )}
                <p className="font-bold text-zinc-900">Thank you for your patronage!</p>
                <p>No refund without receipt</p>
                <p>Keep medicines out of reach of children</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 mt-4">
              <Button onClick={() => setReceiptOrder(null)} variant="outline" className="flex-1 h-12 rounded-xl font-semibold">
                Close
              </Button>
              <Button onClick={() => printThermalReceipt('printable-thermal-receipt')} className="flex-1 h-12 rounded-xl font-bold bg-blue-800 hover:bg-blue-900 gap-2">
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
