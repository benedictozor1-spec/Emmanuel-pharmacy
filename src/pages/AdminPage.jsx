import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { syncServerTime, getServerTodayStr, formatServerTime, formatServerDate } from '../utils/serverTime'

/* ═══════════════════════════════════════════════════════════════
   EXACT COLORS FROM SPEC
   ═══════════════════════════════════════════════════════════════ */
const C = {
  deepBlue: '#1E3D9D',
  accentBlue: '#245DE2',
  accentBlueDark: '#1F45B8',
  lightBlueTint: '#EEF2FE',
  warmBg: '#F7F4EE',
  white: '#FFFFFF',
  nearBlack: '#1C1B18',
  mutedGrey: '#86816F',
  green: '#16794A',
  red: '#D7263D',
  cardBorder: '#E7E1D2',
  guideLine: '#F1EDE2',
  inactiveNav: '#B3AE9E',
  slateBadgeBg: '#E9EDF2',
  slateBadgeText: '#475569',
  tooltipLine: '#C9D3F2',
}

const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const NUM_STYLE = { fontVariantNumeric: 'tabular-nums' }
const HEADING_STYLE = { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mutedGrey }

/* ═══════════════════════════════════════════════════════════════
   DETERMINISTIC RANDOM & DATA GENERATION
   ═══════════════════════════════════════════════════════════════ */
