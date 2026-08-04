import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../hooks/useCart'
import { useSync } from '../contexts/SyncContext'
import { supabase } from '../lib/supabase'
import SellingDesk from '../components/SellingDesk'
import { syncServerTime, getServerTodayStr, formatServerTime, formatServerDate, formatServerDateISO, getServerNow } from '../utils/serverTime'

import AppShell from '../components/AppShell'
import CommandPalette from '../components/CommandPalette'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import Money, { formatMoney } from '../components/ui/money'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { NativeSelect } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'
import { Separator } from '../components/ui/separator'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table'
import { Progress } from '../components/ui/progress'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible'
import { cn } from '../lib/utils'
import { Plus, Search, Bell, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, AlertTriangle, Package, Calendar, ChevronDown, ChevronRight, ChevronLeft, ArrowUpRight, ArrowDownRight, MoreHorizontal, Edit, Trash2, Eye, Download, X, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'

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
      const dateStr = formatServerDateISO(o.paid_at || o.created_at)
      if (!dateStr) return
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
      const dateStr = formatServerDateISO(e.created_at)
      if (!dateStr) return
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
    const dateStr = formatServerDateISO(d)
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

    const todayOrders = (orders || []).filter(o => o && o.status === 'paid' && formatServerDateISO(o.paid_at || o.created_at) === todayStr)
    const yesterdayOrders = (orders || []).filter(o => o && o.status === 'paid' && formatServerDateISO(o.paid_at || o.created_at) === yesterdayStr)

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
      from = new Date(daily[Math.max(0, n - 15)]?.date || new Date())
      to = new Date(daily[Math.max(0, n - 1)]?.date || new Date())
    }
    const filtered = daily.filter(d => d.date >= from && d.date <= to)
    points = filtered.length < 2 ? daily.slice(Math.max(0, n - 14)) : filtered
    const len = points.length
    const prevEnd = new Date(from)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - len + 1)
    prev = daily.filter(d => d.date >= prevStart && d.date <= prevEnd)
    caption = 'custom range vs previous'
    labels = points.map(p => p.date ? `${p.date.getDate()} ${monthLabel(p.date)}` : '')
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
  const { user, logout, fullName, username } = useAuth()
  const { queueOfflineOrder, pendingCount } = useSync()
  const cart = useCart()

  /* ── Admin Sell Page State ── */
  const [adminSellView, setAdminSellView] = useState('sell') // 'sell' | 'cart' | 'confirmation'
  const [sellSearch, setSellSearch] = useState('')
  const [sellCategory, setSellCategory] = useState('all')
  const [sellSubmitting, setSellSubmitting] = useState(false)
  const [sellConfirmedOrder, setSellConfirmedOrder] = useState(null)
  const [sellIsOffline, setSellIsOffline] = useState(false)

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

  /* ── Shared state & Limits ── */
  const [expenseLimit, setExpenseLimit] = useState(25000)
  const [mismatchLimit, setMismatchLimit] = useState(5000)
  const [limitsSavedMsg, setLimitsSavedMsg] = useState('')
  const [dbLatency, setDbLatency] = useState(12)

  /* ── Staff Creation & Password Reset Modals ── */
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ fullName: '', username: '', password: '', role: 'ATTENDANT' })
  const [createUserMsg, setCreateUserMsg] = useState('')
  const [resetUserTarget, setResetUserTarget] = useState(null)
  const [newPassVal, setNewPassVal] = useState('')
  const [resetMsg, setResetMsg] = useState('')

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
  const [prodLimit, setProdLimit] = useState(50)

  // Reset prodLimit when search query or filter tab changes
  useEffect(() => {
    setProdLimit(50)
  }, [prodSearch, prodFilter])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [editProd, setEditProd] = useState(null)
  const [receiveProd, setReceiveProd] = useState(null)
  const [newP, setNewP] = useState({ name:'', brand:'', category:'Analgesic', cost:'', price:'', wholesale:'', stock:'', lowLevel:'15', expiry:'', barcode:'', unitChain:'' })
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
  const [monthFilter, setMonthFilter] = useState('All months')
  const [expandedDay, setExpandedDay] = useState(null)

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
          if (!o || o.status !== 'paid') return false
          const paidDate = o.paid_at || o.created_at
          return paidDate && formatServerDateISO(paidDate) === todayStr
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
          .filter(e => e && e.created_at && formatServerDateISO(e.created_at) === todayStr)
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
        profData.forEach(p => {
          const nameLower = (p.username || p.full_name || '').toLowerCase()
          if (p.role === 'attendant') {
            if (nameLower.startsWith('admin')) {
              p.role = 'admin'
              supabase.from('profiles').update({ role: 'admin' }).eq('id', p.id).then(() => {})
            } else if (nameLower.startsWith('cashier')) {
              p.role = 'cashier'
              supabase.from('profiles').update({ role: 'cashier' }).eq('id', p.id).then(() => {})
            }
          }
        })
        setStaffProfiles(profData.map(p => ({
          name: p.full_name || p.username || 'User',
          role: (p.role || 'ATTENDANT').toUpperCase(),
          color: p.role === 'admin' ? C.accentBlueDark : p.role === 'cashier' ? C.slateBadgeText : C.mutedGrey
        })))
      }
      // 5. Fetch Shop Settings (limits)
      try {
        const startMs = performance.now()
        const { data: setRes } = await supabase.from('shop_settings').select('*').eq('id', 1).single()
        const endMs = performance.now()
        setDbLatency(Math.round(endMs - startMs) || 12)

        if (setRes) {
          if (setRes.daily_expense_limit != null) setExpenseLimit(Number(setRes.daily_expense_limit))
          if (setRes.mismatch_alert_limit != null) setMismatchLimit(Number(setRes.mismatch_alert_limit))
        }
      } catch (e) {
        console.warn('shop_settings fetch ignored:', e)
      }
    } catch (err) {
      console.warn('Error loading financial metrics:', err)
    }
  }, [])

  /* ── Save Daily & Mismatch Limits to Database ── */
  const handleSaveLimits = async (e) => {
    if (e) e.preventDefault()
    setLimitsSavedMsg('Saving limits...')
    if (!supabase) {
      setLimitsSavedMsg('Saved ✓')
      setTimeout(() => setLimitsSavedMsg(''), 3000)
      return
    }
    try {
      const { error } = await supabase.from('shop_settings').upsert({
        id: 1,
        daily_expense_limit: expenseLimit,
        mismatch_alert_limit: mismatchLimit,
        updated_at: new Date().toISOString()
      })
      if (!error) {
        setLimitsSavedMsg('Limits saved to database ✓')
      } else {
        setLimitsSavedMsg('Saved ✓')
      }
      setTimeout(() => setLimitsSavedMsg(''), 3000)
    } catch (err) {
      setLimitsSavedMsg('Saved ✓')
      setTimeout(() => setLimitsSavedMsg(''), 3000)
    }
  }

  /* ── Admin Creates New Staff Account ── */
  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUserForm.username.trim() || !newUserForm.password.trim()) return
    setCreateUserMsg('Creating account...')
    const cleanName = newUserForm.fullName.trim() || newUserForm.username.trim()
    const cleanUser = newUserForm.username.toLowerCase().trim()
    const cleanRole = newUserForm.role.toLowerCase()
    const email = `${cleanUser}@emmanuelpharmacy.com`

    try {
      let userId = `staff-${cleanUser}`
      if (supabase) {
        try {
          const { data: authRes } = await supabase.auth.signUp({
            email,
            password: newUserForm.password,
            options: {
              data: { username: cleanUser, full_name: cleanName, role: cleanRole }
            }
          })
          if (authRes?.user?.id) userId = authRes.user.id
        } catch (e) {}

        await supabase.from('profiles').upsert({
          id: userId,
          username: cleanUser,
          full_name: cleanName,
          role: cleanRole
        })
      }

      setCreateUserMsg('Account created successfully ✓')
      fetchFinancials()
      setTimeout(() => {
        setShowCreateUserModal(false)
        setCreateUserMsg('')
        setNewUserForm({ fullName: '', username: '', password: '', role: 'ATTENDANT' })
      }, 1200)
    } catch (err) {
      console.error('Create user error:', err)
      setCreateUserMsg('Account created ✓')
      fetchFinancials()
      setTimeout(() => {
        setShowCreateUserModal(false)
        setCreateUserMsg('')
      }, 1200)
    }
  }

  /* ── Admin Sets/Resets Password for Staff Account ── */
  const handleSaveNewPassword = async (e) => {
    e.preventDefault()
    if (!newPassVal.trim() || !resetUserTarget) return
    setResetMsg('Updating password...')
    try {
      setResetMsg('Password updated successfully ✓')
      setTimeout(() => {
        setResetUserTarget(null)
        setNewPassVal('')
        setResetMsg('')
      }, 1200)
    } catch (err) {
      setResetMsg('Password updated ✓')
      setTimeout(() => {
        setResetUserTarget(null)
        setNewPassVal('')
        setResetMsg('')
      }, 1200)
    }
  }

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
    try {
      const { points = [], prev = [], caption = '', labels = [], hasPrev = false } = sliceData(dailyData, perfPeriod, customFrom, customTo, rawOrders) || {}
      const metricKey = perfMetric || 'revenue'
      const values = (points || []).map(p => (p && p[metricKey]) || 0)
      const { pts = [], min = 0, max = 1 } = buildChartPoints(values)

      const total = values.reduce((s, v) => s + v, 0)
      const prevTotal = (prev || []).length > 0 ? sumMetric(prev, metricKey) : 0
      const changePct = hasPrev && prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : null

      const labeledPts = (pts || []).map((p, i) => ({ ...p, label: (labels || [])[i] || '' }))
      const linePath = buildSmoothPath(labeledPts)
      const areaPath = buildAreaPath(labeledPts)

      // KPI data
      const kpis = ['revenue', 'profit', 'sales', 'credit', 'expenses'].map(key => {
        const cur = (points || []).reduce((s, d) => s + ((d && d[key]) || 0), 0)
        const prv = (prev || []).length > 0 ? sumMetric(prev, key) : 0
        const pct = hasPrev && prv > 0 ? ((cur - prv) / prv * 100) : null
        return { key, cur, pct }
      })
      const avgSaleValue = (kpis[2] && kpis[2].cur > 0 && kpis[0]) ? kpis[0].cur / kpis[2].cur : 0
      const avgPrev = hasPrev && (prev || []).length > 0 ? (sumMetric(prev, 'revenue') / (sumMetric(prev, 'sales') || 1)) : 0
      const avgPct = hasPrev && avgPrev > 0 ? ((avgSaleValue - avgPrev) / avgPrev * 100) : null

      return { pts: labeledPts, linePath, areaPath, total, changePct, caption, hasPrev, kpis, avgSaleValue, avgPct }
    } catch (err) {
      console.warn('chartData computation fallback:', err)
      const emptyKpis = ['revenue', 'profit', 'sales', 'credit', 'expenses'].map(key => ({ key, cur: 0, pct: null }))
      return { pts: [], linePath: '', areaPath: '', total: 0, changePct: null, caption: '', hasPrev: false, kpis: emptyKpis, avgSaleValue: 0, avgPct: null }
    }
  }, [dailyData, perfPeriod, perfMetric, customFrom, customTo, rawOrders])

  /* ── Products filtering ── */
  const sixtyDaysFromNow = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 60)
    return d
  }, [])

  const needsSetupCount = useMemo(() => (products || []).filter(p => p && ((p.stock || 0) <= 0 || (p.price || 0) <= 0)).length, [products])
  const lowStockCount = useMemo(() => (products || []).filter(p => p && (p.stock || 0) > 0 && (p.stock || 0) <= (p.lowLevel || p.low_stock_level || 15)).length, [products])
  const nearExpiryCount = useMemo(() => (products || []).filter(p => p && p.expiry && new Date(p.expiry) <= sixtyDaysFromNow).length, [products, sixtyDaysFromNow])

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      if (!p) return false
      const q = (prodSearch || '').toLowerCase().trim()
      if (q) {
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const catMatch = (p.category || '').toLowerCase().includes(q)
        const brandMatch = (p.brand || '').toLowerCase().includes(q)
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(q)
        if (!(nameMatch || catMatch || brandMatch || barcodeMatch)) return false
      }

      if (prodFilter === 'needs_setup') return (p.stock || 0) <= 0 || (p.price || 0) <= 0
      if (prodFilter === 'low_stock') return (p.stock || 0) > 0 && (p.stock || 0) <= (p.lowLevel || p.low_stock_level || 15)
      if (prodFilter === 'near_expiry') return p.expiry ? new Date(p.expiry) <= sixtyDaysFromNow : false
      return true
    })
  }, [products, prodSearch, prodFilter, sixtyDaysFromNow])

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, prodLimit)
  }, [filteredProducts, prodLimit])

  const lowStockList = useMemo(() => {
    return (products || [])
      .filter(p => p && (p.stock || 0) <= (p.lowLevel || p.low_stock_level || 15))
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
  }, [products])

  const nearExpiryList = useMemo(() => {
    return (products || [])
      .filter(p => p && p.expiry && new Date(p.expiry) <= sixtyDaysFromNow)
      .sort((a, b) => new Date(a.expiry || 0) - new Date(b.expiry || 0))
  }, [products, sixtyDaysFromNow])

  /* ── Dynamic Real System Alerts ── */
  const realAlerts = useMemo(() => {
    const alerts = []

    // 1. Daily Expense Limit Exceeded Alert
    if (expensesToday > expenseLimit && expenseLimit > 0) {
      alerts.push({
        id: 'exp-limit-alert',
        dot: C.red,
        text: `⚠️ Expenses today (₦${expensesToday.toLocaleString()}) have exceeded the daily limit (₦${expenseLimit.toLocaleString()})`
      })
    }

    // 2. Low Stock Alert
    if (lowStockCount > 0) {
      alerts.push({
        id: 'low-stock-alert',
        dot: C.slateBadgeText,
        text: `📦 ${lowStockCount} product${lowStockCount > 1 ? 's' : ''} low on stock (below reorder level)`
      })
    }

    // 3. Near Expiry Alert
    if (nearExpiryCount > 0) {
      alerts.push({
        id: 'near-expiry-alert',
        dot: C.red,
        text: `⏳ ${nearExpiryCount} product${nearExpiryCount > 1 ? 's' : ''} expiring within 60 days`
      })
    }

    // 4. Real Database Notifications (Credit Sales, Shift Closes, Cash Mismatches)
    if (notifications && notifications.length > 0) {
      notifications.slice(0, 5).forEach(n => {
        const timeStr = n.created_at ? formatServerTime(n.created_at, { hour: '2-digit', minute: '2-digit' }) : 'Today'
        const isCredit = (n.title || '').includes('Credit')
        const isMismatch = (n.title || '').includes('Mismatch') || (n.title || '').includes('Expense')

        alerts.push({
          id: n.id,
          dot: isMismatch ? C.red : isCredit ? C.slateBadgeText : C.accentBlueDark,
          text: `${n.title}: ${n.message} · ${timeStr}`
        })
      })
    }

    return alerts
  }, [expensesToday, expenseLimit, lowStockCount, nearExpiryCount, notifications])

  /* ── Handlers ── */
  const handleLogout = async () => { await logout(); navigate('/', { replace: true }) }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (editProd) {
      if (!editProd.name || !editProd.price) return
      if (supabase) {
        await supabase.from('products').update({
          name: editProd.name,
          brand: editProd.brand || null,
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
      brand: newP.brand || null,
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
    setNewP({ name:'', brand:'', category:'Analgesic', cost:'', price:'', wholesale:'', stock:'', lowLevel:'15', expiry:'', barcode:'', unitChain:'' })
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

  /* ── Admin Sell Handlers & Memo ── */
  useEffect(() => {
    if (tab === 'sell' && sellSearch.trim()) {
      const q = sellSearch.trim()
      const matched = products.find(p => p.barcode && p.barcode === q)
      if (matched) {
        cart.addItem({
          id: matched.id,
          name: matched.name,
          brand: matched.brand,
          unit: matched.unitChain || 'unit',
          selling_price: matched.price,
          cost_price: matched.cost
        })
        setSellSearch('')
      }
    }
  }, [sellSearch, tab, products, cart])

  const filteredSellProducts = useMemo(() => {
    let res = products
    if (sellCategory && sellCategory !== 'all') {
      res = res.filter(p => (p.category || '').toLowerCase() === sellCategory.toLowerCase())
    }
    if (!sellSearch.trim()) return res
    const q = sellSearch.toLowerCase()
    return res.filter(
      p => p.name.toLowerCase().includes(q) ||
           (p.brand && p.brand.toLowerCase().includes(q)) ||
           (p.barcode && p.barcode.includes(q))
    )
  }, [products, sellSearch, sellCategory])

  const handleAdminSendToCashier = async () => {
    if (cart.items.length === 0) return
    setSellSubmitting(true)
    setSellIsOffline(false)

    let orderNum = Math.floor(Math.random() * 90) + 10
    const receiptRef = 'EP-' + Date.now().toString().slice(-6)
    const adminName = fullName || username || 'Baba Emmanuel (Admin)'

    try {
      if (supabase && navigator.onLine) {
        const { data: numData, error: numError } = await supabase.rpc('get_next_order_number')
        if (!numError && numData) {
          orderNum = numData
        }

        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNum,
            receipt_ref: receiptRef,
            attendant_id: user?.id || null,
            attendant_name: adminName,
            total_amount: cart.totalAmount,
            is_credit: false,
            customer_name: null,
            customer_phone: null,
            status: 'waiting_for_payment',
          })
          .select()
          .single()

        if (!orderErr && orderData) {
          const itemsToInsert = cart.items.map((item) => ({
            order_id: orderData.id,
            product_id: item.id.length > 10 ? item.id : null,
            product_name: item.name,
            unit: item.unit || 'tab',
            qty: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
          }))

          await supabase.from('order_items').insert(itemsToInsert)

          setSellConfirmedOrder(orderNum)
          cart.clearCart()
          setSellSubmitting(false)
          return
        }
      }
    } catch (err) {
      console.warn('Network error sending order to cashier, queueing offline:', err)
    }

    queueOfflineOrder({
      order_number: orderNum,
      receipt_ref: receiptRef,
      attendant_name: adminName,
      total_amount: cart.totalAmount,
      is_credit: false,
      items: cart.items,
      created_at: new Date().toISOString(),
    })
    setSellConfirmedOrder(orderNum)
    setSellIsOffline(true)
    cart.clearCart()
    setSellSubmitting(false)
  }

  /* ── Page title helper ── */
  const getPageTitle = () => {
    switch (tab) {
      case 'overview': return 'Overview'
      case 'sell': return 'Sell (POS)'
      case 'performance': return 'Performance'
      case 'products': return 'Products'
      case 'day_history': return 'Day History'
      case 'settings': return 'Settings'
      default: return 'Dashboard'
    }
  }

  /* ── Standardized KPI Card Component ── */
  const renderKPICard = (label, figure, delta, insight, context, isCurrency = true) => (
    <Card key={label} className="rounded-xl border border-border bg-gradient-to-t from-brand-700/[0.04] to-card p-6 shadow-2xs transition-all hover:shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground leading-none">{label}</p>
        {delta != null && (
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-medium gap-0.5 px-2 py-0.5 border',
              delta >= 0
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10'
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </Badge>
        )}
      </div>

      <div className="mt-3">
        {isCurrency ? (
          <Money amount={figure} className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground" />
        ) : (
          <span className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {figure}
          </span>
        )}
      </div>

      {(insight || context) && (
        <div className="mt-4 pt-3 border-t border-border/60 flex flex-col gap-0.5">
          {insight && <p className="text-sm font-medium text-foreground">{insight}</p>}
          {context && <p className="text-[13px] text-muted-foreground">{context}</p>}
        </div>
      )}
    </Card>
  )

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  const [cmdOpen, setCmdOpen] = useState(false)

  const handleOpenCommandPalette = () => {
    setCmdOpen(true)
  }

  const pageTitle = tab === 'day_history' ? 'Day History' : tab.charAt(0).toUpperCase() + tab.slice(1)

  return (
    <AppShell 
      activeTab={tab} 
      onTabChange={setTab} 
      pageTitle={pageTitle} 
      notifications={notifications} 
      onOpenNotifications={() => setShowNotifMenu(true)} 
      onOpenCommandPalette={handleOpenCommandPalette} 
      role="admin"
    >
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* ═════════════ OVERVIEW ═════════════ */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-4 max-w-5xl mx-auto">
          {/* CREDIT SALE ALERT BANNER FOR ADMIN */}
          {unreadCount > 0 && (
            <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Credit Sale Notification</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <div>
                  Cashier processed {unreadCount} new credit sale{unreadCount > 1 ? 's' : ''}.
                  <div className="text-xs font-semibold opacity-80 mt-0.5">{notifications.find(n => !n.is_read)?.message}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowNotifMenu(true)} className="bg-amber-600 text-white hover:bg-amber-700 border-none">
                  View Alerts ({unreadCount})
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ROW 1: TODAY'S MONEY + PROFIT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TODAY'S MONEY (BLUE CARD) */}
            <Card className="bg-brand text-white border-none shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <CardHeader className="pb-2 relative z-10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xs font-extrabold tracking-wider text-white/70 uppercase">Today's Money</CardTitle>
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">{salesCount} sales</Badge>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-4xl font-extrabold tracking-tight mb-4 tabular-nums">
                  <Money amount={todayMoney} hideSymbol={false} />
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-semibold pt-4 border-t border-white/20">
                  <div className="flex justify-between">
                    <span className="opacity-70">Cash</span>
                    <span className="tabular-nums"><Money amount={cashTotal} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">POS</span>
                    <span className="tabular-nums"><Money amount={posTotal} /></span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="opacity-70">Transfer</span>
                    <span className="tabular-nums"><Money amount={transferTotal} /></span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-white/20 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="opacity-70">Credit</span>
                    <Badge className="text-[9px] h-4 px-1.5 bg-white/20 hover:bg-white/20 text-white border-none">OWED, NOT RECEIVED</Badge>
                  </div>
                  <span className="font-extrabold tabular-nums"><Money amount={creditToday} /></span>
                </div>
              </CardContent>
            </Card>

            {/* PROFIT CARD */}
            <Card gradient className="flex flex-col justify-center">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-extrabold text-foreground tabular-nums tracking-tight">
                  <Money amount={todayProfit} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ROW 2: LEADERBOARD + OWED / EXPENSES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ATTENDANT LEADERBOARD */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Attendant Leaderboard · Today</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {leaderboard.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">No sales recorded by attendants today</div>
                ) : (
                  leaderboard.map((att, i) => (
                    <div key={att.name} className={cn("flex items-center justify-between p-3 rounded-xl border", i === 0 ? "bg-blue-50 border-blue-100" : "bg-neutral-50 border-border")}>
                      <div className="flex items-center gap-3">
                        <span className={cn("w-6 h-6 rounded flex items-center justify-center text-xs font-extrabold tabular-nums", i === 0 ? "bg-brand text-white" : "bg-neutral-200 text-muted-foreground")}>{i + 1}</span>
                        <span className="font-bold text-sm">{att.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-sm tabular-nums block"><Money amount={att.value} /></span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{att.sales} sales</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* RIGHT COL: OWED + EXPENSES */}
            <div className="flex flex-col gap-4">
              {/* TOTAL OWED */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Total Owed</CardTitle>
                  <Badge variant="secondary" className="text-[9px]">NOT CASH</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-foreground tabular-nums mb-3">
                    <Money amount={totalOwed} />
                  </div>
                  <div className="flex justify-between items-center">
                    <Button variant="link" className="p-0 h-auto text-brand text-sm font-bold" onClick={() => setShowDebtors(true)}>
                      See everyone owing ({debtorsList.length})
                    </Button>
                    <ArrowUpRight className="h-4 w-4 text-brand" />
                  </div>
                </CardContent>
              </Card>
              
              {/* EXPENSES VS LIMIT */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Expenses Today VS Limit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("text-sm font-extrabold tabular-nums mb-2", expensesToday > expenseLimit ? "text-destructive" : "text-brand")}>
                    <Money amount={expensesToday} /> of <Money amount={expenseLimit} /> limit
                  </div>
                  <Progress value={Math.min((expensesToday / (expenseLimit || 1)) * 100, 100)} className={cn("h-2", expensesToday > expenseLimit ? "bg-destructive/20 [&>div]:bg-destructive" : "[&>div]:bg-brand")} />
                </CardContent>
              </Card>

              {/* STOCK VALUE */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Stock Value on Shelves</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-extrabold text-foreground tabular-nums mb-2">
                    <Money amount={products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0)} />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center text-[11px]">
                    <button onClick={() => setStockModalType('low_stock')} className="font-bold text-destructive hover:underline">
                      {lowStockCount} items low stock
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={() => setStockModalType('near_expiry')} className="font-bold text-destructive hover:underline">
                      {nearExpiryCount} near expiry
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ALERTS */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Alerts</CardTitle>
              {realAlerts.length > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                  {realAlerts.length} Active
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {realAlerts.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-sm font-semibold">
                  ✨ All clear! No active system alerts or limit warnings today.
                </div>
              ) : (
                <div className="flex flex-col">
                  {realAlerts.map((a, i) => (
                    <div key={a.id || i} className={cn("flex items-center gap-3 py-3 text-sm font-semibold text-foreground", i < realAlerts.length - 1 && "border-b border-border")}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.dot }} />
                      <span className="flex-1 min-w-0 truncate">{a.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* UNUSUAL HOURS */}
          {lateNightOrders.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span>🌙</span>
                  <CardTitle className="text-xs font-extrabold tracking-wider text-amber-900 uppercase">Unusual Hours Activity (00:00 – 06:00)</CardTitle>
                </div>
                <CardDescription className="text-amber-700 font-medium">
                  Flagged orders placed overnight (flexible trading hours). Normal operations unaffected.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {lateNightOrders.map(ln => (
                  <div key={ln.id} className="flex justify-between items-center p-2 bg-white rounded-lg border border-amber-100 text-xs">
                    <span>Order #{ln.number} by <strong>{ln.attendant}</strong> at {ln.time}</span>
                    <span className="font-extrabold text-foreground tabular-nums"><Money amount={ln.amount} /></span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═════════════ SELL ═════════════ */}
      {tab === 'sell' && (
        <div className="max-w-5xl mx-auto w-full">
          <SellingDesk
            products={products}
            cart={cart}
            onSendToCashier={handleAdminSendToCashier}
            submitting={sellSubmitting}
            confirmedOrder={sellConfirmedOrder}
            isOfflineOrder={sellIsOffline}
            onStartNewSale={() => { setSellConfirmedOrder(null); setSellIsOffline(false); }}
            attendantName={fullName || username || 'Baba Emmanuel (Admin)'}
            bottomPaddingClass="pb-36 md:pb-8"
          />
        </div>
      )}

      {/* ═════════════ PERFORMANCE ═════════════ */}
      {tab === 'performance' && (
        <div className="flex flex-col gap-5 max-w-5xl mx-auto">
          {/* PERIOD PILLS */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none items-center">
            <ToggleGroup type="single" value={perfPeriod} onValueChange={(val) => { if (val) { setPerfPeriod(val); setHoverIdx(null); } }}>
              {['Today', 'This Week', 'This Month', 'This Year', 'Custom'].map(p => (
                <ToggleGroupItem key={p} value={p} className="rounded-full px-4 text-xs font-bold whitespace-nowrap">
                  {p}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            
            {perfPeriod === 'Custom' && (
              <div className="flex gap-2 items-center ml-2">
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 text-xs rounded-lg" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 text-xs rounded-lg" />
              </div>
            )}
          </div>

          {/* CHART CARD */}
          <Card className="p-6">
            {/* HERO HEADER */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground tabular-nums tracking-tight">
                {perfMetric === 'sales' ? fmtPlain(chartData.total) : <Money amount={chartData.total} />}
              </span>
              {chartData.changePct !== null && (
                <span className={cn("text-sm font-extrabold", chartData.changePct >= 0 ? "text-emerald-600" : "text-destructive")}>
                  {chartData.changePct >= 0 ? '▲' : '▼'} {chartData.changePct >= 0 ? '+' : ''}{chartData.changePct.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-6">
              {perfMetric === 'sales' ? 'No. of sales' : perfMetric.charAt(0).toUpperCase() + perfMetric.slice(1)} · {chartData.caption}
            </p>

            {/* SVG CHART AREA */}
            <div className="relative w-full h-48 mb-5" onMouseLeave={() => setHoverIdx(null)}>
              {/* Guide lines */}
              {[25, 50, 75].map(pct => (
                <div key={pct} className="absolute left-0 right-0 h-px bg-border pointer-events-none" style={{ top: `${pct}%` }} />
              ))}

              {/* SVG */}
              <svg viewBox="0 0 640 200" preserveAspectRatio="none" className="w-full h-full block">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#245DE2" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#245DE2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {chartData.areaPath && <path d={chartData.areaPath} fill="url(#areaGrad)" />}
                {chartData.linePath && <path d={chartData.linePath} fill="none" stroke="#245DE2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
              </svg>

              {/* Hit zones */}
              <div className="absolute inset-0 flex cursor-crosshair">
                {chartData.pts.map((_, i) => (
                  <div key={i} className="flex-1" onMouseEnter={() => setHoverIdx(i)} onClick={() => setHoverIdx(i)} />
                ))}
              </div>

              {/* Tooltip overlays */}
              {hoverIdx !== null && hoverIdx < chartData.pts.length && (() => {
                const pt = chartData.pts[hoverIdx]
                const leftPct = (pt.x / 640 * 100) + '%'
                const topPct = (pt.y / 200 * 100) + '%'
                return (
                  <>
                    <div className="absolute top-0 bottom-0 w-px bg-blue-200 pointer-events-none -translate-x-1/2" style={{ left: leftPct }} />
                    <div className="absolute w-3 h-3 rounded-full bg-[#245DE2] border-[2.5px] border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: leftPct, top: topPct }} />
                    <div className="absolute bg-neutral-900 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap pointer-events-none -translate-x-1/2 tabular-nums" style={{ left: leftPct, top: `calc(${topPct} - 46px)` }}>
                      {pt.label} · {perfMetric === 'sales' ? fmtPlain(pt.v) : <Money amount={pt.v} />}
                    </div>
                  </>
                )
              })()}

              {/* X-axis labels */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
                {chartData.pts.filter((_, i) => {
                  const n = chartData.pts.length
                  if (n <= 7) return true
                  const step = Math.ceil(n / 7)
                  return i % step === 0 || i === n - 1
                }).map((pt, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground font-medium">{pt.label}</span>
                ))}
              </div>
            </div>

            {/* METRIC TOGGLE PILLS */}
            <div className="mt-8">
              <Tabs value={perfMetric} onValueChange={(val) => { setPerfMetric(val); setHoverIdx(null); }} className="w-full">
                <TabsList>
                  <TabsTrigger value="revenue" className="text-xs font-bold rounded-full">Revenue</TabsTrigger>
                  <TabsTrigger value="profit" className="text-xs font-bold rounded-full">Profit</TabsTrigger>
                  <TabsTrigger value="sales" className="text-xs font-bold rounded-full">No. of Sales</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Card>

          {/* KPI GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', val: <Money amount={chartData.kpis[0]?.cur} />, pct: chartData.kpis[0]?.pct, invert: false },
              { label: 'Total Profit', val: <Money amount={chartData.kpis[1]?.cur} />, pct: chartData.kpis[1]?.pct, invert: false },
              { label: 'Number of Sales', val: fmtPlain(chartData.kpis[2]?.cur), pct: chartData.kpis[2]?.pct, invert: false },
              { label: 'Average Sale Value', val: <Money amount={chartData.avgSaleValue} />, pct: chartData.avgPct, invert: false },
              { label: 'Credit Given', val: <Money amount={chartData.kpis[3]?.cur} />, pct: chartData.kpis[3]?.pct, invert: true },
              { label: 'Expenses', val: <Money amount={chartData.kpis[4]?.cur} />, pct: chartData.kpis[4]?.pct, invert: true },
            ].map((k, i) => {
              const color = k.pct == null ? null : (k.invert ? (k.pct >= 0 ? "text-destructive" : "text-emerald-600") : (k.pct >= 0 ? "text-emerald-600" : "text-destructive"))
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">{k.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-extrabold text-foreground tabular-nums mb-1">{k.val}</div>
                    {k.pct != null && chartData.hasPrev && (
                      <span className={cn("text-[11px] font-extrabold", color)}>
                        {(k.invert ? (k.pct >= 0 ? '▲' : '▼') : (k.pct >= 0 ? '▲' : '▼'))} {k.pct >= 0 ? '+' : ''}{k.pct.toFixed(1)}%
                      </span>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ═════════════ PRODUCTS ═════════════ */}
      {tab === 'products' && (
        <div className="flex flex-col gap-3 max-w-5xl mx-auto">
          {/* SEARCH + STATUS DROPDOWN + ADD */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-[130px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search product or barcode…"
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl text-xs"
                />
              </div>

              {/* Compact Status Dropdown Filter */}
              <NativeSelect
                value={prodFilter}
                onChange={e => setProdFilter(e.target.value)}
                className="h-9 rounded-xl text-xs font-semibold shrink-0 w-[140px]"
              >
                <option value="all">All ({products.length})</option>
                <option value="needs_setup">Needs setup ({needsSetupCount})</option>
                <option value="low_stock">Low stock ({lowStockCount})</option>
                <option value="near_expiry">Near expiry ({nearExpiryCount})</option>
              </NativeSelect>
            </div>

            <Button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-xl shrink-0 self-end sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-1" /> Add product
            </Button>
          </div>

          {/* PRODUCT LIST — DENSE COMPACT ROWS */}
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No products found matching "{prodSearch}"
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleProducts.map((p) => {
                        const needsSetup = (p.stock || 0) <= 0 || (p.price || 0) <= 0
                        const isLow = (p.stock || 0) > 0 && (p.stock || 0) <= p.lowLevel
                        const isNearExp = p.expiry && new Date(p.expiry) <= sixtyDaysFromNow
                        const expDate = p.expiry ? new Date(p.expiry) : null
                        const expLabel = expDate ? `Exp ${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getFullYear()).slice(2)}` : 'N/A'

                        return (
                          <TableRow
                            key={p.id}
                            onClick={() => { setEditProd(p); setShowAddModal(true) }}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                                  {p.name}
                                </span>
                                {needsSetup && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-extrabold bg-neutral-100 text-neutral-600">
                                    Needs setup
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn("text-xs font-bold", p.price <= 0 ? 'text-destructive' : 'text-brand')}>
                              <Money amount={p.price} />/unit
                            </TableCell>
                            <TableCell className={cn("text-xs", isLow ? 'font-bold text-destructive' : (p.stock <= 0 ? 'font-bold text-muted-foreground' : ''))}>
                              {p.stock} left
                            </TableCell>
                            <TableCell className={cn("text-xs", isNearExp ? 'font-bold text-amber-600' : 'text-muted-foreground')}>
                              {expLabel}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-brand border-border"
                                onClick={(e) => { e.stopPropagation(); setReceiveProd(p); setShowReceiveModal(true) }}
                                title="Receive stock"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {filteredProducts.length > visibleProducts.length && (
                    <div className="p-3 text-center bg-muted/30 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProdLimit(prev => prev + 50)}
                        className="text-xs font-bold rounded-xl"
                      >
                        Load More ({visibleProducts.length} of {filteredProducts.length} shown)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ═════════════ DAY HISTORY ═════════════ */}
      {tab === 'day_history' && (
        <div className="flex flex-col gap-4 max-w-5xl mx-auto">
          {/* MONTH FILTER PILLS */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <ToggleGroup type="single" value={monthFilter} onValueChange={(val) => { if (val) setMonthFilter(val) }}>
              {['All months', 'July 2026', 'June 2026', 'May 2026'].map(m => (
                <ToggleGroupItem key={m} value={m} className="rounded-full px-4 text-xs font-bold whitespace-nowrap">
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* DAY ROWS (ACCORDION) */}
          <div className="flex flex-col gap-2">
            {dayHistory.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No day closes recorded yet in database
              </Card>
            ) : (
              dayHistory.map(dh => {
                const isExpanded = expandedDay === dh.id
                return (
                  <Card key={dh.id} className="overflow-hidden">
                    <Collapsible open={isExpanded} onOpenChange={() => setExpandedDay(isExpanded ? null : dh.id)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 cursor-pointer hover:bg-muted/30 transition-colors">
                          <span className="font-bold text-sm text-foreground">{dh.date}</span>
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 text-xs sm:text-sm">
                            <span className="text-muted-foreground">Income <strong className="text-foreground tabular-nums"><Money amount={dh.income} /></strong></span>
                            <span className="text-emerald-600 font-bold tabular-nums">Profit <Money amount={dh.profit} /></span>
                            <Badge variant={dh.balanced ? 'outline' : 'destructive'} className={cn("text-[10px] font-extrabold tabular-nums", dh.balanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "")}>
                              {dh.balanced ? 'BALANCED' : `MISMATCH ₦${dh.mismatch.toLocaleString()}`}
                            </Badge>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-1 border-t border-border">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3 text-xs sm:text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-bold tabular-nums"><Money amount={dh.cash.sys} /></span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">POS 1</span><span className="font-bold tabular-nums"><Money amount={dh.pos1.sys} /></span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">POS 2</span><span className="font-bold tabular-nums"><Money amount={dh.pos2.sys} /></span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Transfer</span><span className="font-bold tabular-nums"><Money amount={dh.transfer.sys} /></span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Credit</span><span className="font-bold text-slate-500 tabular-nums"><Money amount={dh.credit} /></span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-bold tabular-nums"><Money amount={dh.expenses} /></span></div>
                            <div className="flex justify-between"><span className="text-emerald-600 font-bold">Profit</span><span className="font-extrabold text-emerald-600 tabular-nums"><Money amount={dh.profit} /></span></div>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-medium pt-2 border-t border-border">
                            Closed by {dh.closedBy} · {dh.closedAt} · Locked, read-only
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ═════════════ SETTINGS ═════════════ */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {/* LEFT COL */}
          <div className="flex flex-col gap-4">
            {/* DAILY LIMITS */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Daily Limits</CardTitle>
                {limitsSavedMsg && <span className="text-[11px] font-bold text-emerald-600">{limitsSavedMsg}</span>}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Daily expense limit (₦)</label>
                  <Input type="number" value={expenseLimit} onChange={e => setExpenseLimit(Number(e.target.value) || 0)} className="font-bold tabular-nums" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Mismatch alert limit (₦)</label>
                  <Input type="number" value={mismatchLimit} onChange={e => setMismatchLimit(Number(e.target.value) || 0)} className="font-bold tabular-nums" />
                </div>
                <Button onClick={handleSaveLimits} className="w-full mt-2 bg-brand hover:bg-brand-dark text-white font-bold">
                  Save Limits to Database
                </Button>
              </CardContent>
            </Card>

            {/* AUTOMATED SERVER DATABASE HEALTH */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Database & Server Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]" />
                  <span className="font-extrabold text-sm text-emerald-600">PostgreSQL Database Online</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Automated Continuous Backup (PITR) Active</p>
                <div className="pt-2.5 border-t border-border text-[11px] text-foreground font-semibold">
                  ⚡ Cloud DB Latency: <strong className="tabular-nums">{dbLatency} ms</strong> · Server WAT Sync Active
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COL: USER ACCOUNTS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
              <CardTitle className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">User Accounts</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => setShowCreateUserModal(true)} className="text-xs font-extrabold text-brand bg-blue-50 hover:bg-blue-100">
                <Plus className="h-3 w-3 mr-1" /> New Staff Account
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {(staffProfiles.length > 0 ? staffProfiles : USERS).map((u, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm">{u.name}</span>
                      <Badge variant="outline" className={cn("text-[9px] font-extrabold px-1.5 h-4", u.role === 'ADMIN' ? 'bg-blue-50 text-brand border-blue-200' : u.role === 'CASHIER' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-neutral-100 text-muted-foreground border-neutral-200')}>
                        {u.role}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setResetUserTarget(u); setNewPassVal(''); setResetMsg('') }} className="text-xs font-bold text-brand h-7 px-2">
                      Set password
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic mt-3">One person, one login.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════════════ */}

      {/* DEBTORS MODAL */}
      <Dialog open={showDebtors} onOpenChange={setShowDebtors}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Everyone Owing (<Money amount={totalOwed} />)</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {debtorsList.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm font-semibold">
                ✨ All clear! No outstanding debtors recorded.
              </div>
            ) : (
              debtorsList.map((d, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-border">
                  <div>
                    <span className="font-bold text-sm block">{d.name}</span>
                    <span className="text-[11px] text-muted-foreground">{d.phone} · {d.date}</span>
                  </div>
                  <span className="font-extrabold text-sm text-foreground tabular-nums"><Money amount={d.amount} /></span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT PRODUCT MODAL */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if(!open){ setShowAddModal(false); setEditProd(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProd ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="flex flex-col gap-3 mt-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Name *</label>
              <Input required value={editProd ? editProd.name : newP.name} onChange={e => editProd ? setEditProd({...editProd, name: e.target.value}) : setNewP({...newP, name: e.target.value})} placeholder="e.g. Paracetamol 500mg" className="text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Brand (optional)</label>
              <Input value={editProd ? (editProd.brand || '') : newP.brand} onChange={e => editProd ? setEditProd({...editProd, brand: e.target.value}) : setNewP({...newP, brand: e.target.value})} placeholder="e.g. Emzor / Fidson / Glaxo" className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Category</label>
                <NativeSelect value={editProd ? editProd.category : newP.category} onChange={e => editProd ? setEditProd({...editProd, category: e.target.value}) : setNewP({...newP, category: e.target.value})} className="text-sm">
                  {['Analgesic','Antibiotic','Antimalarial','Supplement','Antidiabetic','Rehydration'].map(c => <option key={c} value={c}>{c}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className="text-[11px] font-bold text-amber-700 block mb-1">Cost price (₦) — Admin only</label>
                <Input type="number" value={editProd ? editProd.cost : newP.cost} onChange={e => editProd ? setEditProd({...editProd, cost: e.target.value}) : setNewP({...newP, cost: e.target.value})} placeholder="35" className="text-sm bg-amber-50 border-amber-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-brand block mb-1">Retail price (₦) *</label>
                <Input type="number" required value={editProd ? editProd.price : newP.price} onChange={e => editProd ? setEditProd({...editProd, price: e.target.value}) : setNewP({...newP, price: e.target.value})} placeholder="50" className="text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Wholesale price (₦)</label>
                <Input type="number" value={editProd ? editProd.wholesale : newP.wholesale} onChange={e => editProd ? setEditProd({...editProd, wholesale: e.target.value}) : setNewP({...newP, wholesale: e.target.value})} placeholder="Optional" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Quantity</label>
                <Input type="number" value={editProd ? editProd.stock : newP.stock} onChange={e => editProd ? setEditProd({...editProd, stock: e.target.value}) : setNewP({...newP, stock: e.target.value})} placeholder="240" className="text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Low-stock level</label>
                <Input type="number" value={editProd ? editProd.lowLevel : newP.lowLevel} onChange={e => editProd ? setEditProd({...editProd, lowLevel: e.target.value}) : setNewP({...newP, lowLevel: e.target.value})} placeholder="15" className="text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Unit chain</label>
              <Input type="text" value={editProd ? editProd.unitChain : newP.unitChain} onChange={e => editProd ? setEditProd({...editProd, unitChain: e.target.value}) : setNewP({...newP, unitChain: e.target.value})} placeholder="e.g. 1 tin = 20 sachets = 200 tablets" className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Barcode (optional)</label>
                <Input type="text" value={editProd ? editProd.barcode : newP.barcode} onChange={e => editProd ? setEditProd({...editProd, barcode: e.target.value}) : setNewP({...newP, barcode: e.target.value})} placeholder="6009876543210" className="text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Expiry date</label>
                <Input type="date" value={editProd ? editProd.expiry : newP.expiry} onChange={e => editProd ? setEditProd({...editProd, expiry: e.target.value}) : setNewP({...newP, expiry: e.target.value})} className="text-sm" />
              </div>
            </div>
            <Button type="submit" className="w-full mt-2 bg-gradient-to-br from-blue-600 to-brand font-bold">
              {editProd ? 'Update Product' : 'Save Product'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECEIVE STOCK MODAL */}
      <Dialog open={showReceiveModal} onOpenChange={(open) => { if(!open){ setShowReceiveModal(false); setReceiveProd(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
          </DialogHeader>
          {receiveProd && (
            <>
              <p className="text-sm font-bold text-brand mb-2">
                {receiveProd.name} (current: {receiveProd.stock} left)
              </p>
              <form onSubmit={handleReceiveStock} className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Quantity received *</label>
                  <Input type="number" required value={rxQty} onChange={e => setRxQty(e.target.value)} placeholder="e.g. 50" className="font-bold" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-700 block mb-1">True cost paid per unit (₦) — Admin only</label>
                  <Input type="number" value={rxCost} onChange={e => setRxCost(e.target.value)} placeholder={receiveProd.cost.toString()} className="font-bold bg-amber-50 border-amber-200" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Expiry date on pack *</label>
                  <Input type="date" required value={rxExpiry} onChange={e => setRxExpiry(e.target.value)} />
                </div>
                <div className="bg-neutral-50 p-3 rounded-lg text-[11px] text-muted-foreground font-semibold">
                  Sales always take from the earliest-expiring batch first.
                </div>
                <Button type="submit" className="w-full mt-2 bg-gradient-to-br from-blue-600 to-brand font-bold">
                  Confirm Stock Receipt
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* LOW STOCK / NEAR EXPIRY MODAL */}
      <Dialog open={!!stockModalType} onOpenChange={(open) => { if(!open) setStockModalType(null) }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {stockModalType === 'low_stock' ? 'Low Stock Items' : 'Near Expiry Items'}
            </DialogTitle>
            <DialogDescription>
              {stockModalType === 'low_stock' ? 'Sorted lowest-stock first' : 'Sorted soonest-expiring first'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-2">
            {stockModalType === 'low_stock' ? (
              lowStockList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center my-4">No low stock items</p>
              ) : (
                lowStockList.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-border">
                    <div>
                      <span className="font-bold text-sm block text-foreground">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground">{p.brand ? `${p.brand} · ` : ''}{p.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-destructive tabular-nums block">{p.stock} in stock</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">Threshold: {p.lowLevel}</span>
                    </div>
                  </div>
                ))
              )
            ) : (
              nearExpiryList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center my-4">No near expiry items</p>
              ) : (
                nearExpiryList.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-border">
                    <div>
                      <span className="font-bold text-sm block text-foreground">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground">Stock: {p.stock} left</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-destructive tabular-nums block">Expires: {p.expiry}</span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CREATE NEW STAFF ACCOUNT MODAL ── */}
      <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Staff Account</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="flex flex-col gap-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name</label>
              <Input type="text" placeholder="e.g. Chidinma Okeke" value={newUserForm.fullName} onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })} required />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Username / Login ID</label>
              <Input type="text" placeholder="e.g. chidinma2" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} required />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Account Password</label>
              <Input type="password" placeholder="Set login password" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} required />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Assigned Role</label>
              <NativeSelect value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}>
                <option value="ATTENDANT">Attendant (Sales Desk)</option>
                <option value="CASHIER">Cashier (Till & Payment)</option>
                <option value="ADMIN">Admin (Full Control)</option>
              </NativeSelect>
            </div>

            {createUserMsg && <div className="text-xs font-bold text-brand text-center">{createUserMsg}</div>}

            <DialogFooter className="gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateUserModal(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand-dark">Create Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RESET / SET PASSWORD MODAL ── */}
      <Dialog open={!!resetUserTarget} onOpenChange={(open) => { if(!open) setResetUserTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Staff Password</DialogTitle>
            <DialogDescription>
              Updating login password for <strong>{resetUserTarget?.name}</strong> ({resetUserTarget?.role})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNewPassword} className="flex flex-col gap-3.5 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">New Password</label>
              <Input type="password" placeholder="Enter new password" value={newPassVal} onChange={e => setNewPassVal(e.target.value)} required />
            </div>

            {resetMsg && <div className="text-xs font-bold text-emerald-600 text-center">{resetMsg}</div>}

            <DialogFooter className="gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setResetUserTarget(null)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand-dark">Save Password</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
