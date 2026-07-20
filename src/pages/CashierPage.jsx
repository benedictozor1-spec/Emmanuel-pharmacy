import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Fallback sample pending orders for Cashier testing
const INITIAL_MOCK_ORDERS = [
  {
    id: 'mock-1',
    order_number: 25,
    attendant_name: 'Chidinma',
    total_amount: 1850,
    status: 'waiting_for_payment',
    is_credit: false,
    created_at: new Date().toISOString(),
    items: [
      { product_name: 'Paracetamol 500mg', unit: 'tab', quantity: 3, unit_price: 50, total_price: 150 },
      { product_name: 'Artemether / Lumefantrine', unit: 'pack', quantity: 1, unit_price: 1700, total_price: 1700 },
    ],
  },
  {
    id: 'mock-2',
    order_number: 26,
    attendant_name: 'Emeka',
    total_amount: 2500,
    status: 'waiting_for_payment',
    is_credit: true,
    customer_name: 'Chief Paul',
    customer_phone: '08033445566',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    items: [
      { product_name: 'Ciprofloxacin 500mg', unit: 'tab', quantity: 10, unit_price: 250, total_price: 2500 },
    ],
  },
]

export default function CashierPage() {
  const navigate = useNavigate()
  const { logout, user, fullName, username } = useAuth()

  // Active Navigation Tab: 'queue' | 'credit' | 'expenses' | 'treatments' | 'close_day'
  const [activeTab, setActiveTab] = useState('queue')

  // Orders State
  const [orders, setOrders] = useState(INITIAL_MOCK_ORDERS)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Payment Modal State
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Cash') // 'Cash'|'POS 1'|'POS 2'|'Transfer'|'Credit'
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [splitAmounts, setSplitAmounts] = useState({ cash: '', pos1: '', pos2: '', transfer: '' })

  // Receipt Modal State
  const [receiptOrder, setReceiptOrder] = useState(null)

  // Expenses State
  const [expenses, setExpenses] = useState([
    { id: 'exp-1', category: 'Fuel / Generator', amount: 3500, payment_method: 'Cash', note: 'Petrol for evening shift', recorded_by: 'Cashier', created_at: new Date().toISOString() },
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
  const [changeFloat, setChangeFloat] = useState('2000') // e.g. N2,000 float
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

      if (!error && data) {
        setOrders(data)
      }
    } catch (err) {
      console.warn('Using fallback orders')
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Filter orders in queue
  const pendingOrders = useMemo(() => {
    return orders.filter((o) => {
      const isPending = o.status === 'waiting_for_payment'
      if (!searchQuery.trim()) return isPending
      const q = searchQuery.toLowerCase()
      return (
        isPending &&
        (String(o.order_number).includes(q) ||
          (o.attendant_name && o.attendant_name.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)))
      )
    })
  }, [orders, searchQuery])

  // Filter credit orders
  const creditOrders = useMemo(() => {
    return orders.filter((o) => o.is_credit || o.customer_name)
  }, [orders])

  // System totals for Close Day
  const systemTotals = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'paid')
    let cash = 0, pos1 = 0, pos2 = 0, transfer = 0, credit = 0

    paidOrders.forEach((o) => {
      if (o.payment_method === 'Cash') cash += Number(o.total_amount)
      else if (o.payment_method === 'POS 1') pos1 += Number(o.total_amount)
      else if (o.payment_method === 'POS 2') pos2 += Number(o.total_amount)
      else if (o.payment_method === 'Transfer') transfer += Number(o.total_amount)
    })

    const creditSales = orders.filter((o) => o.is_credit)
    creditSales.forEach((o) => (credit += Number(o.total_amount)))

    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const grandTotal = cash + pos1 + pos2 + transfer - totalExp

    return { cash, pos1, pos2, transfer, credit, totalExp, grandTotal }
  }, [orders, expenses])

  // Calculate difference in Close Day
  const closeDayDifference = useMemo(() => {
    const cCash = Number(countedCash) || 0
    const cPos1 = Number(countedPos1) || 0
    const cPos2 = Number(countedPos2) || 0
    const cTrans = Number(countedTransfer) || 0
    const float = Number(changeFloat) || 0

    const totalCounted = cCash + cPos1 + cPos2 + cTrans - float
    return totalCounted - systemTotals.grandTotal
  }, [countedCash, countedPos1, countedPos2, countedTransfer, changeFloat, systemTotals])

  // Confirm Payment Action
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return

    const updatedOrders = orders.map((o) =>
      o.id === selectedOrder.id
        ? { ...o, status: 'paid', payment_method: isSplitPayment ? 'Split Payment' : paymentMethod }
        : o
    )
    setOrders(updatedOrders)

    // Try Supabase update
    if (supabase && !selectedOrder.id.startsWith('mock')) {
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_method: isSplitPayment ? 'Split Payment' : paymentMethod,
        })
        .eq('id', selectedOrder.id)
    }

    setReceiptOrder({ ...selectedOrder, payment_method: isSplitPayment ? 'Split Payment' : paymentMethod })
    setSelectedOrder(null)
    setIsSplitPayment(false)
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
    <div className="min-h-dvh bg-neutral-100 flex flex-col font-sans">
      {/* Cashier Top Navigation Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-neutral-900">Emmanuel Pharmacy</h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cashier Desktop
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                {(fullName || username || 'C').charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-neutral-700 hidden sm:inline">
                {fullName || username}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-neutral-600 hover:text-red-600 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-neutral-100 overflow-x-auto">
          {[
            { id: 'queue', label: 'Orders Queue', count: pendingOrders.length, badgeColor: 'bg-blue-600 text-white' },
            { id: 'credit', label: 'Credit & Debts', count: creditOrders.length, badgeColor: 'bg-amber-500 text-white' },
            { id: 'expenses', label: 'Expenses Log', count: expenses.length, badgeColor: 'bg-neutral-600 text-white' },
            { id: 'treatments', label: 'Treatments', count: treatments.length, badgeColor: 'bg-purple-600 text-white' },
            { id: 'close_day', label: 'Close Day Reconciliation', badgeColor: '' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#1e40af] text-[#1e40af] bg-blue-50/50'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${tab.badgeColor}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {/* ============================================================ */}
        {/* TAB 1: ORDERS QUEUE */}
        {/* ============================================================ */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-neutral-200">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Live Incoming Orders</h2>
                <p className="text-xs text-neutral-500">
                  Select an order number to collect payment and print customer receipt.
                </p>
              </div>

              <div className="w-full sm:w-72 relative">
                <input
                  type="text"
                  placeholder="Search order # or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm bg-neutral-50 border border-neutral-300 rounded-xl outline-none focus:border-[#1e40af] focus:bg-white"
                />
                <svg className="w-4 h-4 text-neutral-400 absolute left-3 top-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {loadingOrders ? (
              <div className="py-16 text-center text-neutral-400">Loading orders queue...</div>
            ) : pendingOrders.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-neutral-200 p-8">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-bold text-neutral-800 text-lg">No pending orders in queue</h3>
                <p className="text-xs text-neutral-400 mt-1">Orders sent by attendants will show up here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                            ORDER NUMBER
                          </span>
                          <span className="text-3xl font-black text-neutral-900">
                            #{order.order_number}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          Waiting for Payment
                        </span>
                      </div>

                      <div className="text-xs text-neutral-500 space-y-1 mb-4">
                        <p>Attendant: <strong className="text-neutral-800">{order.attendant_name}</strong></p>
                        {order.is_credit && (
                          <p className="text-amber-700 font-semibold">
                            Credit Sale: {order.customer_name} ({order.customer_phone})
                          </p>
                        )}
                        <p>Time: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      {/* Items preview */}
                      <div className="bg-neutral-50 rounded-xl p-3 mb-4 space-y-1 text-xs">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-neutral-700">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span className="font-semibold">₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-neutral-400 block font-medium">Total Payable</span>
                        <span className="text-xl font-black text-neutral-900">
                          ₦{Number(order.total_amount).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                      >
                        Collect Payment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: CREDIT LIST */}
        {/* ============================================================ */}
        {activeTab === 'credit' && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Customer Credit & Outstanding Debts</h2>
              <p className="text-xs text-neutral-500">Track and collect payments for unpaid customer debts.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase text-[11px] border-b">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Phone Number</th>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Attendant</th>
                    <th className="p-3">Amount Owed</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {creditOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-neutral-400">No credit sales on record</td>
                    </tr>
                  ) : (
                    creditOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50">
                        <td className="p-3 font-bold text-neutral-900">{o.customer_name || 'N/A'}</td>
                        <td className="p-3 text-neutral-600">{o.customer_phone || 'N/A'}</td>
                        <td className="p-3 font-bold">#{o.order_number}</td>
                        <td className="p-3 text-neutral-600">{o.attendant_name}</td>
                        <td className="p-3 font-extrabold text-red-600">₦{Number(o.total_amount).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${o.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {o.status === 'paid' ? 'Cleared' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="p-3">
                          {o.status !== 'paid' && (
                            <button
                              onClick={() => setSelectedOrder(o)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
                            >
                              Collect Debt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: EXPENSES LOG */}
        {/* ============================================================ */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-neutral-900">Log Shop Expense</h2>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Expense Category *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
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
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Payment Method *</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                  >
                    {['Cash', 'POS 1', 'POS 2', 'Transfer'].map((m) => (
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
                    className="w-full h-11 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-neutral-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-md transition-all"
                >
                  Save Expense
                </button>
              </form>
            </div>

            {/* Expenses List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
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
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase text-[11px] border-b">
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
                        <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-neutral-100 text-xs font-semibold">{exp.payment_method}</span></td>
                        <td className="p-3 text-neutral-600">{exp.note || '—'}</td>
                        <td className="p-3 text-neutral-500 text-xs">{exp.recorded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: TREATMENTS & DRESSING INTERFACE */}
        {/* ============================================================ */}
        {activeTab === 'treatments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Treatment Entry Form */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-neutral-900">Record Patient Treatment</h2>
              <form onSubmit={handleAddTreatment} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Chike Obi"
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:border-purple-600"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Age (yrs)</label>
                    <input
                      type="number"
                      placeholder="e.g. 35"
                      value={tAge}
                      onChange={(e) => setTAge(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 70"
                      value={tWeight}
                      onChange={(e) => setTWeight(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Diagnosis / Treatment *</label>
                  <input
                    type="text"
                    placeholder="e.g. Deep wound dressing / Injection course"
                    value={tDiagnosis}
                    onChange={(e) => setTDiagnosis(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Drugs & Supplies Used</label>
                  <input
                    type="text"
                    placeholder="e.g. Gauze, iodine, ceftriaxone 1g"
                    value={tDrug}
                    onChange={(e) => setTDrug(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Total Charge (₦) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={tCharge}
                      onChange={(e) => setTCharge(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Deposit Paid (₦)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2000"
                      value={tDeposit}
                      onChange={(e) => setTDeposit(e.target.value)}
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none font-bold text-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">Return Visit Date</label>
                  <input
                    type="date"
                    value={tReturnDate}
                    onChange={(e) => setTReturnDate(e.target.value)}
                    className="w-full h-10 px-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-xl shadow-md transition-all mt-2"
                >
                  Save Treatment Record
                </button>
              </form>
            </div>

            {/* Active Treatments List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Active Patient Treatments</h2>
                <p className="text-xs text-neutral-500">Track compulsory deposits, balances, and return visit schedules.</p>
              </div>

              <div className="space-y-3">
                {treatments.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-neutral-900 text-base">{t.patient_name}</h3>
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
                        <span className="text-xs text-neutral-400 block">Balance Remaining</span>
                        <span className="text-xl font-black text-red-600">₦{t.balance_remaining.toLocaleString()}</span>
                        <span className="text-[11px] text-neutral-500 block">Charged: ₦{t.amount_charged.toLocaleString()} | Deposit: ₦{t.deposit_paid.toLocaleString()}</span>
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
        {/* TAB 5: CLOSE DAY RECONCILIATION */}
        {/* ============================================================ */}
        {activeTab === 'close_day' && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Daily Cashier Reconciliation & Day Close</h2>
              <p className="text-xs text-neutral-500">
                Compare system calculated figures against physical counted totals. Any gap is highlighted.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* System Figures */}
              <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 space-y-3">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider text-neutral-500 border-b pb-2">
                  System Calculated Figures
                </h3>

                <div className="space-y-2 text-sm">
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

              {/* Cashier Counted Inputs */}
              <div className="space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider text-neutral-500 border-b pb-2">
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
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">POS 1 Machine Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedPos1}
                      onChange={(e) => setCountedPos1(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">POS 2 Machine Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedPos2}
                      onChange={(e) => setCountedPos2(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Transfer Bank Slip (₦)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={countedTransfer}
                      onChange={(e) => setCountedTransfer(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
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
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm outline-none focus:border-[#1e40af]"
                  />
                </div>

                {/* Mismatch Difference Indicator */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  closeDayDifference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : closeDayDifference < 0
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <div>
                    <span className="font-bold text-sm block">Reconciliation Gap / Difference</span>
                    <span className="text-xs opacity-80">
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
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-2xl shadow-lg transition-all disabled:opacity-50"
                >
                  {dayLocked ? 'Day Locked & Submitted' : 'Lock Day & Submit Summary'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL 1: PAYMENT COLLECTION & SPLIT PAYMENT */}
      {/* ============================================================ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-start border-b border-neutral-100 pb-3">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase">COLLECT PAYMENT</span>
                <h3 className="text-2xl font-black text-neutral-900">Order #{selectedOrder.order_number}</h3>
                <p className="text-xs text-neutral-500">Served by {selectedOrder.attendant_name}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* Total */}
            <div className="bg-neutral-50 p-4 rounded-2xl text-center">
              <span className="text-xs text-neutral-400 font-semibold block">Total Amount Due</span>
              <span className="text-3xl font-black text-[#1e40af]">
                ₦{Number(selectedOrder.total_amount).toLocaleString()}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-2">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['Cash', 'POS 1', 'POS 2', 'Transfer', 'Credit'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setPaymentMethod(m); setIsSplitPayment(false) }}
                    className={`h-11 rounded-xl text-xs font-bold transition-all ${
                      !isSplitPayment && paymentMethod === m
                        ? 'bg-[#1e40af] text-white shadow-md'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Payment Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSplitPayment(!isSplitPayment)}
                className="text-xs font-bold text-[#1e40af] underline"
              >
                {isSplitPayment ? 'Single Payment Method' : '+ Split Payment (e.g. Part Cash + Part Transfer)'}
              </button>

              {isSplitPayment && (
                <div className="mt-3 p-3 bg-blue-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span>Cash Portion (₦)</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitAmounts.cash}
                      onChange={(e) => setSplitAmounts({ ...splitAmounts, cash: e.target.value })}
                      className="w-28 h-8 px-2 bg-white border rounded text-right"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Transfer Portion (₦)</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={splitAmounts.transfer}
                      onChange={(e) => setSplitAmounts({ ...splitAmounts, transfer: e.target.value })}
                      className="w-28 h-8 px-2 bg-white border rounded text-right"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 h-12 rounded-xl border border-neutral-300 font-semibold text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
              >
                Confirm & Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: 80MM THERMAL RECEIPT LAYOUT */}
      {/* ============================================================ */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            {/* Printable 80mm Receipt Box */}
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

              {/* Items */}
              <div className="border-t border-b border-dashed py-2 space-y-1">
                {receiptOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Payment Summary */}
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
