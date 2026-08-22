import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import { printThermalReceipt } from '../utils/printReceipt'
import { toast } from 'sonner'

import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Separator } from '../components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { cn } from '../lib/utils'

import Money from '../components/pos/Money'
import SyncBadge from '../components/pos/SyncBadge'
import EmptyState from '../components/pos/EmptyState'
import OrderRow from '../components/pos/OrderRow'
import PaymentMethodPicker from '../components/pos/PaymentMethodPicker'
import ReconRow from '../components/pos/ReconRow'

import {
  LogOut, Receipt, Pill, Lock, Printer, Loader2, CheckCircle2,
  AlertCircle, Plus, DollarSign, Wallet, Search, Inbox,
  MoreHorizontal, ChevronRight, X, AlertTriangle, ShieldCheck, Sun, Moon,
  Stethoscope, Calendar, User, Hash, HelpCircle, FileText, RotateCw
} from 'lucide-react'

/* ─── Initial orders (empty, fetched live from Supabase) ────────── */
const INITIAL_MOCK_ORDERS = []

/* ─── Utility: relative & server timezone date helpers ─────────── */
const timeAgo = (iso) => {
  if (!iso) return 'just now'
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

/* ─── Module constants ─────────────────────────────────────────── */
const MODULES = [
  { id: 'payments', label: 'Payments', icon: Receipt },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'treatments', label: 'Treatments', icon: Stethoscope },
  { id: 'close_day', label: 'Close Day', icon: Lock },
]
const EXPENSE_CATS = ['Fuel / Generator', 'Water', 'Transport', 'Staff Expenses', 'Repairs & Maintenance', 'Supplies', 'Misc']

