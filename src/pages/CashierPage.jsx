import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Fallback mock orders for Cashier testing
const INITIAL_MOCK_ORDERS = [
  {
    id: 'mock-27',
    order_number: 27,
    attendant_name: 'Chidinma',
    total_amount: 1900,
    status: 'waiting_for_payment',
    is_credit: false,
    created_at: new Date().toISOString(),
    items: [
      { product_name: 'Coartem', unit: 'pack', quantity: 1, unit_price: 1800, total_price: 1800 },
      { product_name: 'Paracetamol 500mg', unit: 'tab', quantity: 2, unit_price: 50, total_price: 100 },
    ],
  },
  {
    id: 'mock-26',
    order_number: 26,
    attendant_name: 'Emeka',
    total_amount: 570,
    status: 'waiting_for_payment',
    is_credit: false,
    created_at: new Date(Date.now() - 60000).toISOString(),
    items: [
      { product_name: 'Paracetamol 500mg', unit: 'tab', quantity: 10, unit_price: 50, total_price: 500 },
      { product_name: 'ORS Sachet', unit: 'sachet', quantity: 1, unit_price: 70, total_price: 70 },
    ],
  },
  {
    id: 'mock-25',
    order_number: 25,
    attendant_name: 'Chidinma',
    total_amount: 3200,
    status: 'waiting_for_payment',
    is_credit: true,
    customer_name: 'Chief Paul',
    customer_phone: '08033445566',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    items: [
      { product_name: 'Ciprofloxacin 500mg', unit: 'tab', quantity: 10, unit_price: 250, total_price: 2500 },
      { product_name: 'ORS Sachet', unit: 'sachet', quantity: 7, unit_price: 100, total_price: 700 },
    ],
  },
]