function rand(i) {
  const v = Math.sin(i * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

function fmt(n) {
  if (n == null) return '—'
  return '₦' + Math.round(n).toLocaleString('en-NG')
}

function fmtPlain(n) {
  return Math.round(n).toLocaleString('en-NG')
}

function buildRealDailyData(orders, expenses) {
  const map = {}
  
  if (orders && orders.length > 0) {
    orders.forEach(o => {
      if (o.status !== 'paid') return
      const dateStr = formatServerDate(o.paid_at || o.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
      if (!map[dateStr]) {
        map[dateStr] = { revenue: 0, profit: 0, sales: 0, credit: 0, expenses: 0 }
      }
      const amt = Number(o.total_amount) || 0
      map[dateStr].revenue += amt
      map[dateStr].sales += 1
      if (o.is_credit) map[dateStr].credit += amt

      let profit = 0
      if (o.order_items && o.order_items.length > 0) {
        o.order_items.forEach(item => {
          const sell = Number(item.unit_price) || 0
          const cost = Number(item.cost_price) || Math.round(sell * 0.7)
          const qty = item.quantity || 1
          profit += (sell - cost) * qty
        })
      } else {
        profit = Math.round(amt * 0.3)
      }
      map[dateStr].profit += profit
    })
  }

  if (expenses && expenses.length > 0) {
    expenses.forEach(e => {
      if (!e.created_at) return
      const dateStr = formatServerDate(e.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
      if (!map[dateStr]) {
        map[dateStr] = { revenue: 0, profit: 0, sales: 0, credit: 0, expenses: 0 }
      }
      map[dateStr].expenses += Number(e.amount) || 0
    })
  }

  const daily = []
  const now = getServerNow()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - (364 - i))
    const dateStr = formatServerDate(d, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
    const entry = map[dateStr] || { revenue: 0, profit: 0, sales: 0, credit: 0, expenses: 0 }
    daily.push({
      date: d,
      dateStr,
      revenue: entry.revenue,
      profit: entry.profit,
      sales: entry.sales,
      credit: entry.credit,
      expenses: entry.expenses,
    })
  }
  return daily
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function dateLabel(d) { return `${DAYS[d.getDay()]} ${d.getDate()}` }
function monthLabel(d) { return MONTHS[d.getMonth()] }

/* ═══════════════════════════════════════════════════════════════
   CHART DATA SLICING
   ═══════════════════════════════════════════════════════════════ */
function sliceData(daily, period, customFrom, customTo, orders) {
  const n = daily.length
  if (n === 0) return { points: [], prev: [], caption: '', labels: [], hasPrev: false }
  
  let points = [], prev = [], caption = '', labels = [], hasPrev = true

  if (period === 'Today') {
    const todayStr = getServerTodayStr()
    const now = getServerNow()
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

    const todayOrders = (orders || []).filter(o => o.status === 'paid' && o.paid_at && (o.paid_at.startsWith(todayStr) || formatServerDate(o.paid_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') === todayStr))
    const yesterdayOrders = (orders || []).filter(o => o.status === 'paid' && o.paid_at && (o.paid_at.startsWith(yesterdayStr) || formatServerDate(o.paid_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') === yesterdayStr))

    points = Array.from({ length: 14 }, (_, idx) => {
      const targetHour = idx + 8 // 8 AM to 9 PM
      let rev = 0, prof = 0, sls = 0, cred = 0, exp = 0
      todayOrders.forEach(o => {
        const h = Number(formatServerTime(o.paid_at || o.created_at, { hour: 'numeric', hour12: false }))
        if (h <= targetHour) {
          const amt = Number(o.total_amount) || 0
          rev += amt
          sls += 1
          if (o.is_credit) cred += amt
          if (o.order_items && o.order_items.length > 0) {
            o.order_items.forEach(it => { prof += ((Number(it.unit_price) || 0) - (Number(it.cost_price) || Math.round(Number(it.unit_price) * 0.7))) * (it.quantity || 1) })
          } else {
            prof += Math.round(amt * 0.3)
          }
        }
      })
      const h = targetHour
      const label = h <= 12 ? (h === 12 ? '12 PM' : h + ' AM') : (h - 12) + ' PM'
      return { label, revenue: rev, profit: prof, sales: sls, credit: cred, expenses: exp }
    })

    let yestRev = 0, yestProf = 0, yestSls = 0, yestCred = 0, yestExp = 0
    yesterdayOrders.forEach(o => {
      const amt = Number(o.total_amount) || 0
      yestRev += amt
      yestSls += 1
      if (o.is_credit) yestCred += amt
      if (o.order_items && o.order_items.length > 0) {
        o.order_items.forEach(it => { yestProf += ((Number(it.unit_price) || 0) - (Number(it.cost_price) || Math.round(Number(it.unit_price) * 0.7))) * (it.quantity || 1) })
      } else {
        yestProf += Math.round(amt * 0.3)
      }
    })

    prev = [{ revenue: yestRev, profit: yestProf, sales: yestSls, credit: yestCred, expenses: yestExp }]
    caption = 'today vs yesterday'
    labels = points.map(p => p.label)
  } else if (period === 'This Week') {
    points = daily.slice(n - 7)
    prev = daily.slice(n - 14, n - 7)
    caption = 'this week vs last week'
    labels = points.map(p => dateLabel(p.date))
  } else if (period === 'This Month') {
    points = daily.slice(n - 30)
    prev = daily.slice(n - 60, n - 30)
    caption = 'this month vs last month'
    labels = points.map(p => p.date.getDate().toString())
  } else if (period === 'This Year') {
    hasPrev = false
    const buckets = []
    for (let b = 0; b < 12; b++) {
      const start = b * 30
      const end = Math.min(start + 30, n)
      const chunk = daily.slice(start, end)
      const mid = chunk[Math.floor(chunk.length / 2)]
      buckets.push({
        date: mid?.date || new Date(),
        label: mid ? monthLabel(mid.date) : '',
        revenue: chunk.reduce((s, d) => s + d.revenue, 0),
        profit: chunk.reduce((s, d) => s + d.profit, 0),
        sales: chunk.reduce((s, d) => s + d.sales, 0),
        credit: chunk.reduce((s, d) => s + d.credit, 0),
        expenses: chunk.reduce((s, d) => s + d.expenses, 0),
      })
    }
    points = buckets
    prev = []
    caption = 'this year'
    labels = buckets.map(b => b.label)
  } else {
    // Custom
    let from = customFrom ? new Date(customFrom) : null
    let to = customTo ? new Date(customTo) : null
    if (!from || !to || from >= to) {
      from = new Date(daily[n - 15].date)
      to = new Date(daily[n - 1].date)
    }
    const filtered = daily.filter(d => d.date >= from && d.date <= to)
    points = filtered.length < 2 ? daily.slice(n - 14) : filtered
    const len = points.length
    const prevEnd = new Date(from)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - len + 1)
    prev = daily.filter(d => d.date >= prevStart && d.date <= prevEnd)
    caption = 'custom range vs previous'
    labels = points.map(p => `${p.date.getDate()} ${monthLabel(p.date)}`)
  }

  return { points, prev, caption, labels, hasPrev }
}

function sumMetric(arr, metric) {
  return arr.reduce((s, d) => s + (d[metric] || 0), 0)
}

/* ═══════════════════════════════════════════════════════════════
   SVG PATH BUILDER (cubic beziers per spec)
   ═══════════════════════════════════════════════════════════════ */
function buildChartPoints(values) {
  const n = values.length
  if (n === 0) return { pts: [], min: 0, max: 1 }
  let min = Infinity, max = -Infinity
  for (const v of values) { if (v < min) min = v; if (v > max) max = v }
  if (max === min) { max = min + 1 }
  const pts = values.map((v, i) => ({
    x: n === 1 ? 320 : 8 + i * (624 / (n - 1)),
    y: 20 + (1 - (v - min) / (max - min)) * 164,
    v,
  }))
  return { pts, min, max }
}

function buildSmoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i]
    const midX = (prev.x + curr.x) / 2
    d += ` C ${midX},${prev.y} ${midX},${curr.y} ${curr.x},${curr.y}`
  }
  return d
}

function buildAreaPath(pts) {
  const line = buildSmoothPath(pts)
  if (!line || pts.length < 2) return ''
  const last = pts[pts.length - 1], first = pts[0]
  return line + ` L ${last.x},200 L ${first.x},200 Z`
}

/* ═══════════════════════════════════════════════════════════════
   STATIC DATA
   ═══════════════════════════════════════════════════════════════ */
const PRODUCTS_INIT = [
  { id: 'p1', name: 'Paracetamol 500mg', brand: 'Emzor', category: 'Analgesic', price: 50, cost: 35, stock: 240, lowLevel: 20, expiry: '2027-08-15', barcode: '6009876543210', unitChain: '1 tin = 20 sachets = 200 tablets' },
  { id: 'p2', name: 'Amoxicillin 500mg', brand: 'Fidson', category: 'Antibiotic', price: 120, cost: 85, stock: 8, lowLevel: 15, expiry: '2026-09-10', barcode: '6001112223334', unitChain: '1 pack = 10 capsules' },
  { id: 'p3', name: 'Coartem 20/120mg', brand: 'Novartis', category: 'Antimalarial', price: 1800, cost: 1350, stock: 45, lowLevel: 10, expiry: '2028-05-20', barcode: '6001234567890', unitChain: '1 pack = 24 tablets' },
  { id: 'p4', name: 'Vitamin C 1000mg', brand: 'Nature', category: 'Supplement', price: 30, cost: 20, stock: 500, lowLevel: 50, expiry: '2027-11-01', barcode: '6007778889990', unitChain: '1 bottle = 100 tablets' },
  { id: 'p5', name: 'Metformin 500mg', brand: 'Merck', category: 'Antidiabetic', price: 80, cost: 55, stock: 15, lowLevel: 20, expiry: '2026-12-30', barcode: '6004443332221', unitChain: '1 pack = 30 tablets' },
  { id: 'p6', name: 'ORS Sachet', brand: 'WHO-formula', category: 'Rehydration', price: 150, cost: 100, stock: 120, lowLevel: 25, expiry: '2026-08-25', barcode: '6005554443322', unitChain: '1 box = 20 sachets' },
  { id: 'p7', name: 'Ciprofloxacin 500mg', brand: 'Ranbaxy', category: 'Antibiotic', price: 200, cost: 140, stock: 60, lowLevel: 10, expiry: '2029-01-15', barcode: '6008887776655', unitChain: '1 pack = 10 tablets' },
  { id: 'p8', name: 'Ibuprofen 400mg', brand: 'Emzor', category: 'Analgesic', price: 45, cost: 30, stock: 3, lowLevel: 15, expiry: '2027-07-20', barcode: '6003332221110', unitChain: '1 tin = 100 tablets' },
]

const DAY_HISTORY_INIT = [
  { id:'dh1', date:'Sun, 20 Jul 2026', income:612900, profit:187300, balanced:true, mismatch:0, cash:{sys:231500,cnt:231500}, pos1:{sys:148200,cnt:148200}, pos2:{sys:96700,cnt:96700}, transfer:{sys:89100,cnt:89100}, credit:47400, expenses:18500, closedBy:'Blessing (Cashier)', closedAt:'9:58 PM' },
  { id:'dh2', date:'Sat, 19 Jul 2026', income:598200, profit:172400, balanced:true, mismatch:0, cash:{sys:225000,cnt:225000}, pos1:{sys:142000,cnt:142000}, pos2:{sys:91200,cnt:91200}, transfer:{sys:95000,cnt:95000}, credit:45000, expenses:16800, closedBy:'Blessing (Cashier)', closedAt:'9:52 PM' },
  { id:'dh3', date:'Fri, 18 Jul 2026', income:542600, profit:149900, balanced:false, mismatch:3200, cash:{sys:198000,cnt:194800}, pos1:{sys:135400,cnt:135400}, pos2:{sys:82000,cnt:82000}, transfer:{sys:87200,cnt:87200}, credit:40000, expenses:15200, closedBy:'Blessing (Cashier)', closedAt:'10:05 PM' },
  { id:'dh4', date:'Thu, 17 Jul 2026', income:615000, profit:178000, balanced:true, mismatch:0, cash:{sys:240000,cnt:240000}, pos1:{sys:148000,cnt:148000}, pos2:{sys:89000,cnt:89000}, transfer:{sys:93000,cnt:93000}, credit:45000, expenses:17000, closedBy:'Blessing (Cashier)', closedAt:'9:45 PM' },
  { id:'dh5', date:'Wed, 16 Jul 2026', income:489300, profit:138200, balanced:true, mismatch:0, cash:{sys:180000,cnt:180000}, pos1:{sys:120300,cnt:120300}, pos2:{sys:75000,cnt:75000}, transfer:{sys:82000,cnt:82000}, credit:32000, expenses:14100, closedBy:'Blessing (Cashier)', closedAt:'9:30 PM' },
  { id:'dh6', date:'Tue, 15 Jul 2026', income:510800, profit:145600, balanced:true, mismatch:0, cash:{sys:192000,cnt:192000}, pos1:{sys:128800,cnt:128800}, pos2:{sys:78000,cnt:78000}, transfer:{sys:80000,cnt:80000}, credit:32000, expenses:15200, closedBy:'Blessing (Cashier)', closedAt:'9:48 PM' },
  { id:'dh7', date:'Mon, 14 Jul 2026', income:475200, profit:132800, balanced:true, mismatch:0, cash:{sys:175200,cnt:175200}, pos1:{sys:118000,cnt:118000}, pos2:{sys:72000,cnt:72000}, transfer:{sys:78000,cnt:78000}, credit:32000, expenses:13200, closedBy:'Blessing (Cashier)', closedAt:'9:35 PM' },
]

const USERS = [
  { name:'Chidinma', role:'ATTENDANT', color: C.mutedGrey },
  { name:'Emeka', role:'ATTENDANT', color: C.mutedGrey },
  { name:'Ngozi', role:'ATTENDANT', color: C.mutedGrey },
  { name:'Ifeoma', role:'ATTENDANT', color: C.mutedGrey },
  { name:'Blessing', role:'CASHIER', color: C.slateBadgeText },
  { name:'Baba Emmanuel', role:'ADMIN', color: C.accentBlueDark },
]

const LEADERBOARD = [
  { name:'Chidinma', sales:34, value:128400 },
  { name:'Emeka', sales:29, value:104750 },
  { name:'Ngozi', sales:25, value:88200 },
  { name:'Ifeoma', sales:21, value:71900 },
]

const DEBTORS = [
  { name:'Mrs. Okafor', phone:'08031234567', amount:12400, date:'Today, 2:14 PM' },
  { name:'Chief Paul', phone:'08033445566', amount:47400, date:'Today, 11:30 AM' },
  { name:'Alhaji Musa', phone:'08055667788', amount:65000, date:'Yesterday' },
  { name:'Dr. Benson', phone:'08022334455', amount:39500, date:'18 Jul 2026' },
]

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const navigate = useNavigate()
  const { logout, fullName, username } = useAuth()

  /* ── Load Plus Jakarta Sans ── */
  useEffect(() => {
    if (!document.querySelector('link[href*="Plus+Jakarta+Sans"]')) {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
  }, [])

  /* ── Navigation ── */
  const [tab, setTab] = useState('overview')

  /* ── Notifications ── */
  const [notifications, setNotifications] = useState([])
  const [showNotifMenu, setShowNotifMenu] = useState(false)

  useEffect(() => {
    async function loadNotifications() {
      if (!supabase) return
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!error && data) {
          setNotifications(data)
        }
      } catch (err) {
        console.warn('Could not load admin notifications:', err)
      }
    }

    loadNotifications()
    const timer = setInterval(loadNotifications, 4000)
    return () => clearInterval(timer)
  }, [])

  const markAllNotifsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    if (supabase) {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    }
  }

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  /* ── Shared state ── */
  const [backupFailed, setBackupFailed] = useState(true)
  const [expenseLimit, setExpenseLimit] = useState(25000)
  const [mismatchLimit, setMismatchLimit] = useState(5000)

  /* ── Performance ── */
  const [perfPeriod, setPerfPeriod] = useState('This Week')
  const [perfMetric, setPerfMetric] = useState('revenue')
  const [hoverIdx, setHoverIdx] = useState(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  /* ── Products State & Real Supabase Load ── */
  const [products, setProducts] = useState([])
  const [prodFilter, setProdFilter] = useState('all')
  const [prodSearch, setProdSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [editProd, setEditProd] = useState(null)
  const [receiveProd, setReceiveProd] = useState(null)
  const [newP, setNewP] = useState({ name:'', category:'Analgesic', cost:'', price:'', wholesale:'', stock:'', lowLevel:'15', expiry:'', barcode:'', unitChain:'' })
  const [rxQty, setRxQty] = useState('')
  const [rxCost, setRxCost] = useState('')
  const [rxExpiry, setRxExpiry] = useState('')

  /* ── Real Financial & Metrics State ── */
  const [rawOrders, setRawOrders] = useState([])
  const [rawExpenses, setRawExpenses] = useState([])
  const [todayMoney, setTodayMoney] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [cashTotal, setCashTotal] = useState(0)
  const [posTotal, setPosTotal] = useState(0)
  const [transferTotal, setTransferTotal] = useState(0)
  const [creditToday, setCreditToday] = useState(0)
  const [todayProfit, setTodayProfit] = useState(0)
  const [totalOwed, setTotalOwed] = useState(0)
  const [debtorsList, setDebtorsList] = useState([])
  const [expensesToday, setExpensesToday] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [lateNightOrders, setLateNightOrders] = useState([])
  const [dayHistory, setDayHistory] = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])

  /* ── Fetch Products from Supabase ── */
  const fetchProducts = useCallback(async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true })
      if (!error && data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand || '',
          category: p.category || 'General',
          price: Number(p.selling_price) || 0,
          cost: Number(p.cost_price) || 0,
          stock: p.stock_quantity || 0,
          lowLevel: p.low_stock_threshold || 10,
          expiry: p.expiry_date || '',
          barcode: p.barcode || '',
          unitChain: p.unit ? `1 pack = 10 ${p.unit}s` : '1 pack = 10 units'
        })))
      }
    } catch (err) {
      console.warn('Error loading products from Supabase:', err)
    }
  }, [])

  /* ── Fetch Real Orders, Financials, Leaderboard & Debtors ── */
  const fetchFinancials = useCallback(async () => {
    if (!supabase) return
    try {
      await syncServerTime()
      const todayStr = getServerTodayStr() // Authoritative YYYY-MM-DD in Africa/Lagos WAT
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })

      if (!ordersErr && orders) {
        setRawOrders(orders)
        // Filter paid orders for server today
        const paidToday = orders.filter(o => {
          if (o.status !== 'paid') return false
          const paidDate = o.paid_at || o.created_at
          return paidDate && (paidDate.startsWith(todayStr) || formatServerDate(paidDate, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') === todayStr)
        })
        
        let moneyAcc = 0
        let cashAcc = 0
        let posAcc = 0
        let transAcc = 0
        let credAcc = 0
        let profitAcc = 0
        
        const attendantMap = {}

        paidToday.forEach(o => {
          const amt = Number(o.total_amount) || 0
          moneyAcc += amt

          // Method breakdown
          const pm = (o.payment_method || '').toLowerCase()
          if (pm.includes('cash')) cashAcc += amt
          else if (pm.includes('pos')) posAcc += amt
          else if (pm.includes('transfer')) transAcc += amt

          if (o.is_credit) credAcc += amt

          // Profit calculation from order_items
          if (o.order_items && o.order_items.length > 0) {
            o.order_items.forEach(item => {
              const sell = Number(item.unit_price) || 0
              const cost = Number(item.cost_price) || Math.round(sell * 0.7)
              const qty = item.quantity || 1
              profitAcc += (sell - cost) * qty
            })
          } else {
            profitAcc += Math.round(amt * 0.3) // fallback 30% margin
          }

          // Attendant leaderboard
          const att = o.attendant_name || 'Staff'
          if (!attendantMap[att]) {
            attendantMap[att] = { name: att, sales: 0, value: 0 }
          }
          attendantMap[att].sales += 1
          attendantMap[att].value += amt
        })

        setTodayMoney(moneyAcc)
        setSalesCount(paidToday.length)
        setCashTotal(cashAcc)
        setPosTotal(posAcc)
        setTransferTotal(transAcc)
        setCreditToday(credAcc)
        setTodayProfit(profitAcc)

        // Format leaderboard
        const sortedLeaderboard = Object.values(attendantMap).sort((a, b) => b.value - a.value)
        setLeaderboard(sortedLeaderboard)

        // Late-night orders (00:00 to 06:00 WAT) - Strictly relying on server DB trigger late_night flag
        const lateOrders = orders.filter(o => o.late_night === true)
        setLateNightOrders(lateOrders.map(o => ({
          id: o.id,
          number: o.order_number,
          attendant: o.attendant_name,
          time: formatServerTime(o.created_at, { hour: '2-digit', minute: '2-digit' }),
          amount: Number(o.total_amount) || 0
        })))

        // Debtors / Owed list
        const creditOrders = orders.filter(o => o.is_credit && o.customer_name)
        const debtMap = []
        let owedSum = 0
        creditOrders.forEach(o => {
          const amt = Number(o.total_amount) || 0
          owedSum += amt
          debtMap.push({
            name: o.customer_name,
            phone: o.customer_phone || 'N/A',
            amount: amt,
            date: formatServerDate(o.created_at, { day: 'numeric', month: 'short' })
          })
        })
        setTotalOwed(owedSum)
        setDebtorsList(debtMap)
      }

      // 2. Fetch Expenses for server today
      const { data: expData } = await supabase.from('expenses').select('*')
      if (expData) {
        setRawExpenses(expData)
        const expSum = expData
          .filter(e => e.created_at && (e.created_at.startsWith(todayStr) || formatServerDate(e.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') === todayStr))
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        setExpensesToday(expSum)
      }

      // 3. Fetch Day Closes for Day History tab
      const { data: dcData } = await supabase.from('day_closes').select('*').order('created_at', { ascending: false })
      if (dcData) {
        setDayHistory(dcData.map(dc => ({
          id: dc.id,
          date: dc.close_date ? formatServerDate(dc.close_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown Date',
          income: Number(dc.system_total) || 0,
          profit: Math.round((Number(dc.system_total) || 0) * 0.3),
          balanced: Number(dc.total_difference || 0) === 0,
          mismatch: Math.abs(Number(dc.total_difference) || 0),
          cash: { sys: Number(dc.system_cash) || 0, cnt: Number(dc.counted_cash) || 0 },
          pos1: { sys: Number(dc.system_pos1) || 0, cnt: Number(dc.counted_pos1) || 0 },
          pos2: { sys: Number(dc.system_pos2) || 0, cnt: Number(dc.counted_pos2) || 0 },
          transfer: { sys: Number(dc.system_transfer) || 0, cnt: Number(dc.counted_transfer) || 0 },
          credit: Number(dc.system_credit) || 0,
          expenses: Number(dc.system_expenses) || 0,
          closedBy: dc.closed_by || 'Cashier',
          closedAt: dc.created_at ? formatServerTime(dc.created_at, { hour: '2-digit', minute: '2-digit' }) : 'N/A'
        })))
      }

      // 4. Fetch Staff Profiles for Settings tab
      const { data: profData } = await supabase.from('profiles').select('*')
      if (profData) {
        setStaffProfiles(profData.map(p => ({
          name: p.full_name || p.username || 'User',
          role: (p.role || 'ATTENDANT').toUpperCase(),
          color: p.role === 'admin' ? C.accentBlueDark : p.role === 'cashier' ? C.slateBadgeText : C.mutedGrey
        })))
      }
    } catch (err) {
      console.warn('Error loading financial metrics:', err)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchFinancials()
    const timer = setInterval(() => {
      fetchProducts()
      fetchFinancials()
    }, 5000)
    return () => clearInterval(timer)
  }, [fetchProducts, fetchFinancials])

  /* ── Debtors ── */
  const [showDebtors, setShowDebtors] = useState(false)

  /* ── Stock Modal (low stock / near expiry) ── */
  const [stockModalType, setStockModalType] = useState(null) // 'low_stock' | 'near_expiry' | null

  /* ── Settings ── */
  const [resetSent, setResetSent] = useState(null)

  /* ── Generate daily data from real database orders & expenses ── */
  const dailyData = useMemo(() => buildRealDailyData(rawOrders, rawExpenses), [rawOrders, rawExpenses])

  /* ── Chart computations ── */
  const chartData = useMemo(() => {
    const { points, prev, caption, labels, hasPrev } = sliceData(dailyData, perfPeriod, customFrom, customTo, rawOrders)
    const metricKey = perfMetric
    const values = points.map(p => p[metricKey] || 0)
    const { pts, min, max } = buildChartPoints(values)

    const total = values.reduce((s, v) => s + v, 0)
    const prevTotal = prev.length > 0 ? sumMetric(prev, metricKey) : 0
    const changePct = hasPrev && prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : null

    const labeledPts = pts.map((p, i) => ({ ...p, label: labels[i] || '' }))
    const linePath = buildSmoothPath(labeledPts)
    const areaPath = buildAreaPath(labeledPts)

    // KPI data
    const kpis = ['revenue', 'profit', 'sales', 'credit', 'expenses'].map(key => {
      const cur = points.reduce((s, d) => s + (d[key] || 0), 0)
      const prv = prev.length > 0 ? sumMetric(prev, key) : 0
      const pct = hasPrev && prv > 0 ? ((cur - prv) / prv * 100) : null
      return { key, cur, pct }
    })
    const avgSaleValue = kpis[2].cur > 0 ? kpis[0].cur / kpis[2].cur : 0
    const avgPrev = hasPrev && prev.length > 0 ? (sumMetric(prev, 'revenue') / (sumMetric(prev, 'sales') || 1)) : 0
    const avgPct = hasPrev && avgPrev > 0 ? ((avgSaleValue - avgPrev) / avgPrev * 100) : null

    return { pts: labeledPts, linePath, areaPath, total, changePct, caption, hasPrev, kpis, avgSaleValue, avgPct }
  }, [dailyData, perfPeriod, perfMetric, customFrom, customTo, rawOrders])

  /* ── Products filtering ── */
  const now = new Date()
  const sixtyDaysFromNow = useMemo(() => new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), [now])
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = prodSearch.toLowerCase()
      const matchSearch = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.barcode.includes(prodSearch)
      if (!matchSearch) return false
      if (prodFilter === 'low_stock') return p.stock <= p.lowLevel
      if (prodFilter === 'near_expiry') return new Date(p.expiry) <= sixtyDaysFromNow
      return true
    })
  }, [products, prodSearch, prodFilter, sixtyDaysFromNow])

  const lowStockCount = products.filter(p => p.stock <= p.lowLevel).length
  const nearExpiryCount = products.filter(p => new Date(p.expiry) <= sixtyDaysFromNow).length

  const lowStockList = useMemo(() => {
    return products
      .filter(p => p.stock <= p.lowLevel)
      .sort((a, b) => a.stock - b.stock)
  }, [products])

  const nearExpiryList = useMemo(() => {
    return products
      .filter(p => new Date(p.expiry) <= sixtyDaysFromNow)
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
  }, [products, sixtyDaysFromNow])

  /* ── Handlers ── */
  const handleLogout = async () => { await logout(); navigate('/', { replace: true }) }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (editProd) {
      if (!editProd.name || !editProd.price) return
      if (supabase) {
        await supabase.from('products').update({
          name: editProd.name,
          category: editProd.category || 'Analgesic',
          cost_price: +editProd.cost || 0,
          selling_price: +editProd.price || 0,
          stock_quantity: +editProd.stock || 0,
          low_stock_threshold: +editProd.lowLevel || 10,
          expiry_date: editProd.expiry || null,
          barcode: editProd.barcode || null,
        }).eq('id', editProd.id)
      }
      setShowAddModal(false)
      setEditProd(null)
      fetchProducts()
      return
    }

    if (!newP.name || !newP.price) return
    const payload = {
      name: newP.name,
      category: newP.category || 'Analgesic',
      cost_price: +newP.cost || Math.round(+newP.price * 0.7),
      selling_price: +newP.price || 0,
      stock_quantity: +newP.stock || 0,
      low_stock_threshold: +newP.lowLevel || 15,
      expiry_date: newP.expiry || '2027-12-31',
      barcode: newP.barcode || null
    }

    if (supabase) {
      await supabase.from('products').insert(payload)
    }
    setShowAddModal(false)
    setNewP({ name:'', category:'Analgesic', cost:'', price:'', wholesale:'', stock:'', lowLevel:'15', expiry:'', barcode:'', unitChain:'' })
    fetchProducts()
  }

  const handleReceiveStock = async (e) => {
    e.preventDefault()
    if (!receiveProd || !rxQty) return
    const newStock = (receiveProd.stock || 0) + (+rxQty)
    const updateObj = { stock_quantity: newStock }
    if (rxCost) updateObj.cost_price = +rxCost
    if (rxExpiry) updateObj.expiry_date = rxExpiry

    if (supabase) {
      await supabase.from('products').update(updateObj).eq('id', receiveProd.id)
    }

    setShowReceiveModal(false)
    setReceiveProd(null); setRxQty(''); setRxCost(''); setRxExpiry('')
    fetchProducts()
  }

  const handleResetPw = (name) => {
    setResetSent(name)
    setTimeout(() => setResetSent(null), 2000)
  }

  /* ── Shared styles ── */
  const card = { background: C.white, borderRadius: '16px', border: `1px solid ${C.cardBorder}`, padding: '20px' }
  const pillActive = { background: `linear-gradient(135deg, ${C.accentBlue}, ${C.accentBlueDark})`, color: '#fff', border: 'none' }
  const pillInactive = { background: C.white, color: C.nearBlack, border: `1.5px solid ${C.cardBorder}` }
  const pillBase = { padding: '8px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }

  const NAV_ITEMS = [
    { id:'overview', label:'Overview', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id:'performance', label:'Performance', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id:'products', label:'Products', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg> },
    { id:'day_history', label:'Day History', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id:'settings', label:'Settings', svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ]

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100dvh', background: C.warmBg, fontFamily: FONT, color: C.nearBlack, display: 'flex' }}>
      {/* ───────────────── SIDEBAR (230px) ───────────────── */}
      <aside style={{ width: '230px', background: C.white, borderRight: `1px solid ${C.cardBorder}`, padding: '24px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 10px', marginBottom: '36px' }}>
            <img
              src="/logo.jpg"
              alt="Logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'contain', border: '1px solid rgba(0,0,0,0.08)' }}
            />
            <div style={{ display: 'none', width: '34px', height: '34px', borderRadius: '10px', background: C.accentBlueDark, color: '#fff', fontWeight: 800, fontSize: '13px', alignItems: 'center', justifyContent: 'center' }}>EP</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: C.nearBlack }}>Emmanuel</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: C.nearBlack }}>Pharmacy</div>
            </div>
          </div>
          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {NAV_ITEMS.map(item => {
              const active = tab === item.id
              return (
                <button key={item.id} onClick={() => setTab(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px',
                  background: active ? C.lightBlueTint : 'transparent',
                  color: active ? C.accentBlueDark : C.inactiveNav,
                  border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 700 : 600,
                  fontFamily: FONT, textAlign: 'left', transition: 'all 0.15s',
                }}>
                  {item.svg}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
        {/* Sign out */}
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', color: C.red, border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>
          Sign Out
        </button>
      </aside>

      {/* ───────────────── MAIN AREA ───────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP BAR */}
        <header style={{ background: C.white, padding: '16px 32px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: C.nearBlack, margin: 0 }}>{tab === 'day_history' ? 'Day History' : tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
            <p style={{ fontSize: '12px', color: C.mutedGrey, margin: '2px 0 0' }}>
              {tab === 'overview' && 'Emmanuel Pharmacy · Today, 20 Jul'}
              {tab === 'performance' && 'Business trends · Emmanuel Pharmacy'}
              {tab === 'products' && `${products.length} products in stock`}
              {tab === 'day_history' && `${dayHistory.length} closed days`}
              {tab === 'settings' && 'Shop configuration & team'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                style={{
                  background: unreadCount > 0 ? '#FEF3C7' : C.lightBlueTint,
                  border: unreadCount > 0 ? '1px solid #FCD34D' : 'none',
                  color: unreadCount > 0 ? '#92400E' : C.accentBlueDark,
                  padding: '8px 14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: FONT,
                  transition: 'all 0.2s',
                }}
              >
                🔔 {unreadCount > 0 ? `${unreadCount} New Alert${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              </button>

              {/* Dropdown Menu */}
              {showNotifMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: '48px', width: '380px', background: C.white,
                  borderRadius: '16px', border: `1px solid ${C.cardBorder}`, boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                  zIndex: 100, padding: '16px', maxHeight: '420px', overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f5' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: C.nearBlack }}>Admin Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllNotifsRead} style={{ background: 'none', border: 'none', color: C.accentBlueDark, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: C.mutedGrey, fontSize: '13px' }}>
                      No alerts or credit sale notifications yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '12px 14px', borderRadius: '12px',
                          background: n.is_read ? '#F9FAFB' : '#FEF3C7',
                          border: `1px solid ${n.is_read ? '#E5E7EB' : '#FCD34D'}`,
                        }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: n.is_read ? C.nearBlack : '#92400E', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{n.title}</span>
                            {!n.is_read && <span style={{ fontSize: '9px', fontWeight: 800, background: '#D97706', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>NEW</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.4' }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '10px', color: C.mutedGrey, marginTop: '6px', textAlign: 'right' }}>
                            {new Date(n.created_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ background: C.lightBlueTint, color: C.accentBlueDark, padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
              {fullName || username || 'Baba Emmanuel'} (Admin)
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>

          {/* ═════════════ OVERVIEW ═════════════ */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1060px' }}>
              {/* CREDIT SALE ALERT BANNER FOR ADMIN */}
              {unreadCount > 0 && (
                <div style={{ background: '#FEF3C7', border: '1.5px solid #FCD34D', color: '#92400E', borderRadius: '14px', padding: '14px 20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <div>Credit Sale Notification: Cashier processed {unreadCount} new credit sale{unreadCount > 1 ? 's' : ''}.</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, marginTop: '2px' }}>{notifications.find(n => !n.is_read)?.message}</div>
                    </div>
                  </div>
                  <button onClick={() => setShowNotifMenu(true)} style={{ background: '#D97706', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                    View Alerts ({unreadCount})
                  </button>
                </div>
              )}

              {/* RED BACKUP BANNER */}
              {backupFailed && (
                <div style={{ background: C.red, color: '#fff', borderRadius: '12px', padding: '14px 20px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>⚠</span> Backup failed — data is not protected. Fix now.
                </div>
              )}

              {/* ROW 1: TODAY'S MONEY + PROFIT */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* TODAY'S MONEY (BLUE CARD) */}
                <div style={{ background: C.accentBlueDark, borderRadius: '20px', padding: '24px', color: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ ...HEADING_STYLE, color: 'rgba(255,255,255,0.65)' }}>TODAY'S MONEY</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: '999px' }}>{salesCount} sales</span>
                  </div>
                  <div style={{ fontSize: '40px', fontWeight: 800, ...NUM_STYLE, letterSpacing: '-0.02em', marginBottom: '18px' }}>₦{todayMoney.toLocaleString('en-NG')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '13px', fontWeight: 600, paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: .7 }}>Cash</span><span style={{ fontWeight: 800, ...NUM_STYLE }}>₦{cashTotal.toLocaleString('en-NG')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: .7 }}>POS</span><span style={{ fontWeight: 800, ...NUM_STYLE }}>₦{posTotal.toLocaleString('en-NG')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: .7 }}>Transfer</span><span style={{ fontWeight: 800, ...NUM_STYLE }}>₦{transferTotal.toLocaleString('en-NG')}</span></div>
                  </div>
                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ opacity: .7 }}>Credit</span>
                      <span style={{ fontSize: '9px', fontWeight: 800, background: 'rgba(255,255,255,0.22)', padding: '2px 6px', borderRadius: '4px' }}>OWED, NOT RECEIVED</span>
                    </div>
                    <span style={{ fontWeight: 800, ...NUM_STYLE }}>₦{creditToday.toLocaleString('en-NG')}</span>
                  </div>
                </div>

                {/* PROFIT CARD */}
                <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 24px' }}>
                  <span style={HEADING_STYLE}>PROFIT</span>
                  <div style={{ fontSize: '46px', fontWeight: 800, color: C.nearBlack, ...NUM_STYLE, letterSpacing: '-0.02em', marginTop: '6px' }}>₦{todayProfit.toLocaleString('en-NG')}</div>
                </div>
              </div>

              {/* ROW 2: LEADERBOARD + OWED / EXPENSES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* ATTENDANT LEADERBOARD */}
                <div style={card}>
                  <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '14px' }}>ATTENDANT LEADERBOARD · TODAY</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: C.mutedGrey, fontSize: '13px' }}>No sales recorded by attendants today</div>
                    ) : (
                      leaderboard.map((att, i) => (
                        <div key={att.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: i === 0 ? C.lightBlueTint : '#FAFAF7', border: `1px solid ${i === 0 ? '#D6E0FB' : C.cardBorder}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '26px', height: '26px', borderRadius: '8px', background: i === 0 ? C.accentBlueDark : '#E8E5DD', color: i === 0 ? '#fff' : C.mutedGrey, fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...NUM_STYLE }}>{i + 1}</span>
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{att.name}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', ...NUM_STYLE, display: 'block' }}>₦{att.value.toLocaleString()}</span>
                            <span style={{ fontSize: '11px', color: C.mutedGrey, ...NUM_STYLE }}>{att.sales} sales</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* RIGHT COL: OWED + EXPENSES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* TOTAL OWED */}
                  <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={HEADING_STYLE}>TOTAL OWED</span>
                      <span style={{ fontSize: '9px', fontWeight: 800, background: C.slateBadgeBg, color: C.slateBadgeText, padding: '2px 8px', borderRadius: '4px' }}>NOT CASH</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: C.nearBlack, ...NUM_STYLE, margin: '4px 0 12px' }}>₦{totalOwed.toLocaleString('en-NG')}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => setShowDebtors(true)} style={{ background: 'none', border: 'none', color: C.accentBlueDark, fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0, fontFamily: FONT }}>See everyone owing ({debtorsList.length})</button>
                      <span style={{ color: C.accentBlueDark, fontWeight: 700 }}>→</span>
                    </div>
                  </div>
                  {/* EXPENSES VS LIMIT */}
                  <div style={card}>
                    <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '10px' }}>EXPENSES TODAY VS LIMIT</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: expensesToday > expenseLimit ? C.red : C.accentBlueDark, ...NUM_STYLE, marginBottom: '8px' }}>
                      ₦{expensesToday.toLocaleString('en-NG')} of ₦{expenseLimit.toLocaleString()} limit
                    </div>
                    <div style={{ width: '100%', height: '8px', background: C.guideLine, borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((expensesToday / (expenseLimit || 1)) * 100, 100)}%`, height: '100%', background: expensesToday > expenseLimit ? C.red : C.accentBlueDark, borderRadius: '999px', transition: 'all 0.3s' }} />
                    </div>
                  </div>
                  {/* STOCK VALUE */}
                  <div style={card}>
                    <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '6px' }}>STOCK VALUE ON SHELVES</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: C.nearBlack, ...NUM_STYLE, marginBottom: '8px' }}>
                      ₦{products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0).toLocaleString('en-NG')}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        onClick={() => setStockModalType('low_stock')}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: '11px', fontWeight: 800, color: C.red, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}
                        title="Click to view low stock items"
                      >
                        {lowStockCount} items low stock
                      </button>
                      <span style={{ fontSize: '11px', color: C.mutedGrey }}>·</span>
                      <button
                        onClick={() => setStockModalType('near_expiry')}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: '11px', fontWeight: 800, color: C.red, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}
                        title="Click to view near expiry items"
                      >
                        {nearExpiryCount} near expiry
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ALERTS */}
              <div style={card}>
                <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '12px' }}>ALERTS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { dot: C.slateBadgeText, text: 'Credit sale — Mrs. Okafor, ₦12,400, by Chidinma · 2:14 PM' },
                    { dot: C.red, text: 'Expenses crossed daily limit · 4:02 PM' },
                    { dot: C.accentBlueDark, text: 'Day closed — ₦612,900 total, balanced · 9:58 PM' },
                  ].map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < 2 ? `1px solid ${C.guideLine}` : 'none', fontSize: '13px', fontWeight: 600, color: C.nearBlack }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* UNUSUAL HOURS / LATE-NIGHT ORDERS NOTICE (00:00–06:00) */}
              {lateNightOrders.length > 0 && (
                <div style={{ ...card, background: '#FFFBEB', borderColor: '#FDE68A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🌙</span>
                    <span style={{ ...HEADING_STYLE, color: '#B45309' }}>UNUSUAL HOURS ACTIVITY (00:00 – 06:00)</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#92400E', margin: '0 0 10px', fontWeight: 500 }}>
                    Flagged orders placed overnight (flexible trading hours). Normal operations unaffected.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {lateNightOrders.map(ln => (
                      <div key={ln.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #FEF3C7', fontSize: '12px' }}>
                        <span>Order #{ln.number} by <strong>{ln.attendant}</strong> at {ln.time}</span>
                        <span style={{ fontWeight: 800, color: C.nearBlack, ...NUM_STYLE }}>₦{ln.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════════ PERFORMANCE ═════════════ */}
          {tab === 'performance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1060px' }}>
              {/* PERIOD PILLS */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {['Today', 'This Week', 'This Month', 'This Year', 'Custom'].map(p => (
                  <button key={p} onClick={() => { setPerfPeriod(p); setHoverIdx(null) }} style={{ ...pillBase, ...(perfPeriod === p ? pillActive : pillInactive) }}>{p}</button>
                ))}
                {perfPeriod === 'Custom' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontSize: '12px', fontFamily: FONT }} />
                    <span style={{ fontSize: '12px', color: C.mutedGrey }}>to</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontSize: '12px', fontFamily: FONT }} />
                  </div>
                )}
              </div>

              {/* CHART CARD */}
              <div style={{ ...card, padding: '28px' }}>
                {/* HERO HEADER */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 800, color: C.nearBlack, ...NUM_STYLE, letterSpacing: '-0.02em' }}>
                    {perfMetric === 'sales' ? fmtPlain(chartData.total) : fmt(chartData.total)}
                  </span>
                  {chartData.changePct !== null && (
                    <span style={{ fontSize: '14px', fontWeight: 800, color: chartData.changePct >= 0 ? C.green : C.red }}>
                      {chartData.changePct >= 0 ? '▲' : '▼'} {chartData.changePct >= 0 ? '+' : ''}{chartData.changePct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: C.mutedGrey, margin: '0 0 20px', fontWeight: 500 }}>
                  {perfMetric === 'sales' ? 'No. of sales' : perfMetric.charAt(0).toUpperCase() + perfMetric.slice(1)} · {chartData.caption}
                </p>

                {/* SVG CHART AREA */}
                <div style={{ position: 'relative', width: '100%', height: '200px', marginBottom: '20px' }} onMouseLeave={() => setHoverIdx(null)}>
                  {/* Guide lines */}
                  {[25, 50, 75].map(pct => (
                    <div key={pct} style={{ position: 'absolute', top: `${pct}%`, left: 0, right: 0, height: '1px', background: C.guideLine, pointerEvents: 'none' }} />
                  ))}

                  {/* SVG */}
                  <svg viewBox="0 0 640 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accentBlue} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={C.accentBlue} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {chartData.areaPath && <path d={chartData.areaPath} fill="url(#areaGrad)" />}
                    {chartData.linePath && <path d={chartData.linePath} fill="none" stroke={C.accentBlue} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
                  </svg>

                  {/* Hit zones */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', cursor: 'crosshair' }}>
                    {chartData.pts.map((_, i) => (
                      <div key={i} style={{ flex: 1 }} onMouseEnter={() => setHoverIdx(i)} onClick={() => setHoverIdx(i)} />
                    ))}
                  </div>

                  {/* Tooltip overlays */}
                  {hoverIdx !== null && hoverIdx < chartData.pts.length && (() => {
                    const pt = chartData.pts[hoverIdx]
                    const leftPct = (pt.x / 640 * 100) + '%'
                    const topPct = (pt.y / 200 * 100) + '%'
                    return (
                      <>
                        <div style={{ position: 'absolute', left: leftPct, top: 0, bottom: 0, width: '1px', background: C.tooltipLine, pointerEvents: 'none', transform: 'translateX(-50%)' }} />
                        <div style={{ position: 'absolute', left: leftPct, top: topPct, width: '11px', height: '11px', borderRadius: '50%', background: C.accentBlue, border: '2.5px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: leftPct, top: `calc(${topPct} - 46px)`, transform: 'translateX(-50%)', background: C.nearBlack, color: '#fff', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '9px', whiteSpace: 'nowrap', pointerEvents: 'none', ...NUM_STYLE }}>
                          {pt.label} · {perfMetric === 'sales' ? fmtPlain(pt.v) : fmt(pt.v)}
                        </div>
                      </>
                    )
                  })()}

                  {/* X-axis labels */}
                  <div style={{ position: 'absolute', bottom: '-22px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                    {chartData.pts.filter((_, i) => {
                      const n = chartData.pts.length
                      if (n <= 7) return true
                      const step = Math.ceil(n / 7)
                      return i % step === 0 || i === n - 1
                    }).map((pt, i) => (
                      <span key={i} style={{ fontSize: '10px', color: C.mutedGrey, fontWeight: 500 }}>{pt.label}</span>
                    ))}
                  </div>
                </div>

                {/* METRIC TOGGLE PILLS */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '28px' }}>
                  {[{ key: 'revenue', label: 'Revenue' }, { key: 'profit', label: 'Profit' }, { key: 'sales', label: 'No. of Sales' }].map(m => (
                    <button key={m.key} onClick={() => { setPerfMetric(m.key); setHoverIdx(null) }} style={{ ...pillBase, ...(perfMetric === m.key ? pillActive : pillInactive) }}>{m.label}</button>
                  ))}
                </div>
              </div>

              {/* KPI GRID (3 cols) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[
                  { label: 'TOTAL REVENUE', val: fmt(chartData.kpis[0]?.cur), pct: chartData.kpis[0]?.pct, invert: false },
                  { label: 'TOTAL PROFIT', val: fmt(chartData.kpis[1]?.cur), pct: chartData.kpis[1]?.pct, invert: false },
                  { label: 'NUMBER OF SALES', val: fmtPlain(chartData.kpis[2]?.cur), pct: chartData.kpis[2]?.pct, invert: false },
                  { label: 'AVERAGE SALE VALUE', val: fmt(chartData.avgSaleValue), pct: chartData.avgPct, invert: false },
                  { label: 'CREDIT GIVEN', val: fmt(chartData.kpis[3]?.cur), pct: chartData.kpis[3]?.pct, invert: true },
                  { label: 'EXPENSES', val: fmt(chartData.kpis[4]?.cur), pct: chartData.kpis[4]?.pct, invert: true },
                ].map((k, i) => {
                  const color = k.pct == null ? null : (k.invert ? (k.pct >= 0 ? C.red : C.green) : (k.pct >= 0 ? C.green : C.red))
                  return (
                    <div key={i} style={card}>
                      <span style={HEADING_STYLE}>{k.label}</span>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: C.nearBlack, ...NUM_STYLE, margin: '6px 0 4px' }}>{k.val}</div>
                      {k.pct != null && chartData.hasPrev && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color }}>
                          {(k.invert ? (k.pct >= 0 ? '▲' : '▼') : (k.pct >= 0 ? '▲' : '▼'))} {k.pct >= 0 ? '+' : ''}{k.pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ═════════════ PRODUCTS ═════════════ */}
          {tab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1060px' }}>
              {/* SEARCH + FILTER + ADD */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <input type="text" placeholder="Search product or barcode…" value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                  style={{ flex: 1, minWidth: '260px', height: '42px', padding: '0 16px', background: C.white, border: `1.5px solid ${C.cardBorder}`, borderRadius: '999px', fontSize: '13px', fontFamily: FONT, outline: 'none' }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[{ id: 'all', label: 'All' }, { id: 'low_stock', label: 'Low stock' }, { id: 'near_expiry', label: 'Near expiry' }].map(f => (
                    <button key={f.id} onClick={() => setProdFilter(f.id)} style={{ ...pillBase, ...(prodFilter === f.id ? pillActive : pillInactive) }}>{f.label}</button>
                  ))}
                  <button onClick={() => setShowAddModal(true)} style={{ ...pillBase, ...pillActive, padding: '10px 18px' }}>+ Add product</button>
                </div>
              </div>

              {/* PRODUCT LIST */}
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: C.mutedGrey, fontSize: '13px' }}>
                    No products found matching "{prodSearch}"
                  </div>
                ) : (
                  filteredProducts.map((p, idx) => {
                    const isLow = p.stock <= p.lowLevel
                    const isNearExp = p.expiry && new Date(p.expiry) <= sixtyDaysFromNow
                    const expDate = p.expiry ? new Date(p.expiry) : null
                    const expLabel = expDate ? `Exp ${MONTHS[expDate.getMonth()]} ${expDate.getFullYear()}` : 'No Expiry'
                    return (
                      <div key={p.id} onClick={() => { setEditProd(p); setShowAddModal(true) }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: idx < filteredProducts.length - 1 ? `1px solid ${C.guideLine}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: C.nearBlack }}>{p.name}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: C.mutedGrey, fontWeight: 500 }}>{p.brand ? `${p.brand} · ` : ''}{p.category}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', fontSize: '13px' }}>
                          <span style={{ fontWeight: 800, color: C.accentBlueDark, ...NUM_STYLE }}>₦{p.price.toLocaleString()}/unit</span>
                          <span style={{ fontWeight: isLow ? 800 : 600, color: isLow ? C.red : C.nearBlack, ...NUM_STYLE, minWidth: '60px' }}>{p.stock} left</span>
                          <span style={{ fontWeight: isNearExp ? 800 : 500, color: isNearExp ? C.red : C.mutedGrey, minWidth: '100px' }}>{expLabel}</span>
                          <button onClick={(e) => { e.stopPropagation(); setReceiveProd(p); setShowReceiveModal(true) }}
                            style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1.5px solid ${C.cardBorder}`, background: C.white, color: C.accentBlueDark, fontWeight: 800, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ═════════════ DAY HISTORY ═════════════ */}
          {tab === 'day_history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1060px' }}>
              {/* MONTH FILTER PILLS */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {['All months', 'July 2026', 'June 2026', 'May 2026'].map(m => (
                  <button key={m} onClick={() => setMonthFilter(m)} style={{ ...pillBase, ...(monthFilter === m ? pillActive : pillInactive) }}>{m}</button>
                ))}
              </div>

              {/* DAY ROWS (ACCORDION) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dayHistory.length === 0 ? (
                  <div style={{ ...card, padding: '32px', textAlign: 'center', color: C.mutedGrey, fontSize: '13px' }}>
                    No day closes recorded yet in database
                  </div>
                ) : (
                  dayHistory.map(dh => {
                    const isExpanded = expandedDay === dh.id
                    return (
                      <div key={dh.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                        {/* HEADER ROW */}
                        <div onClick={() => setExpandedDay(isExpanded ? null : dh.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: C.nearBlack }}>{dh.date}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px' }}>
                            <span style={{ color: C.mutedGrey }}>Income <strong style={{ color: C.nearBlack, ...NUM_STYLE }}>₦{dh.income.toLocaleString()}</strong></span>
                            <span style={{ color: C.green, fontWeight: 700, ...NUM_STYLE }}>Profit ₦{dh.profit.toLocaleString()}</span>
                            <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, ...NUM_STYLE,
                              background: dh.balanced ? '#E6F4EC' : '#FBE6E8',
                              color: dh.balanced ? C.green : C.red
                            }}>
                              {dh.balanced ? 'BALANCED' : `MISMATCH ₦${dh.mismatch.toLocaleString()}`}
                            </span>
                            <span style={{ color: C.mutedGrey, fontSize: '18px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                          </div>
                        </div>

                        {/* EXPANDED DETAIL */}
                        {isExpanded && (
                          <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.guideLine}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 20px', padding: '16px 0', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.mutedGrey }}>Cash</span><span style={{ fontWeight: 700, ...NUM_STYLE }}>₦{dh.cash.sys.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.mutedGrey }}>POS 1</span><span style={{ fontWeight: 700, ...NUM_STYLE }}>₦{dh.pos1.sys.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.mutedGrey }}>POS 2</span><span style={{ fontWeight: 700, ...NUM_STYLE }}>₦{dh.pos2.sys.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.mutedGrey }}>Transfer</span><span style={{ fontWeight: 700, ...NUM_STYLE }}>₦{dh.transfer.sys.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.slateBadgeText }}>Credit</span><span style={{ fontWeight: 700, color: C.slateBadgeText, ...NUM_STYLE }}>₦{dh.credit.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.mutedGrey }}>Expenses</span><span style={{ fontWeight: 700, ...NUM_STYLE }}>₦{dh.expenses.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.green, fontWeight: 700 }}>Profit</span><span style={{ fontWeight: 800, color: C.green, ...NUM_STYLE }}>₦{dh.profit.toLocaleString()}</span></div>
                            </div>
                            <div style={{ fontSize: '12px', color: C.mutedGrey, fontWeight: 500, paddingTop: '10px', borderTop: `1px solid ${C.guideLine}` }}>
                              Closed by {dh.closedBy} · {dh.closedAt} · Locked, read-only
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ═════════════ SETTINGS ═════════════ */}
          {tab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1060px' }}>
              {/* LEFT COL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* DAILY LIMITS */}
                <div style={card}>
                  <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '14px' }}>DAILY LIMITS</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: C.mutedGrey, display: 'block', marginBottom: '4px' }}>Daily expense limit (₦)</label>
                      <input type="number" value={expenseLimit} onChange={e => setExpenseLimit(Number(e.target.value) || 0)}
                        style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '10px', border: `1.5px solid ${C.cardBorder}`, fontSize: '14px', fontWeight: 700, fontFamily: FONT, ...NUM_STYLE }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: C.mutedGrey, display: 'block', marginBottom: '4px' }}>Mismatch alert limit (₦)</label>
                      <input type="number" value={mismatchLimit} onChange={e => setMismatchLimit(Number(e.target.value) || 0)}
                        style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '10px', border: `1.5px solid ${C.cardBorder}`, fontSize: '14px', fontWeight: 700, fontFamily: FONT, ...NUM_STYLE }} />
                    </div>
                  </div>
                </div>

                {/* BACKUP STATUS */}
                <div style={card}>
                  <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '10px' }}>BACKUP STATUS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: backupFailed ? C.red : C.green }} />
                    <span style={{ fontWeight: 800, fontSize: '14px', color: backupFailed ? C.red : C.green }}>
                      {backupFailed ? 'Backup failed' : 'Backup healthy'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: C.mutedGrey, margin: 0 }}>Last successful backup: yesterday, 9:58 PM</p>
                  <button onClick={() => setBackupFailed(!backupFailed)} style={{ marginTop: '12px', ...pillBase, ...pillActive, fontSize: '12px' }}>
                    {backupFailed ? 'Fix Backup Now' : 'Simulate Failure'}
                  </button>
                </div>
              </div>

              {/* RIGHT COL: USER ACCOUNTS */}
              <div style={card}>
                <span style={{ ...HEADING_STYLE, display: 'block', marginBottom: '14px' }}>USER ACCOUNTS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(staffProfiles.length > 0 ? staffProfiles : USERS).map(u => (
                    <div key={u.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.guideLine}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{u.name}</span>
                        <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                          background: u.role === 'ADMIN' ? C.lightBlueTint : u.role === 'CASHIER' ? C.slateBadgeBg : '#F1EDE2',
                          color: u.role === 'ADMIN' ? C.accentBlueDark : u.role === 'CASHIER' ? C.slateBadgeText : C.mutedGrey
                        }}>{u.role}</span>
                      </div>
                      <button onClick={() => handleResetPw(u.name)} style={{ background: 'none', border: 'none', color: C.accentBlueDark, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>
                        {resetSent === u.name ? 'Link sent ✓' : 'Reset password'}
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: C.mutedGrey, fontStyle: 'italic', marginTop: '14px', marginBottom: 0 }}>One person, one login.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════════════ */}

      {/* DEBTORS MODAL */}
      {showDebtors && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.white, borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Everyone Owing (₦{totalOwed.toLocaleString()})</h3>
              <button onClick={() => setShowDebtors(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: C.mutedGrey }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
              {(debtorsList.length > 0 ? debtorsList : DEBTORS).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: '#FAFAF7', border: `1px solid ${C.cardBorder}` }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '13px', display: 'block' }}>{d.name}</span>
                    <span style={{ fontSize: '11px', color: C.mutedGrey }}>{d.phone} · {d.date}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: C.nearBlack, ...NUM_STYLE }}>₦{d.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.white, borderRadius: '20px', maxWidth: '500px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{editProd ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditProd(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: C.mutedGrey }}>✕</button>
            </div>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Name *</label>
                <input type="text" required value={editProd ? editProd.name : newP.name} onChange={e => editProd ? setEditProd({...editProd, name: e.target.value}) : setNewP({...newP, name: e.target.value})} placeholder="e.g. Paracetamol 500mg"
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Category</label>
                  <select value={newP.category} onChange={e => setNewP({...newP, category: e.target.value})} style={{ width: '100%', height: '38px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }}>
                    {['Analgesic','Antibiotic','Antimalarial','Supplement','Antidiabetic','Rehydration'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>Cost price (₦) — Admin only</label>
                  <input type="number" value={newP.cost} onChange={e => setNewP({...newP, cost: e.target.value})} placeholder="35"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid #FDE68A`, background: '#FFFBEB', fontFamily: FONT, fontSize: '13px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.accentBlueDark }}>Retail price (₦) *</label>
                  <input type="number" required value={newP.price} onChange={e => setNewP({...newP, price: e.target.value})} placeholder="50"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Wholesale price (₦)</label>
                  <input type="number" value={newP.wholesale} onChange={e => setNewP({...newP, wholesale: e.target.value})} placeholder="Optional"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Initial stock</label>
                  <input type="number" value={newP.stock} onChange={e => setNewP({...newP, stock: e.target.value})} placeholder="240"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Low-stock level</label>
                  <input type="number" value={newP.lowLevel} onChange={e => setNewP({...newP, lowLevel: e.target.value})} placeholder="15"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Unit chain</label>
                <input type="text" value={newP.unitChain} onChange={e => setNewP({...newP, unitChain: e.target.value})} placeholder="e.g. 1 tin = 20 sachets = 200 tablets"
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Barcode (optional)</label>
                  <input type="text" value={newP.barcode} onChange={e => setNewP({...newP, barcode: e.target.value})} placeholder="6009876543210"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Expiry date</label>
                  <input type="date" value={newP.expiry} onChange={e => setNewP({...newP, expiry: e.target.value})}
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontFamily: FONT, fontSize: '13px' }} />
                </div>
              </div>
              <button type="submit" style={{ width: '100%', height: '44px', background: `linear-gradient(135deg, ${C.accentBlue}, ${C.accentBlueDark})`, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: FONT, marginTop: '6px' }}>
                {editProd ? 'Update Product' : 'Save Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE STOCK MODAL */}
      {showReceiveModal && receiveProd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.white, borderRadius: '20px', maxWidth: '420px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Receive Stock</h3>
              <button onClick={() => { setShowReceiveModal(false); setReceiveProd(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: C.mutedGrey }}>✕</button>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: C.accentBlueDark, margin: '0 0 14px' }}>
              {receiveProd.name} (current: {receiveProd.stock} left)
            </p>
            <form onSubmit={handleReceiveStock} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Quantity received *</label>
                <input type="number" required value={rxQty} onChange={e => setRxQty(e.target.value)} placeholder="e.g. 50"
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontSize: '14px', fontWeight: 700, fontFamily: FONT }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>True cost paid per unit (₦) — Admin only</label>
                <input type="number" value={rxCost} onChange={e => setRxCost(e.target.value)} placeholder={receiveProd.cost.toString()}
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #FDE68A', background: '#FFFBEB', fontSize: '14px', fontWeight: 700, fontFamily: FONT }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: C.mutedGrey }}>Expiry date on pack *</label>
                <input type="date" required value={rxExpiry} onChange={e => setRxExpiry(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`, fontSize: '14px', fontFamily: FONT }} />
              </div>
              <div style={{ background: '#FAFAF7', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', color: C.mutedGrey, fontWeight: 600 }}>
                Sales always take from the earliest-expiring batch first.
              </div>
              <button type="submit" style={{ width: '100%', height: '44px', background: `linear-gradient(135deg, ${C.accentBlue}, ${C.accentBlueDark})`, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: FONT, marginTop: '4px' }}>
                Confirm Stock Receipt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOW STOCK / NEAR EXPIRY MODAL */}
      {stockModalType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.white, borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: C.nearBlack }}>
                  {stockModalType === 'low_stock' ? 'Low Stock Items' : 'Near Expiry Items'}
                </h3>
                <p style={{ fontSize: '12px', color: C.mutedGrey, margin: '2px 0 0' }}>
                  {stockModalType === 'low_stock' ? 'Sorted lowest-stock first' : 'Sorted soonest-expiring first'}
                </p>
              </div>
              <button onClick={() => setStockModalType(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: C.mutedGrey }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stockModalType === 'low_stock' ? (
                lowStockList.length === 0 ? (
                  <p style={{ fontSize: '13px', color: C.mutedGrey, textAlign: 'center', margin: '16px 0' }}>No low stock items</p>
                ) : (
                  lowStockList.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#FAFAF7', border: `1px solid ${C.cardBorder}` }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '14px', display: 'block', color: C.nearBlack }}>{p.name}</span>
                        <span style={{ fontSize: '11px', color: C.mutedGrey }}>{p.brand ? `${p.brand} · ` : ''}{p.category}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: C.red, ...NUM_STYLE, display: 'block' }}>{p.stock} in stock</span>
                        <span style={{ fontSize: '11px', color: C.mutedGrey, ...NUM_STYLE }}>Threshold: {p.lowLevel}</span>
                      </div>
                    </div>
                  ))
                )
              ) : (
                nearExpiryList.length === 0 ? (
                  <p style={{ fontSize: '13px', color: C.mutedGrey, textAlign: 'center', margin: '16px 0' }}>No near expiry items</p>
                ) : (
                  nearExpiryList.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#FAFAF7', border: `1px solid ${C.cardBorder}` }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '14px', display: 'block', color: C.nearBlack }}>{p.name}</span>
                        <span style={{ fontSize: '11px', color: C.mutedGrey }}>Stock: {p.stock} left</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: C.red, ...NUM_STYLE, display: 'block' }}>Expires: {p.expiry}</span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