export default function CashierPage() {
  const navigate = useNavigate()
  const { logout, user, fullName, username } = useAuth()
  const { queueOfflinePayment } = useSync()

  /* ── Core State ───────────────────────────────────────────── */
  const [activeModule, setActiveModule] = useState('payments')
  const [queueTab, setQueueTab] = useState('waiting')
  const [orders, setOrders] = useState(INITIAL_MOCK_ORDERS)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState([])
  const [paymentAmounts, setPaymentAmounts] = useState({ Cash: '', POS: '', Transfer: '', Credit: '' })
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [receiptOrder, setReceiptOrder] = useState(null)
  const [paymentError, setPaymentError] = useState(null)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const prevSelectedOrderIdRef = useRef(null)

  // Mobile Sheet for detail
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false)

  // Expenses State
  const [expenses, setExpenses] = useState([])
  const [expCategory, setExpCategory] = useState('Fuel / Generator')
  const [expAmount, setExpAmount] = useState('')
  const [expMethod, setExpMethod] = useState('Cash')
  const [expNote, setExpNote] = useState('')

  // Treatments State
  const [treatments, setTreatments] = useState([])
  const [tName, setTName] = useState('')
  const [tAge, setTAge] = useState('')
  const [tWeight, setTWeight] = useState('')
  const [tDiagnosis, setTDiagnosis] = useState('')
  const [tDrug, setTDrug] = useState('')
  const [tCharge, setTCharge] = useState('')
  const [tDeposit, setTDeposit] = useState('')
  const [tReturnDate, setTReturnDate] = useState('')

  // Close Day State
  const [countedCash, setCountedCash] = useState('')
  const [countedPos1, setCountedPos1] = useState('')
  const [countedPos2, setCountedPos2] = useState('')
  const [countedTransfer, setCountedTransfer] = useState('')
  const [changeFloat, setChangeFloat] = useState('2000')
  const [dayLocked, setDayLocked] = useState(false)
  const [diffReason, setDiffReason] = useState('')
  const [showHowCalculated, setShowHowCalculated] = useState(false)

  // Settings Limits
  const [dailyExpenseLimit, setDailyExpenseLimit] = useState(25000)
  const [mismatchAlertLimit, setMismatchAlertLimit] = useState(5000)

  // System totals
  const [lastCloseAt, setLastCloseAt] = useState(null)
  const [creditRepayments, setCreditRepayments] = useState([])

  // Modal / Alert confirmations
  const [showSignOutAlert, setShowSignOutAlert] = useState(false)
  const [cancelOrderTargetId, setCancelOrderTargetId] = useState(null)
  const [voidExpenseTarget, setVoidExpenseTarget] = useState(null)
  const [showCloseDayConfirm, setShowCloseDayConfirm] = useState(false)
  const [typedCloseConfirm, setTypedCloseConfirm] = useState('')

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

  const activeOrder = useMemo(() => orders.find(o => o.id === selectedOrderId) || null, [orders, selectedOrderId])

  // Auto-select first matching order when searching
  useEffect(() => {
    if (searchQuery.trim() && displayOrders.length > 0) {
      if (!displayOrders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(displayOrders[0].id)
      }
    }
  }, [searchQuery, displayOrders, selectedOrderId])

  const confirmCancelOrder = async (orderId) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
    setSelectedOrderId(prev => prev === orderId ? null : prev)
    setIsMobileDetailOpen(false)
    if (supabase && !orderId.startsWith('mock')) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    }
    toast.success('Order cancelled and removed from queue')
    setCancelOrderTargetId(null)
  }

  // Reset selected methods and typed amounts when order changes
  useEffect(() => {
    if (prevSelectedOrderIdRef.current !== selectedOrderId) {
      prevSelectedOrderIdRef.current = selectedOrderId
      setSelectedPaymentMethods([])
      setPaymentAmounts({ Cash: '', POS: '', Transfer: '', Credit: '' })
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

  // Auto-fill full total when single method selected
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

  const remainingPaymentBalance = useMemo(() => {
    if (!activeOrder) return 0
    return Math.max(0, Number(activeOrder.total_amount) - enteredPaymentTotal)
  }, [activeOrder, enteredPaymentTotal])

  const hasCreditSelected = selectedPaymentMethods.includes('Credit')
  const isCreditValid = !hasCreditSelected || (customerName.trim().length > 0 && customerPhone.trim().length > 0)

  const isBalanced = useMemo(() => {
    if (!activeOrder) return false
    return Math.abs(enteredPaymentTotal - Number(activeOrder.total_amount)) < 0.01 && isCreditValid
  }, [enteredPaymentTotal, activeOrder, isCreditValid])

  // Cash change due calculation
  const cashTendered = Number(paymentAmounts.Cash) || 0
  const cashChangeDue = useMemo(() => {
    if (!selectedPaymentMethods.includes('Cash') || !activeOrder) return 0
    const targetCashAmt = selectedPaymentMethods.length === 1 ? Number(activeOrder.total_amount) : Number(paymentAmounts.Cash) || 0
    return Math.max(0, cashTendered - targetCashAmt)
  }, [selectedPaymentMethods, activeOrder, paymentAmounts.Cash, cashTendered])

  // System totals for Close Day
  const systemTotals = useMemo(() => {
    const paid = orders.filter(o => {
      if (o.status !== 'paid') return false
      if (!lastCloseAt) return true
      const paidTime = o.paid_at || o.updated_at || o.created_at
      return new Date(paidTime) > new Date(lastCloseAt)
    })

    let cash = 0, pos1 = 0, pos2 = 0, transfer = 0, credit = 0

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

    const relevantExpenses = expenses.filter(e => {
      if (!lastCloseAt) return true
      return new Date(e.created_at) > new Date(lastCloseAt)
    })
    const totalExp = relevantExpenses.reduce((s, e) => s + Number(e.amount), 0)

    return { cash, pos1, pos2: 0, transfer, credit, totalExp, grandTotal: cash + pos1 + transfer - totalExp, previousCloseAt: lastCloseAt }
  }, [orders, expenses, creditRepayments, lastCloseAt])

  /*
   * Reconciliation Shortage Calculation Working:
   * Counted cash attributable to sales = (Physical cash counted) - (Opening float)
   * Net counted = (Cash attributable to sales) + POS slips + Transfer slips
   * Difference = Net counted - System Net
   */
  const netHandCountedSales = useMemo(() => {
    const cCash = (Number(countedCash) || 0) - (Number(changeFloat) || 0)
    const cPos = Number(countedPos1) || 0
    const cTrans = Number(countedTransfer) || 0
    return cCash + cPos + cTrans
  }, [countedCash, countedPos1, countedTransfer, changeFloat])

  const closeDayDifference = useMemo(() => {
    return netHandCountedSales - systemTotals.grandTotal
  }, [netHandCountedSales, systemTotals.grandTotal])

  /* ═══════ Actions ═════════════════════════════════════════ */
  const togglePaymentMethod = m => {
    setSelectedPaymentMethods(prev =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m])
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
          setIsMobileDetailOpen(false)
          toast.success(`Payment confirmed for Order #${activeOrder.order_number}`)
          return
        }
      }
    } catch (err) {
      console.warn('⚠️ Network error on payment update, queuing offline payment:', err)
    }

    // Offline fallback
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
    setIsMobileDetailOpen(false)
    toast.success(`Payment queued offline for Order #${activeOrder.order_number}`)
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
    toast.success(`Expense of ₦${amt.toLocaleString()} logged`)
  }

  const handleVoidExpense = async (expenseId) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId))
    if (supabase && !String(expenseId).startsWith('exp-')) {
      await supabase.from('expenses').delete().eq('id', expenseId)
    }
    toast.success('Expense voided')
    setVoidExpenseTarget(null)
  }

  const handleLockDay = async () => {
    if (typedCloseConfirm.trim().toUpperCase() !== 'CLOSE') return
    setDayLocked(true)
    setShowCloseDayConfirm(false)
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
          closed_by: cashierName,
          reason_for_difference: diffReason.trim()
        })

        if (diff !== 0) {
          const isShortage = diff < 0
          const diffType = isShortage ? 'Shortage' : 'Surplus / Excess'
          const absDiff = Math.abs(diff)
          const diffSign = isShortage ? '-' : '+'
          const reasonText = diffReason.trim() ? ` (Reason provided: "${diffReason.trim()}")` : ''

          await supabase.from('notifications').insert({
            type: 'cash_mismatch',
            title: `⚠️ Day Close Cash Mismatch (${diffType})`,
            message: `Cashier ${cashierName} closed shift with a ${diffType.toLowerCase()} of ${diffSign}₦${absDiff.toLocaleString('en-NG')}. Expected sales: ₦${Math.round(systemTotals.grandTotal).toLocaleString('en-NG')}, Actual counted: ₦${Math.round(netHandCountedSales).toLocaleString('en-NG')}${reasonText}.`,
            data: {
              type: 'cash_mismatch',
              cashier_name: cashierName,
              expected_total: systemTotals.grandTotal,
              counted_total: netHandCountedSales,
              difference: diff,
              difference_amount: absDiff,
              is_shortage: isShortage,
              reason: diffReason.trim(),
              date: new Date().toISOString()
            },
            is_read: false
          })
        }
      } catch (err) {
        console.warn('Day close DB insert error:', err)
      }
    }
    toast.success('Trading day closed and shift figures locked')
  }

  const handleAddTreatment = async e => {
    e.preventDefault()
    if (!tName.trim() || !tDiagnosis.trim() || !tCharge) return
    const charge = Number(tCharge)
    const deposit = Number(tDeposit) || 0
    const balance = Math.max(0, charge - deposit)

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
      status: balance === 0 ? 'completed' : 'active',
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
          status: balance === 0 ? 'completed' : 'active',
          recorded_by: cashierName
        })
        loadTreatments()
      } catch (err) {
        console.warn('DB treatments insert error:', err)
      }
    }

    setTName(''); setTAge(''); setTWeight(''); setTDiagnosis('')
    setTDrug(''); setTCharge(''); setTDeposit(''); setTReturnDate('')
    toast.success('Treatment record saved')
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
    toast.success(`Collected ₦${amt.toLocaleString()} for ${treatment.patient_name}`)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const cashierName = fullName || username || 'Cashier'
  const dateStr = new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })

  // Mask patient name to initials for privacy
  const getPatientInitialsName = (name) => {
    if (!name) return 'Patient'
    const parts = name.split(' ')
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts.slice(1).map(p => p[0] + '.').join(' ')}`
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER DETAIL PANEL CONTENT (Shared for Desktop & Mobile Sheet)
     ═══════════════════════════════════════════════════════════ */
  const renderPaymentDetail = () => {
    if (!activeOrder) {
      return (
        <Card className="h-full flex items-center justify-center p-8 border border-border bg-card shadow-2xs rounded-xl">
          <EmptyState
            icon={Receipt}
            title="Select an order"
            description="Choose from the queue or search by order number"
          />
        </Card>
      )
    }

    return (
      <Card className="h-full flex flex-col border border-border bg-card shadow-2xs rounded-xl overflow-hidden min-w-0">
        {/* Detail Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-semibold text-foreground">
                Order #{activeOrder.order_number}
              </span>
              <Badge variant="outline" className="text-xs">
                Ref: {activeOrder.receipt_ref || 'EP-1234'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Attendant: <span className="font-medium text-foreground">{activeOrder.attendant_name || 'Attendant'}</span> · {timeAgo(activeOrder.created_at)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setReceiptOrder(activeOrder)}>
                <Printer className="h-4 w-4 mr-2" /> Print preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Order marked as held')}>
                <Inbox className="h-4 w-4 mr-2" /> Hold order
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCancelOrderTargetId(activeOrder.id)} className="text-destructive focus:text-destructive">
                <X className="h-4 w-4 mr-2" /> Cancel order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Detail Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scroll">
          {/* Items Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="h-9 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Item</TableHead>
                  <TableHead className="text-center text-xs font-medium text-muted-foreground w-14">Qty</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground w-20">Price</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground w-24">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {activeOrder.items && activeOrder.items.length > 0 ? (
                  activeOrder.items.map((item, idx) => (
                    <TableRow key={idx} className="h-11 hover:bg-muted/30">
                      <TableCell className="text-xs font-medium text-foreground py-2 line-clamp-2">
                        {item.product_name || item.name}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums py-2">
                        {item.qty || item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums py-2">
                        <Money amount={item.unit_price || item.price} />
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-foreground tabular-nums py-2">
                        <Money amount={item.total_price || (item.price * item.quantity)} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                      No itemized list available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Grand Total Hero Box */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Payable</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{activeOrder.items?.length || 0} line items</p>
            </div>
            <div className="text-right">
              <Money amount={activeOrder.total_amount} className="text-3xl font-semibold tracking-tight text-foreground tabular-nums" />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">Select Payment Method</label>
            <PaymentMethodPicker
              selectedMethods={selectedPaymentMethods}
              onToggleMethod={togglePaymentMethod}
            />
          </div>

          {/* Payment Inputs for Selected Methods */}
          {selectedPaymentMethods.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
              {selectedPaymentMethods.map(method => (
                <div key={method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground">
                    <span>{method} Amount</span>
                    {selectedPaymentMethods.length > 1 && (
                      <span className="text-muted-foreground font-normal">Split component</span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={paymentAmounts[method]}
                      onChange={e => setPaymentAmounts({ ...paymentAmounts, [method]: e.target.value })}
                      className="pl-8 h-11 text-base font-semibold text-right tabular-nums"
                    />
                  </div>
                </div>
              ))}

              {/* Cash Quick Add Chips & Change Due Panel */}
              {selectedPaymentMethods.includes('Cash') && (
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[500, 1000, 2000, 5000].map(chip => (
                      <Button
                        key={chip}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const curr = Number(paymentAmounts.Cash) || 0
                          setPaymentAmounts({ ...paymentAmounts, Cash: String(curr + chip) })
                        }}
                        className="h-7 text-xs px-2 tabular-nums"
                      >
                        +₦{chip.toLocaleString()}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmounts({ ...paymentAmounts, Cash: String(activeOrder.total_amount) })}
                      className="h-7 text-xs px-2"
                    >
                      Exact
                    </Button>
                  </div>

                  {cashChangeDue > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                      <span className="text-xs font-medium">Change due to customer</span>
                      <Money amount={cashChangeDue} className="text-lg font-bold tabular-nums" />
                    </div>
                  )}
                </div>
              )}

              {/* Credit Customer Fields */}
              {hasCreditSelected && (
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>This sale will be recorded as money owed. Customer details are required.</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Customer Full Name *</label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Chief Emeka"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Customer Phone Number *</label>
                    <Input
                      type="tel"
                      required
                      placeholder="08031234567"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Split remaining balance prompt */}
              {selectedPaymentMethods.length > 1 && remainingPaymentBalance > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-right tabular-nums">
                  Remaining balance to assign: <Money amount={remainingPaymentBalance} />
                </p>
              )}
            </div>
          )}

          {/* Payment Error Banner */}
          {paymentError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}
        </div>

        {/* Pinned Bottom Action Bar */}
        <div className="p-4 border-t border-border bg-card flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => toast.info('Order placed on hold')}
            className="h-14 px-4 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
          >
            Hold
          </Button>

          <Button
            onClick={handleConfirmPayment}
            disabled={!isBalanced || isSubmittingPayment}
            className="h-14 flex-1 bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm shadow-sm gap-2"
          >
            {isSubmittingPayment ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Confirm payment · <Money amount={activeOrder.total_amount} className="inline text-white" /></span>
              </>
            )}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col overflow-x-hidden text-foreground">

      {/* ═══════════════════════════════════════════════════════════════
         1. STICKY APP HEADER (h-14)
         ═══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0">
        {/* Left Branding */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-brand-700 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs">
            EP
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">
            Emmanuel Pharmacy
          </span>
        </div>

        {/* Center Metadata Chip Group (Desktop Only) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Date:</span>
            <span className="font-medium text-foreground">{dateStr}</span>
          </div>
          <Separator orientation="vertical" className="h-3.5" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Cashier:</span>
            <span className="font-medium text-foreground">{cashierName}</span>
          </div>
          <Separator orientation="vertical" className="h-3.5" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Till:</span>
            <span className="font-medium text-foreground">Till 1</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SyncBadge />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSignOutAlert(true)}
            className="text-xs text-muted-foreground hover:text-destructive gap-1 px-2.5 h-8 font-medium border border-border sm:border-none"
          >
            <LogOut className="h-4 w-4 text-destructive" />
            <span className="text-xs">Sign out</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-border bg-card">
                <User className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                Signed in as <strong className="font-semibold text-foreground">{cashierName}</strong>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs space-y-1 md:hidden">
                <p className="text-muted-foreground">Date: <span className="text-foreground font-medium">{dateStr}</span></p>
                <p className="text-muted-foreground">Till: <span className="text-foreground font-medium">Till 1</span></p>
              </div>
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem onClick={async () => {
                toast.info('Clearing PWA cache and reloading...')
                if ('caches' in window) {
                  const keys = await caches.keys()
                  await Promise.all(keys.map(k => caches.delete(k)))
                }
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations()
                  for (const reg of regs) {
                    await reg.unregister()
                  }
                }
                window.location.href = window.location.pathname + '?v=' + Date.now()
              }}>
                <RotateCw className="h-4 w-4 mr-2 text-brand-700" /> Force Update App
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('System theme active')}>
                <Sun className="h-4 w-4 mr-2 text-muted-foreground" /> Switch theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSignOutAlert(true)} className="text-destructive focus:text-destructive font-semibold">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
         2. NAVIGATION & MAIN CONTENT AREA
         ═══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 w-full min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Header & Module Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {MODULES.find(m => m.id === activeModule)?.label}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accountable cashier workflow · Till 1
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSignOutAlert(true)}
              className="text-xs text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive/15 gap-1.5 h-9 font-semibold shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </Button>
          </div>

          <Tabs value={activeModule} onValueChange={setActiveModule} className="w-full">
            <TabsList className="bg-muted p-1 rounded-lg w-full overflow-x-auto custom-scroll flex">
              {MODULES.map(m => {
                const Icon = m.icon
                const isCloseDay = m.id === 'close_day'
                return (
                  <TabsTrigger
                    key={m.id}
                    value={m.id}
                    className={cn(
                      "text-xs font-medium px-3 py-1.5 gap-1.5 flex-1 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-xs data-[state=active]:text-foreground",
                      isCloseDay && "border-l border-border/60 ml-1"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{m.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
           MODULE 1: PAYMENTS (RESPONSIVE MASTER-DETAIL)
           ═══════════════════════════════════════════════════════════════ */}
        {activeModule === 'payments' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-6 min-w-0">

            {/* Left Column: Orders Queue */}
            <Card className="border border-border bg-card shadow-2xs rounded-xl flex flex-col h-[calc(100vh-220px)] min-h-[500px] overflow-hidden min-w-0">
              {/* Sub-tabs: Waiting vs Credit */}
              <div className="p-2 border-b border-border bg-muted/30">
                <Tabs value={queueTab} onValueChange={setQueueTab} className="w-full">
                  <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-lg">
                    <TabsTrigger value="waiting" className="text-xs font-medium gap-1.5">
                      <span>Waiting</span>
                      <Badge variant={queueTab === 'waiting' ? 'brand' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {waitingOrders.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="credit" className="text-xs font-medium gap-1.5">
                      <span>Unpaid / Credit</span>
                      <Badge variant={queueTab === 'credit' ? 'brand' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {creditOrders.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Queue Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="Search order number or attendant..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-10 text-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Queue List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border custom-scroll">
                {displayOrders.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No orders in queue"
                    description="Orders sent by attendants will appear here automatically."
                    className="py-16"
                  />
                ) : (
                  displayOrders.map(order => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      selected={selectedOrderId === order.id}
                      timeAgoText={timeAgo(order.created_at)}
                      onClick={() => {
                        setSelectedOrderId(order.id)
                        setIsMobileDetailOpen(true)
                      }}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Right Column (Desktop): Payment Detail Panel */}
            <div className="hidden lg:block h-[calc(100vh-220px)] min-h-[500px] min-w-0">
              {renderPaymentDetail()}
            </div>

            {/* Mobile Sheet Detail Drawer */}
            <Sheet open={isMobileDetailOpen} onOpenChange={setIsMobileDetailOpen}>
              <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col lg:hidden rounded-t-2xl">
                <SheetHeader className="p-4 border-b border-border sr-only">
                  <SheetTitle>Payment Details</SheetTitle>
                  <SheetDescription>Process order payment</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-hidden p-2">
                  {renderPaymentDetail()}
                </div>
              </SheetContent>
            </Sheet>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           MODULE 2: EXPENSES LOG
           ═══════════════════════════════════════════════════════════════ */}
        {activeModule === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start min-w-0">

            {/* Left: Log Shop Expense Card */}
            <Card className="p-6 border border-border bg-card shadow-2xs rounded-xl space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Log shop expense</h2>
                <p className="text-xs text-muted-foreground">Record any outgoing cash or POS payment.</p>
              </div>

              {/* Daily Limit Warning Banner */}
              {expenses.reduce((s, e) => s + Number(e.amount), 0) + (Number(expAmount) || 0) > dailyExpenseLimit && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    This brings today's expenses to <Money amount={expenses.reduce((s, e) => s + Number(e.amount), 0) + (Number(expAmount) || 0)} className="inline font-semibold" /> of the <Money amount={dailyExpenseLimit} className="inline font-semibold" /> limit.
                  </span>
                </div>
              )}

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <Select value={expCategory} onValueChange={setExpCategory}>
                    <SelectTrigger className="h-11 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATS.map(c => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Amount (₦) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      required
                      placeholder="3500"
                      value={expAmount}
                      onChange={e => setExpAmount(e.target.value)}
                      className="pl-7 h-11 text-sm font-semibold text-right tabular-nums"
                    />
                  </div>
                  {expAmount && Number(expAmount) > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                      Approximately ₦{Number(expAmount).toLocaleString()} Naira
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Payment Method <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'POS', 'POS 2', 'Transfer'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExpMethod(m)}
                        className={cn(
                          "h-10 text-xs rounded-lg border font-medium transition-all",
                          expMethod === m
                            ? "border-brand-700 bg-brand-50/80 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 font-semibold"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Description / Note <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Petrol for generator evening"
                    value={expNote}
                    onChange={e => setExpNote(e.target.value)}
                    className="h-11 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setExpAmount(''); setExpNote('') }}
                    className="text-xs text-muted-foreground"
                  >
                    Clear
                  </Button>
                  <Button
                    type="submit"
                    disabled={!expAmount || Number(expAmount) <= 0}
                    className="bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold h-10 px-4"
                  >
                    Save expense
                  </Button>
                </div>
              </form>
            </Card>

            {/* Right: Today's Expenses List */}
            <Card className="p-6 border border-border bg-card shadow-2xs rounded-xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Today's expenses</h2>
                  <p className="text-xs text-muted-foreground">Deducted automatically during Close Day</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Today</p>
                  <Money
                    amount={expenses.reduce((s, e) => s + Number(e.amount), 0)}
                    className="text-2xl font-semibold tracking-tight text-foreground tabular-nums"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="h-9 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Method</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Note</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Logged By</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                          <EmptyState
                            icon={Receipt}
                            title="No expenses logged today"
                            description="Use the left panel to record shop expenditures."
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map(exp => (
                        <TableRow key={exp.id} className="h-11 hover:bg-muted/30">
                          <TableCell className="text-xs font-medium text-foreground">{exp.category}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-foreground tabular-nums">
                            <Money amount={exp.amount} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{exp.payment_method}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={exp.note}>
                            {exp.note || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{exp.recorded_by}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => toast.info(exp.note || 'No note attached')}>
                                  View note
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setVoidExpenseTarget(exp)} className="text-destructive focus:text-destructive">
                                  Void expense
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           MODULE 3: TREATMENTS
           ═══════════════════════════════════════════════════════════════ */}
        {activeModule === 'treatments' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr] gap-6 items-start min-w-0">

            {/* Left: Treatment Form */}
            <Card className="p-6 border border-border bg-card shadow-2xs rounded-xl space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Record Treatment</h2>
                <p className="text-xs text-muted-foreground">Log wound dressing, injections, or clinical procedures.</p>
              </div>

              <form onSubmit={handleAddTreatment} className="space-y-4">
                {/* Fieldset 1: Patient */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Patient Info</legend>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Patient Full Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Mrs. Florence Nnaji"
                      value={tName}
                      onChange={e => setTName(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Age (yrs)</label>
                      <Input
                        type="number"
                        placeholder="42"
                        value={tAge}
                        onChange={e => setTAge(e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Weight (kg)</label>
                      <Input
                        type="number"
                        placeholder="68"
                        value={tWeight}
                        onChange={e => setTWeight(e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    🔒 Patient details are stored for treatment follow-up only.
                  </p>
                </fieldset>

                <Separator />

                {/* Fieldset 2: Treatment */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Procedure Details</legend>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Diagnosis / Procedure <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Leg Ulcer Wound Dressing"
                      value={tDiagnosis}
                      onChange={e => setTDiagnosis(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Drugs & Supplies Used</label>
                    <Input
                      type="text"
                      placeholder="e.g. Gauze, Iodine, Bandage"
                      value={tDrug}
                      onChange={e => setTDrug(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                </fieldset>

                <Separator />

                {/* Fieldset 3: Payment & Balance */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Financials</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Total Charge (₦) <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          required
                          placeholder="6000"
                          value={tCharge}
                          onChange={e => setTCharge(e.target.value)}
                          className="pl-6 h-10 text-xs font-semibold tabular-nums text-right"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Deposit Paid (₦)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="3000"
                          value={tDeposit}
                          onChange={e => setTDeposit(e.target.value)}
                          className="pl-6 h-10 text-xs font-semibold tabular-nums text-right text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Computed Read-Only Balance Due Row */}
                  <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Balance Due</span>
                    <Money
                      amount={Math.max(0, (Number(tCharge) || 0) - (Number(tDeposit) || 0))}
                      className={cn(
                        "text-base font-semibold tabular-nums",
                        (Number(tCharge) || 0) - (Number(tDeposit) || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    />
                  </div>
                </fieldset>

                <Separator />

                {/* Fieldset 4: Follow-up */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">Follow-up Schedule</legend>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Return Visit Date</label>
                    <Input
                      type="date"
                      value={tReturnDate}
                      onChange={e => setTReturnDate(e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '+3 days', days: 3 },
                      { label: '+1 week', days: 7 },
                      { label: '+2 weeks', days: 14 }
                    ].map(chip => (
                      <Button
                        key={chip.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const d = new Date()
                          d.setDate(d.getDate() + chip.days)
                          setTReturnDate(d.toISOString().split('T')[0])
                        }}
                        className="h-7 text-[11px] px-2"
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTName(''); setTAge(''); setTWeight(''); setTDiagnosis('')
                      setTDrug(''); setTCharge(''); setTDeposit(''); setTReturnDate('')
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    Clear
                  </Button>
                  <Button
                    type="submit"
                    className="bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold h-10 px-4"
                  >
                    Save treatment record
                  </Button>
                </div>
              </form>
            </Card>

            {/* Right: Active Treatments */}
            <Card className="p-6 border border-border bg-card shadow-2xs rounded-xl space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Active Patient Treatments</h2>
                <p className="text-xs text-muted-foreground">Track deposits, balances, and scheduled return visits.</p>
              </div>

              <div className="space-y-3">
                {treatments.length === 0 ? (
                  <EmptyState
                    icon={Stethoscope}
                    title="No active treatments"
                    description="Treatment records will appear here after creation."
                    className="py-16"
                  />
                ) : (
                  treatments.map(t => {
                    const isOverdue = t.return_date && new Date(t.return_date) < new Date()
                    return (
                      <div key={t.id} className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {/* Privacy-masked name */}
                            <span className="text-sm font-semibold text-foreground">
                              {getPatientInitialsName(t.patient_name)}
                            </span>
                            {t.patient_age && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t.patient_age}yrs{t.patient_weight ? `, ${t.patient_weight}kg` : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-brand-700 dark:text-brand-400">{t.diagnosis}</p>
                          <p className="text-xs text-muted-foreground">Drugs: {t.drug_used || 'None listed'}</p>
                          {t.return_date && (
                            <p className={cn("text-[11px] font-medium flex items-center gap-1", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                              <Calendar className="h-3 w-3" />
                              Return: {t.return_date} {isOverdue && '(Overdue)'}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Balance</p>
                            {t.balance_remaining === 0 ? (
                              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs">
                                Settled
                              </Badge>
                            ) : (
                              <Money amount={t.balance_remaining} className="text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums" />
                            )}
                          </div>

                          {t.balance_remaining > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const p = prompt(`Collect balance for ${t.patient_name} (₦${t.balance_remaining.toLocaleString()}):`, t.balance_remaining)
                                if (p && !isNaN(p)) {
                                  handleCollectBalance(t, p)
                                }
                              }}
                              className="text-xs font-medium h-8 border-brand-700 text-brand-700 dark:text-brand-400"
                            >
                              Collect Balance
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           MODULE 4: CLOSE DAY / RECONCILIATION
           ═══════════════════════════════════════════════════════════════ */}
        {activeModule === 'close_day' && (
          <Card className="p-6 border border-border bg-card shadow-2xs rounded-xl max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Close day</h2>
              <p className="text-xs text-muted-foreground">Compare system figures against your hand-counted totals.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT: System Calculated */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">System Calculated</h3>

                <div className="space-y-1">
                  <ReconRow label="Expected Cash" amount={systemTotals.cash} />
                  <ReconRow label="Expected POS Slips" amount={systemTotals.pos1} />
                  <ReconRow label="Expected Transfers" amount={systemTotals.transfer} />
                  <ReconRow label="Credit Issued" amount={systemTotals.credit} colorClass="text-amber-600 dark:text-amber-400" />
                  <ReconRow label="Less Shop Expenses" amount={systemTotals.totalExp} isDeduction={true} colorClass="text-muted-foreground" />
                  <ReconRow label="System Net" amount={systemTotals.grandTotal} isNet={true} />
                </div>
              </div>

              {/* RIGHT: Hand-Counted Inputs */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Hand-Counted Figures</h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Physical Cash (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        disabled={dayLocked}
                        placeholder="0"
                        value={countedCash}
                        onChange={e => setCountedCash(e.target.value)}
                        className="pl-7 h-11 text-sm font-semibold text-right tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">POS Slips Total (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        disabled={dayLocked}
                        placeholder="0"
                        value={countedPos1}
                        onChange={e => setCountedPos1(e.target.value)}
                        className="pl-7 h-11 text-sm font-semibold text-right tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Transfer Slips Total (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        disabled={dayLocked}
                        placeholder="0"
                        value={countedTransfer}
                        onChange={e => setCountedTransfer(e.target.value)}
                        className="pl-7 h-11 text-sm font-semibold text-right tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                {/* Change Float Grouped Separately */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                  <label className="text-xs font-medium text-foreground block">Opening Change Float (₦)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      disabled={dayLocked}
                      placeholder="2000"
                      value={changeFloat}
                      onChange={e => setChangeFloat(e.target.value)}
                      className="pl-7 h-10 text-sm font-semibold text-right tabular-nums"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Excluded from shortage calculation.
                  </p>
                </div>

              </div>
            </div>

            {/* Reconciliation Gap Panel */}
            <div className={cn(
              "p-6 rounded-xl border transition-all space-y-4",
              closeDayDifference === 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : closeDayDifference < 0
                  ? "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
            )}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider">Reconciliation Gap</p>
                  <p className="text-base font-semibold mt-0.5">
                    {closeDayDifference === 0
                      ? 'Balanced'
                      : closeDayDifference < 0
                        ? `Short by ₦${Math.abs(closeDayDifference).toLocaleString()}`
                        : `Over by ₦${closeDayDifference.toLocaleString()}`}
                  </p>
                </div>
                <Money amount={Math.abs(closeDayDifference)} className="text-3xl font-bold tabular-nums" />
              </div>

              {/* Per-Method Breakdown Table */}
              <div className="border border-border/40 rounded-lg overflow-hidden bg-card/60">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="h-8 hover:bg-transparent">
                      <TableHead className="text-[11px] font-medium text-muted-foreground">Channel</TableHead>
                      <TableHead className="text-right text-[11px] font-medium text-muted-foreground">Expected</TableHead>
                      <TableHead className="text-right text-[11px] font-medium text-muted-foreground">Hand-Counted</TableHead>
                      <TableHead className="text-right text-[11px] font-medium text-muted-foreground">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/40 text-xs">
                    <TableRow className="h-9">
                      <TableCell className="font-medium text-foreground">Cash (less float)</TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={systemTotals.cash} /></TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={(Number(countedCash) || 0) - (Number(changeFloat) || 0)} /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        <Money amount={((Number(countedCash) || 0) - (Number(changeFloat) || 0)) - systemTotals.cash} />
                      </TableCell>
                    </TableRow>
                    <TableRow className="h-9">
                      <TableCell className="font-medium text-foreground">POS Slips</TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={systemTotals.pos1} /></TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={Number(countedPos1) || 0} /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        <Money amount={(Number(countedPos1) || 0) - systemTotals.pos1} />
                      </TableCell>
                    </TableRow>
                    <TableRow className="h-9">
                      <TableCell className="font-medium text-foreground">Transfer Slips</TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={systemTotals.transfer} /></TableCell>
                      <TableCell className="text-right tabular-nums"><Money amount={Number(countedTransfer) || 0} /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        <Money amount={(Number(countedTransfer) || 0) - systemTotals.transfer} />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Reason input if difference exists */}
              {closeDayDifference !== 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium block">Reason for difference</label>
                  <Input
                    type="text"
                    disabled={dayLocked}
                    placeholder="e.g. ₦500 change discrepancy with customer"
                    value={diffReason}
                    onChange={e => setDiffReason(e.target.value)}
                    className="h-10 text-xs bg-card"
                  />
                </div>
              )}

              {/* Mismatch Limit Alert */}
              {Math.abs(closeDayDifference) > mismatchAlertLimit && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>This exceeds the <Money amount={mismatchAlertLimit} className="inline font-semibold" /> mismatch limit and will be flagged to the admin.</span>
                </div>
              )}
            </div>

            {/* Lock Action Bar */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <Button variant="outline" size="sm" onClick={() => toast.info('Reconciliation draft saved locally')}>
                Save draft
              </Button>

              <Button
                onClick={() => {
                  setTypedCloseConfirm('')
                  setShowCloseDayConfirm(true)
                }}
                disabled={dayLocked}
                className="bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold h-11 px-6 gap-2"
              >
                {dayLocked ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Locked at {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })} by {cashierName}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Close day</span>
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

      </main>

      {/* ═══════════════════════════════════════════════════════════════
         3. DIALOGS & CONFIRMATIONS
         ═══════════════════════════════════════════════════════════════ */}

      {/* SIGN OUT CONFIRMATION DIALOG */}
      <AlertDialog open={showSignOutAlert} onOpenChange={setShowSignOutAlert}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of cashier session?</AlertDialogTitle>
            <AlertDialogDescription>
              Ensure all pending payments are processed before signing out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CANCEL ORDER CONFIRMATION DIALOG */}
      <AlertDialog open={!!cancelOrderTargetId} onOpenChange={(open) => !open && setCancelOrderTargetId(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the order from the payment queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmCancelOrder(cancelOrderTargetId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VOID EXPENSE CONFIRMATION DIALOG */}
      <AlertDialog open={!!voidExpenseTarget} onOpenChange={(open) => !open && setVoidExpenseTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Void expense record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the expense of <Money amount={voidExpenseTarget?.amount} className="inline font-semibold text-foreground" /> ({voidExpenseTarget?.category}) from today's log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleVoidExpense(voidExpenseTarget?.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Void expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CLOSE DAY CONFIRMATION DIALOG WITH TYPED 'CLOSE' */}
      <AlertDialog open={showCloseDayConfirm} onOpenChange={setShowCloseDayConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Close trading day & lock shift figures?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>This locks today's shift records and cannot be undone.</span>
              <span className="block font-semibold text-foreground">
                System Net: <Money amount={systemTotals.grandTotal} className="inline" /> · Gap: <Money amount={closeDayDifference} className="inline" />
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-1.5">
            <label className="text-xs font-medium text-foreground block">Type CLOSE to confirm:</label>
            <Input
              type="text"
              placeholder="CLOSE"
              value={typedCloseConfirm}
              onChange={e => setTypedCloseConfirm(e.target.value)}
              className="h-10 text-sm font-semibold tracking-wider uppercase"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={typedCloseConfirm.trim().toUpperCase() !== 'CLOSE'}
              onClick={handleLockDay}
              className="bg-brand-700 hover:bg-brand-800 text-white"
            >
              Confirm Close Day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* THERMAL RECEIPT MODAL */}
      <Dialog open={!!receiptOrder} onOpenChange={(open) => !open && setReceiptOrder(null)}>
        <DialogContent className="sm:max-w-[420px] p-6 bg-transparent border-none shadow-none text-center">
          <DialogTitle className="sr-only">Receipt</DialogTitle>
          <DialogDescription className="sr-only">Order receipt details</DialogDescription>

          <div className="w-full">
            <div id="printable-thermal-receipt" className="receipt-paper border border-dashed border-zinc-300 p-6 px-4 rounded-xl bg-white font-mono text-xs text-zinc-900 mx-auto w-full text-left">
              <div className="text-center border-b border-dashed border-zinc-300 pb-3 mb-3">
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

                <div className="mt-2.5 text-[9.5px] text-zinc-700 leading-relaxed text-center">
                  <div className="font-bold text-zinc-900 uppercase tracking-wider">
                    📍 Main Branch (HQ)
                  </div>
                  <div>Dr. Collins Okorie Str. Hausa Qtrs.</div>
                  <div>Tel: 07064611925</div>
                </div>
              </div>

              <div className="flex justify-between text-xs font-bold border-b border-dashed border-zinc-300 pb-2 mb-2">
                <span>REF: {receiptOrder?.receipt_ref}</span>
                <span>{(receiptOrder?.paid_at || receiptOrder?.created_at) ? new Date(receiptOrder?.paid_at || receiptOrder?.created_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }) : ''} WAT</span>
              </div>

              <div className="text-[11px] mb-2.5 leading-relaxed text-zinc-700">
                <p>Date: {(receiptOrder?.paid_at || receiptOrder?.created_at) ? new Date(receiptOrder?.paid_at || receiptOrder?.created_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }) : ''}</p>
                <p>Attendant: {receiptOrder?.attendant_name || 'attendant'}</p>
                <p>Cashier: {cashierName}</p>
                {(receiptOrder?.customer_name || receiptOrder?.is_credit) && (
                  <p className="font-bold text-blue-800 mt-0.5">
                    Customer: {receiptOrder?.customer_name || 'N/A'} {receiptOrder?.customer_phone ? `(${receiptOrder?.customer_phone})` : ''}
                  </p>
                )}
              </div>

              <div className="border-t border-b border-dashed border-zinc-300 py-2 mb-2.5">
                {receiptOrder?.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>{item.quantity || item.qty}x {item.product_name || item.name}</span>
                    <span className="tabular-nums font-medium"><Money amount={(item.total_price || (item.price || item.unit_price) * (item.quantity || item.qty))} /></span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-black text-sm text-black mb-1">
                <span>TOTAL PAID</span>
                <span className="tabular-nums"><Money amount={receiptOrder?.total_amount} /></span>
              </div>
              <div className="flex justify-between text-[11px] mb-3">
                <span>Method:</span><span className="font-bold text-blue-800">{receiptOrder?.payment_method}</span>
              </div>

              <div className="text-center border-t border-dashed border-zinc-300 pt-2.5 text-[9.5px] text-zinc-500 leading-relaxed">
                <p className="font-bold text-zinc-900">Thank you for your patronage!</p>
                <p>No refund without receipt</p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-4">
              <Button onClick={() => setReceiptOrder(null)} variant="outline" className="flex-1 h-11 text-xs font-semibold">
                Close
              </Button>
              <Button onClick={() => printThermalReceipt('printable-thermal-receipt')} className="flex-1 h-11 text-xs font-semibold bg-brand-700 hover:bg-brand-800 text-white gap-2">
                <Printer className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
