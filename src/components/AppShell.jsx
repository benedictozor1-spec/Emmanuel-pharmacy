import React, { useState, useEffect, createContext, useContext } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from './theme-provider'
import SyncStatusBadge from './SyncStatusBadge'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet'
import { cn } from '../lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Package,
  CalendarDays,
  Settings,
  Users,
  HelpCircle,
  LogOut,
  Bell,
  Search,
  PanelLeft,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  MoreHorizontal,
  Plus,
} from 'lucide-react'

/* ─── Sidebar collapse context ─── */
const SidebarContext = createContext({ collapsed: false, setCollapsed: () => {} })
export function useSidebar() { return useContext(SidebarContext) }

/* ─── Nav items ─── */
const STORE_NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'sell', label: 'Sell', icon: ShoppingCart },
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'dayhistory', label: 'Day History', icon: CalendarDays },
]

const SYSTEM_NAV = [
  { key: 'settings', label: 'Settings', icon: Settings },
]

const MOBILE_NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'sell', label: 'Sell', icon: ShoppingCart },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'more', label: 'More', icon: MoreHorizontal },
]

/* ─── AppShell ─── */
export default function AppShell({
  children,
  activeTab,
  onTabChange,
  pageTitle = '',
  notifications = [],
  onOpenNotifications,
  onOpenCommandPalette,
  role = 'admin',
}) {
  const { logout, username, fullName, profile } = useAuth()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  /* ─── Keyboard shortcut ⌘K ─── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandPalette?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenCommandPalette])

  const initials = (fullName || username || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const handleNav = (key) => {
    if (key === 'more') {
      setMoreOpen(true)
      return
    }
    onTabChange?.(key)
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-screen w-full overflow-hidden bg-background">

        {/* ═══════════════════════════════════════════
            DESKTOP SIDEBAR — hidden below lg
            ═══════════════════════════════════════════ */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r bg-card transition-all duration-200 shrink-0',
            collapsed ? 'w-[68px]' : 'w-[240px]'
          )}
        >
          {/* Logo header */}
          <div className={cn('flex items-center gap-3 px-4 h-14 border-b shrink-0', collapsed && 'justify-center px-2')}>
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#1F45B8] text-white text-xs font-bold shrink-0">
              EP
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">Emmanuel Pharmacy</p>
                <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
              </div>
            )}
          </div>

          {/* Quick action */}
          <div className={cn('px-3 py-3 shrink-0', collapsed && 'px-2')}>
            <div className="flex items-center gap-1.5">
              <Button
                size={collapsed ? 'icon' : 'default'}
                className="w-full bg-brand-700 hover:bg-brand-800 text-white shadow-xs"
                onClick={() => onTabChange?.('sell')}
                aria-label="New Sale"
              >
                <Plus className="h-4 w-4" />
                {!collapsed && <span className="font-medium">New Sale</span>}
              </Button>
              {!collapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-foreground relative"
                  onClick={onOpenNotifications}
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute 1 top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-background" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Navigation groups */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 custom-scroll" aria-label="Main navigation">
            {/* Store group */}
            {!collapsed && (
              <p className="px-2 pt-2 pb-1 text-[12px] font-medium text-muted-foreground">Store</p>
            )}
            {STORE_NAV.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer my-0.5',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-l-2 border-l-brand-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )
            })}

            {/* System group */}
            <Separator className="my-2" />
            {!collapsed && (
              <p className="px-2 pt-2 pb-1 text-[12px] font-medium text-muted-foreground">System</p>
            )}
            {SYSTEM_NAV.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer my-0.5',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-l-2 border-l-brand-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* Footer — avatar + user */}
          <div className="border-t p-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer',
                    collapsed && 'justify-center px-1.5'
                  )}
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#F0F4FE] dark:bg-[#1F45B8]/20 text-[#1F45B8] dark:text-[#9CB6F3] text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-semibold text-foreground truncate">{fullName || username}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
                    </div>
                  )}
                  {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs font-semibold">{fullName || username}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px]">Theme</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4 mr-2" /> Light {theme === 'light' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4 mr-2" /> Dark {theme === 'dark' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="h-4 w-4 mr-2" /> System {theme === 'system' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════
            MAIN AREA
            ═══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* STICKY TOP HEADER — h-14 */}
          <header className="sticky top-0 z-40 flex items-center h-14 px-4 lg:px-6 border-b bg-background/95 backdrop-blur-md shrink-0 gap-3">
            {/* Sidebar trigger — desktop only */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="hidden lg:block h-5" />

            {/* Page title / breadcrumb */}
            <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">{pageTitle}</h1>

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              <SyncStatusBadge />

              {/* Search trigger */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex gap-1.5 text-muted-foreground font-normal"
                onClick={onOpenCommandPalette}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">Search…</span>
                <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative"
                onClick={onOpenNotifications}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </Button>

              {/* Mobile search trigger */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="sm:hidden"
                onClick={onOpenCommandPalette}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden w-full min-w-0">
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
              {children}
            </div>
          </main>

          {/* ═══════════════════════════════════════════
              MOBILE BOTTOM NAV — visible below lg
              ═══════════════════════════════════════════ */}
          <nav
            className="lg:hidden flex items-center justify-around h-14 border-t bg-background/95 backdrop-blur-md shrink-0"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Mobile navigation"
          >
            {MOBILE_NAV.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 cursor-pointer transition-colors',
                    isActive
                      ? 'text-brand-700 dark:text-brand-300 font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'fill-current')} strokeWidth={isActive ? 2.2 : 1.5} />
                  <span className={cn('text-[11px]', isActive ? 'font-medium' : 'font-normal')}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* ═══════════════════════════════════════════
            MOBILE "MORE" SHEET
            ═══════════════════════════════════════════ */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {[
                { key: 'dayhistory', label: 'Day History', icon: CalendarDays },
                { key: 'settings', label: 'Settings', icon: Settings },
              ].map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    onClick={() => { handleNav(item.key); setMoreOpen(false) }}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {item.label}
                  </button>
                )
              })}

              <Separator className="my-3" />

              {/* Theme toggle */}
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Theme</p>
                <div className="flex gap-2">
                  {[
                    { val: 'light', icon: Sun, label: 'Light' },
                    { val: 'dark', icon: Moon, label: 'Dark' },
                    { val: 'system', icon: Monitor, label: 'System' },
                  ].map(t => {
                    const TIcon = t.icon
                    return (
                      <button
                        key={t.val}
                        onClick={() => setTheme(t.val)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                          theme === t.val
                            ? 'bg-[#F0F4FE] dark:bg-[#1F45B8]/20 text-[#1F45B8] dark:text-[#9CB6F3]'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <TIcon className="h-4 w-4" />
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Separator className="my-3" />

              {/* User info + sign out */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-[#F0F4FE] dark:bg-[#1F45B8]/20 text-[#1F45B8] dark:text-[#9CB6F3] text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{fullName || username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role}</p>
                </div>
              </div>

              <button
                onClick={() => { setMoreOpen(false); logout() }}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </SidebarContext.Provider>
  )
}