export default function CashierPage() {
  const navigate = useNavigate()
  const { logout, user, fullName, username } = useAuth()

  // Top Page Module: 'payments' | 'expenses' | 'treatments' | 'close_day'
  const [activeModule, setActiveModule] = useState('payments')

  // Queue Sidebar Tab: 'waiting' | 'credit'
  const [queueTab, setQueueTab] = useState('waiting')

  // Orders State
  const [orders, setOrders] = useState(INITIAL_MOCK_ORDERS)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected Order for Payment (Main Panel)
  const [selectedOrderId, setSelectedOrderId] = useState('mock-27')
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState(['POS']) // e.g. ['Cash'], ['POS'], ['Transfer'], ['Credit']
  const [paymentAmounts, setPaymentAmounts] = useState({ POS: '1900', Cash: '', Transfer: '', Credit: '' })

  // Receipt Modal State
  const [receiptOrder, setReceiptOrder] = useState(null)

  // Expenses State
  const [expenses, setExpenses] = useState([
    { id: 'exp-1', category: 'Fuel / Generator', amount: 3500, payment_method: 'Cash', note: 'Petrol for generator evening', recorded_by: 'Cashier', created_at: new Date().toISOString() },
  ])
  const [expCategory, setExpCategory] = useState('Fuel / Generator')
  const [expAmount, setExpAmount] = useState('')
  const [expMethod, setExpMethod] = useState('Cash')
  const [expNote, setExpNote] = useState('')

  // Treatments State
  const [treatments, setTreatments] = useState([
    {
      id: 'treat-1',
      patient_name: 'Mrs. Florence Nnaji',
      patient_age: 42,
      patient_weight: 68,
      diagnosis: 'Leg Ulcer Wound Dressing',
      drug_used: 'Gauze, Iodine, Bandage, Ceftriaxone',
      amount_charged: 6000,
      deposit_paid: 3000,
      balance_remaining: 3000,
      return_date: '2026-07-22',
      status: 'active',
    },
  ])
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

  // Fetch orders from Supabase
  const loadOrders = async () => {
    if (!supabase) return
    setLoadingOrders(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        setOrders(data)
        if (!selectedOrderId) {
          const firstPending = data.find((o) => o.status === 'waiting_for_payment')
          if (firstPending) setSelectedOrderId(firstPending.id)
        }
      }
    } catch (err) {
      console.warn('Using mock orders queue')
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Waiting for payment orders list
  const waitingOrders = useMemo(() => {
    return orders.filter((o) => {
      const isWaiting = o.status === 'waiting_for_payment' && !o.is_credit
      if (!searchQuery.trim()) return isWaiting
      const q = searchQuery.toLowerCase()
      return isWaiting && (String(o.order_number).includes(q) || (o.attendant_name && o.attendant_name.toLowerCase().includes(q)))
    })
  }, [orders, searchQuery])

  // Credit / Unpaid orders list
  const creditOrders = useMemo(() => {
    return orders.filter((o) => {
      const isCredit = o.is_credit || o.customer_name
      if (!searchQuery.trim()) return isCredit
      const q = searchQuery.toLowerCase()
      return (
        isCredit &&
        (String(o.order_number).includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.customer_phone && o.customer_phone.includes(q)))
      )
    })
  }, [orders, searchQuery])

  // Currently selected order details
  const activeOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  // Update default payment amount when activeOrder changes
  useEffect(() => {
    if (activeOrder) {
      const total = Number(activeOrder.total_amount)
      setPaymentAmounts({
        POS: selectedPaymentMethods.includes('POS') ? String(total) : '',
        Cash: selectedPaymentMethods.includes('Cash') ? String(total) : '',
        Transfer: selectedPaymentMethods.includes('Transfer') ? String(total) : '',
        Credit: selectedPaymentMethods.includes('Credit') ? String(total) : '',
      })
    }
  }, [activeOrder, selectedPaymentMethods])

  // Total entered in payment inputs
  const enteredPaymentTotal = useMemo(() => {
    let sum = 0
    selectedPaymentMethods.forEach((m) => {
      sum += Number(paymentAmounts[m]) || 0
    })
    return sum
  }, [selectedPaymentMethods, paymentAmounts])

  const isBalanced = useMemo(() => {
    if (!activeOrder) return false
    return Math.abs(enteredPaymentTotal - Number(activeOrder.total_amount)) < 0.01
  }, [enteredPaymentTotal, activeOrder])

  // System totals for Close Day
  const systemTotals = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'paid')
    let cash = 0, pos1 = 0, pos2 = 0, transfer = 0, credit = 0

    paidOrders.forEach((o) => {
      if (o.payment_method === 'Cash') cash += Number(o.total_amount)
      else if (o.payment_method === 'POS' || o.payment_method === 'POS 1') pos1 += Number(o.total_amount)
      else if (o.payment_method === 'POS 2') pos2 += Number(o.total_amount)
      else if (o.payment_method === 'Transfer') transfer += Number(o.total_amount)
    })

    const creditSales = orders.filter((o) => o.is_credit)
    creditSales.forEach((o) => (credit += Number(o.total_amount)))

    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const grandTotal = cash + pos1 + pos2 + transfer - totalExp

    return { cash, pos1, pos2, transfer, credit, totalExp, grandTotal }
  }, [orders, expenses])

  // Difference in Close Day
  const closeDayDifference = useMemo(() => {
    const cCash = Number(countedCash) || 0
    const cPos1 = Number(countedPos1) || 0
    const cPos2 = Number(countedPos2) || 0
    const cTrans = Number(countedTransfer) || 0
    const float = Number(changeFloat) || 0

    const totalCounted = cCash + cPos1 + cPos2 + cTrans - float
    return totalCounted - systemTotals.grandTotal
  }, [countedCash, countedPos1, countedPos2, countedTransfer, changeFloat, systemTotals])

  // Toggle Payment Method Selection
  const togglePaymentMethod = (method) => {
    if (selectedPaymentMethods.includes(method)) {
      if (selectedPaymentMethods.length > 1) {
        setSelectedPaymentMethods(selectedPaymentMethods.filter((m) => m !== method))
      }
    } else {
      setSelectedPaymentMethods([...selectedPaymentMethods, method])
    }
  }

  // Confirm Payment Action
  const handleConfirmPayment = async () => {
    if (!activeOrder) return

    const methodLabel = selectedPaymentMethods.join(' + ')

    const updatedOrders = orders.map((o) =>
      o.id === activeOrder.id
        ? { ...o, status: 'paid', payment_method: methodLabel }
        : o
    )
    setOrders(updatedOrders)

    // Supabase DB update
    if (supabase && !activeOrder.id.startsWith('mock')) {
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_method: methodLabel,
        })
        .eq('id', activeOrder.id)
    }

    setReceiptOrder({ ...activeOrder, payment_method: methodLabel })
    setSelectedOrderId(null)
  }

  // Add Expense Action
  const handleAddExpense = (e) => {
    e.preventDefault()
    if (!expAmount || Number(expAmount) <= 0) return

    const newExp = {
      id: 'exp-' + Date.now(),
      category: expCategory,
      amount: Number(expAmount),
      payment_method: expMethod,
      note: expNote.trim(),
      recorded_by: fullName || username || 'Cashier',
      created_at: new Date().toISOString(),
    }

    setExpenses([newExp, ...expenses])
    setExpAmount('')
    setExpNote('')
  }

  // Add Treatment Action
  const handleAddTreatment = (e) => {
    e.preventDefault()
    if (!tName.trim() || !tDiagnosis.trim() || !tCharge) return

    const charge = Number(tCharge)
    const deposit = Number(tDeposit) || 0

    const newTreat = {
      id: 'treat-' + Date.now(),
      patient_name: tName.trim(),
      patient_age: Number(tAge) || null,
      patient_weight: Number(tWeight) || null,
      diagnosis: tDiagnosis.trim(),
      drug_used: tDrug.trim(),
      amount_charged: charge,
      deposit_paid: deposit,
      balance_remaining: charge - deposit,
      return_date: tReturnDate || null,
      status: 'active',
    }

    setTreatments([newTreat, ...treatments])
    setTName('')
    setTAge('')
    setTWeight('')
    setTDiagnosis('')
    setTDrug('')
    setTCharge('')
    setTDeposit('')
    setTReturnDate('')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#f4f3ef] flex flex-col font-sans">
      {/* Top Header Background Bar (Dark Blue #1e40af) */}
      <div className="bg-[#1e40af] text-white px-8 pt-6 pb-16 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Cashier · Payments</h1>
              <p className="text-xs text-white/70">Emmanuel Pharmacy</p>
            </div>
          </div>

          {/* Top Bar Right User Pill */}
          <div className="flex items-center gap-4">
            <div className="bg-white/15 backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{fullName || username || 'Blessing'} · Till 2</span>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-white/80 hover:text-white underline font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Header Module Switcher Bar */}
        <div className="max-w-7xl mx-auto mt-6 flex space-x-2 border-b border-white/20 pb-1">
          {[
            { id: 'payments', label: 'Cashier Payments' },
            { id: 'expenses', label: 'Expenses Log' },
            { id: 'treatments', label: 'Patient Treatments' },
            { id: 'close_day', label: 'Close Day Reconciliation' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                activeModule === m.id
                  ? 'bg-[#f4f3ef] text-neutral-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container Overlapping Header */}
      <main className="max-w-7xl mx-auto w-full px-6 -mt-8 pb-12 flex-1">
        {/* ============================================================ */}
        {/* MODULE 1: CASHIER PAYMENTS (Matching Reference Images 1, 2, 3) */}
        {/* ============================================================ */}
        {activeModule === 'payments' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Queue Panel (Card matching reference) */}
            <div className="w-full lg:w-96 bg-white rounded-3xl p-5 shadow-xl border border-neutral-200/80 space-y-4 shrink-0">
              {/* Left Queue Top Tabs */}
              <div className="flex border-b border-neutral-100 pb-3 justify-between items-center text-xs font-bold">
                <button
                  onClick={() => setQueueTab('waiting')}
                  className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                    queueTab === 'waiting'
                      ? 'border-[#1e40af] text-neutral-900 font-extrabold'
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  Waiting for Payment
                  <span className="w-5 h-5 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-[10px]">
                    {waitingOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setQueueTab('credit')}
                  className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                    queueTab === 'credit'
                      ? 'border-[#1e40af] text-neutral-900 font-extrabold'
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  Unpaid / Credit
                  <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[10px]">
                    {creditOrders.length}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <svg className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Type an order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-neutral-100/80 border border-transparent rounded-2xl text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-none focus:bg-white focus:border-[#1e40af] transition-all"
                  id="cashier-search-input"
                />
              </div>

              {/* Queue Items List */}
              <div className="space-y-2.5 overflow-y-auto max-h-[520px]">
                {(queueTab === 'waiting' ? waitingOrders : creditOrders).length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    No orders waiting in queue
                  </div>
                ) : (
                  (queueTab === 'waiting' ? waitingOrders : creditOrders).map((order) => {
                    const isSelected = order.id === selectedOrderId
                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`p-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between border ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-200 shadow-sm'
                            : 'bg-white border-transparent hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Number Badge */}
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            isSelected ? 'bg-[#1e40af] text-white' : 'bg-blue-50 text-[#1e40af]'
                          }`}>
                            {order.order_number}
                          </div>
                          <div>
                            <h3 className="font-bold text-neutral-900 text-sm">
                              Order #{order.order_number}
                            </h3>
                            <p className="text-[11px] text-neutral-400">
                              {order.items?.length || 1} items · just now
                            </p>
                          </div>
                        </div>

                        <span className="font-extrabold text-neutral-900 text-sm">
                          ₦{Number(order.total_amount).toLocaleString()}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Main Payment Panel (Matching Reference Images 1, 2, 3) */}
            <div className="flex-1 bg-white rounded-3xl p-8 shadow-xl border border-neutral-200/80 min-h-[580px] flex flex-col justify-between">
              {!activeOrder ? (
                /* EMPTY STATE (Cashier Payment-selection.png) */
                <div className="my-auto text-center flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1e40af] flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-neutral-900 text-lg mb-1">
                    Select an order to take payment
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                    Pick an order from the queue on the left, or type its number in the search box.
                  </p>
                </div>
              ) : (
                /* ACTIVE ORDER PAYMENT VIEW (Cashier Payment-selection2.png & selection3.png) */
                <div className="flex flex-col justify-between h-full space-y-6">
                  <div>
                    {/* Header Row */}
                    <div className="flex justify-between items-start border-b border-neutral-100 pb-4">
                      <div>
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">
                          ORDER
                        </span>
                        <h2 className="text-4xl font-extrabold text-neutral-900 tracking-tight">
                          #{activeOrder.order_number}
                        </h2>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-neutral-400 block font-medium">
                          {activeOrder.items?.length || 1} items
                        </span>
                        <span className="text-xs text-neutral-400">just now</span>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="py-4 space-y-3 max-h-60 overflow-y-auto">
                      {activeOrder.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-neutral-100 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 font-bold text-xs flex items-center justify-center">
                              {item.quantity}
                            </span>
                            <div>
                              <h4 className="font-bold text-neutral-900">{item.product_name}</h4>
                              <p className="text-xs text-neutral-400">₦{Number(item.unit_price).toLocaleString()} each</p>
                            </div>
                          </div>
                          <span className="font-bold text-neutral-900">
                            ₦{(Number(item.total_price) || Number(item.unit_price) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Details Section */}
                  <div className="border-t border-neutral-100 pt-5 space-y-6">
                    {/* Total Due Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 font-medium text-sm">Total due</span>
                      <span className="text-4xl font-black text-neutral-900">
                        ₦{Number(activeOrder.total_amount).toLocaleString()}
                      </span>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                        PAYMENT METHOD · SELECT ONE OR MORE TO SPLIT
                      </label>

                      <div className="grid grid-cols-4 gap-3">
                        {['Cash', 'POS', 'Transfer', 'Credit'].map((m) => {
                          const active = selectedPaymentMethods.includes(m)
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => togglePaymentMethod(m)}
                              className={`h-12 rounded-2xl font-bold text-sm border transition-all ${
                                active
                                  ? 'bg-[#1e40af] text-white border-[#1e40af] shadow-md'
                                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                              }`}
                            >
                              {m}
                            </button>
                          )
                        })}
                      </div>

                      {/* Payment Amount Input Box (Matching selection3.png) */}
                      <div className="mt-3 flex items-center justify-center">
                        <div className="relative w-48">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">₦</span>
                          <input
                            type="number"
                            value={paymentAmounts[selectedPaymentMethods[0]] || ''}
                            onChange={(e) =>
                              setPaymentAmounts({ ...paymentAmounts, [selectedPaymentMethods[0]]: e.target.value })
                            }
                            className="w-full h-10 pl-7 pr-3 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm text-center text-neutral-900 outline-none focus:border-[#1e40af]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Balance Status Indicator */}
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-neutral-500">
                        Entered ₦{enteredPaymentTotal.toLocaleString()}
                      </span>
                      {isBalanced ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          Balanced ✓
                        </span>
                      ) : (
                        <span className="text-red-500">
                          Gap: ₦{Math.abs(Number(activeOrder.total_amount) - enteredPaymentTotal).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Confirm & Print Receipt Button (Green when balanced, matching selection3.png) */}
                    <button
                      onClick={handleConfirmPayment}
                      disabled={!isBalanced}
                      className={`w-full h-14 font-bold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${
                        isBalanced
                          ? 'bg-[#16a34a] hover:bg-emerald-700 text-white shadow-emerald-200'
                          : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      }`}
                      id="confirm-print-receipt-button"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Confirm & Print Receipt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 2: EXPENSES LOG */}
        {/* ============================================================ */}
        {activeModule === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-neutral-900">Log Shop Expense</h2>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Expense Category *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                  >
                    {['Fuel / Generator', 'Water', 'Transport', 'Staff Expenses', 'Repairs & Maintenance', 'Supplies', 'Misc'].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Amount (₦) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 3500"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Payment Method *</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                  >
                    {['Cash', 'POS', 'POS 2', 'Transfer'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Description / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Petrol for generator evening"
                    value={expNote}
                    onChange={(e) => setExpNote(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Expense
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">Today's Expenses Log</h2>
                  <p className="text-xs text-neutral-500">Expenses will be deducted automatically in Close Day reconciliation.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400 block font-medium">Total Today</span>
                  <span className="text-2xl font-black text-red-600">
                    ₦{expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Note</th>
                      <th className="p-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-neutral-50">
                        <td className="p-3 font-bold text-neutral-900">{exp.category}</td>
                        <td className="p-3 font-extrabold text-red-600">₦{Number(exp.amount).toLocaleString()}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-neutral-100 font-semibold">{exp.payment_method}</span></td>
                        <td className="p-3 text-neutral-600">{exp.note || '—'}</td>
                        <td className="p-3 text-neutral-500">{exp.recorded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 3: TREATMENTS */}
        {/* ============================================================ */}
        {activeModule === 'treatments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-neutral-900">Record Patient Treatment</h2>
              <form onSubmit={handleAddTreatment} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mrs. Florence Nnaji"
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Age (yrs)</label>
                    <input
                      type="number"
                      placeholder="e.g. 42"
                      value={tAge}
                      onChange={(e) => setTAge(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 68"
                      value={tWeight}
                      onChange={(e) => setTWeight(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Diagnosis / Treatment *</label>
                  <input
                    type="text"
                    placeholder="e.g. Leg Ulcer Wound Dressing"
                    value={tDiagnosis}
                    onChange={(e) => setTDiagnosis(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Drugs & Supplies Used</label>
                  <input
                    type="text"
                    placeholder="e.g. Gauze, Iodine, Bandage"
                    value={tDrug}
                    onChange={(e) => setTDrug(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Total Charge (₦) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 6000"
                      value={tCharge}
                      onChange={(e) => setTCharge(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Deposit Paid (₦)</label>
                    <input
                      type="number"
                      placeholder="e.g. 3000"
                      value={tDeposit}
                      onChange={(e) => setTDeposit(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Return Visit Date</label>
                  <input
                    type="date"
                    value={tReturnDate}
                    onChange={(e) => setTReturnDate(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-2"
                >
                  Save Treatment Record
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Active Patient Treatments</h2>
                <p className="text-xs text-neutral-500">Track compulsory deposits, balances, and return visit schedules.</p>
              </div>

              <div className="space-y-3">
                {treatments.map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-neutral-900 text-sm">{t.patient_name}</h3>
                        {t.patient_age && <span className="text-xs text-neutral-400">({t.patient_age} yrs, {t.patient_weight || '—'} kg)</span>}
                      </div>
                      <p className="text-xs font-semibold text-purple-800">{t.diagnosis}</p>
                      <p className="text-xs text-neutral-500">Drugs: {t.drug_used}</p>
                      {t.return_date && (
                        <p className="text-xs font-semibold text-amber-700">
                          Return Visit: {t.return_date}
                        </p>
                      )}
                    </div>

                    <div className="text-right flex flex-col justify-between items-end">
                      <div>
                        <span className="text-[11px] text-neutral-400 block font-medium">Balance Remaining</span>
                        <span className="text-xl font-black text-red-600">₦{t.balance_remaining.toLocaleString()}</span>
                        <span className="text-[10px] text-neutral-500 block">Charged: ₦{t.amount_charged.toLocaleString()} | Deposit: ₦{t.deposit_paid.toLocaleString()}</span>
                      </div>

                      {t.balance_remaining > 0 && (
                        <button
                          onClick={() => {
                            const p = prompt(`Collect remaining balance for ${t.patient_name} (₦${t.balance_remaining}):`, t.balance_remaining)
                            if (p && !isNaN(p)) {
                              const amt = Number(p)
                              setTreatments(treatments.map(item => item.id === t.id ? { ...item, deposit_paid: item.deposit_paid + amt, balance_remaining: item.amount_charged - (item.deposit_paid + amt) } : item))
                            }
                          }}
                          className="mt-2 px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700"
                        >
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

        {/* ============================================================ */}
        {/* MODULE 4: CLOSE DAY RECONCILIATION */}
        {/* ============================================================ */}
        {activeModule === 'close_day' && (
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Daily Cashier Reconciliation & Day Close</h2>
              <p className="text-xs text-neutral-500">
                Compare system calculated figures against physical counted totals. Any gap is highlighted.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500 border-b pb-2">
                  System Calculated Figures
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Expected Cash</span>
                    <span className="font-bold">₦{systemTotals.cash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Expected POS 1 (Moneypoint)</span>
                    <span className="font-bold">₦{systemTotals.pos1.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Expected POS 2 (Moneypoint)</span>
                    <span className="font-bold">₦{systemTotals.pos2.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Expected Bank Transfer</span>
                    <span className="font-bold">₦{systemTotals.transfer.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Credit Sales Owed</span>
                    <span>₦{systemTotals.credit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600 border-t pt-2">
                    <span>Less Total Expenses</span>
                    <span className="font-bold">- ₦{systemTotals.totalExp.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-base font-black text-[#1e40af] border-t border-neutral-300 pt-2">
                    <span>System Net Total</span>
                    <span>₦{systemTotals.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500 border-b pb-2">
                  Cashier Hand-Counted Figures
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Physical Cash Counted (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">POS 1 Machine Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedPos1}
                      onChange={(e) => setCountedPos1(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">POS 2 Machine Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedPos2}
                      onChange={(e) => setCountedPos2(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Transfer Bank Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedTransfer}
                      onChange={(e) => setCountedTransfer(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Change Float Carried Forward (₦200/₦100/₦50 notes)</label>
                  <input
                    type="number"
                    placeholder="2000"
                    value={changeFloat}
                    onChange={(e) => setChangeFloat(e.target.value)}
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs outline-none focus:border-[#1e40af]"
                  />
                </div>

                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  closeDayDifference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : closeDayDifference < 0
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <div>
                    <span className="font-bold text-xs block">Reconciliation Gap / Difference</span>
                    <span className="text-[11px] opacity-80">
                      {closeDayDifference === 0
                        ? 'Perfect match! No cash discrepancy.'
                        : closeDayDifference < 0
                        ? `Shortage of ₦${Math.abs(closeDayDifference).toLocaleString()}`
                        : `Overage of ₦${closeDayDifference.toLocaleString()}`}
                    </span>
                  </div>
                  <span className="text-2xl font-black">
                    ₦{closeDayDifference.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => setDayLocked(true)}
                  disabled={dayLocked}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all disabled:opacity-50"
                >
                  {dayLocked ? 'Day Locked & Submitted' : 'Lock Day & Submit Summary'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* 80MM THERMAL RECEIPT MODAL */}
      {/* ============================================================ */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="border border-dashed border-neutral-300 p-4 rounded-xl bg-neutral-50 font-mono text-xs text-neutral-800 space-y-2">
              <div className="text-center space-y-0.5 border-b border-dashed pb-2">
                <h2 className="font-bold text-sm text-black">EMMANUEL PHARMACY</h2>
                <p className="text-[10px] text-neutral-500">Quality Care & Genuine Medicines</p>
                <p className="text-[10px] text-neutral-500">Tel: 080-EMMANUEL</p>
              </div>

              <div className="flex justify-between text-[11px] font-bold border-b border-dashed pb-2">
                <span>ORDER #{receiptOrder.order_number}</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="text-[10px] space-y-0.5">
                <p>Date: {new Date().toLocaleDateString()}</p>
                <p>Attendant: {receiptOrder.attendant_name}</p>
                <p>Cashier: {fullName || username || 'Cashier'}</p>
              </div>

              <div className="border-t border-b border-dashed py-2 space-y-1">
                {receiptOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-bold text-sm text-black">
                  <span>TOTAL PAID</span>
                  <span>₦{Number(receiptOrder.total_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Method:</span>
                  <span className="font-semibold">{receiptOrder.payment_method}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed text-[10px] text-neutral-500">
                <p>Thank you for your patronage!</p>
                <p>No refund without receipt</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReceiptOrder(null)}
                className="flex-1 h-11 border border-neutral-300 rounded-xl font-semibold text-xs text-neutral-700"
              >
                Close
              </button>
              <button
                onClick={() => { window.print(); setReceiptOrder(null) }}
                className="flex-1 h-11 bg-[#1e40af] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
