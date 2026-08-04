import React, { useState, useEffect, useCallback } from 'react'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Package,
  CalendarDays,
  Settings,
  Search,
} from 'lucide-react'

export default function CommandPalette({ open, onOpenChange, onNavigate, products = [] }) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const pages = [
    { key: 'overview', label: 'Go to Overview', icon: LayoutDashboard },
    { key: 'sell', label: 'New Sale', icon: ShoppingCart },
    { key: 'performance', label: 'Go to Performance', icon: TrendingUp },
    { key: 'products', label: 'Go to Products', icon: Package },
    { key: 'dayhistory', label: 'Go to Day History', icon: CalendarDays },
    { key: 'settings', label: 'Go to Settings', icon: Settings },
  ]

  const filteredProducts = search.length >= 2
    ? products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
      />

      {/* Command dialog */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg px-4">
        <Command
          className="rounded-2xl border bg-popover shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center border-b px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search products, navigate pages…"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              onClick={() => onOpenChange(false)}
              className="ml-2 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-muted cursor-pointer"
            >
              ESC
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 custom-scroll">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
              {pages.filter(p =>
                !search || p.label.toLowerCase().includes(search.toLowerCase())
              ).map(page => {
                const Icon = page.icon
                return (
                  <Command.Item
                    key={page.key}
                    onSelect={() => {
                      onNavigate(page.key)
                      onOpenChange(false)
                    }}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer aria-selected:bg-[#F0F4FE] dark:aria-selected:bg-[#1F45B8]/20 aria-selected:text-[#1F45B8] dark:aria-selected:text-[#9CB6F3] transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-60" />
                    {page.label}
                  </Command.Item>
                )
              })}
            </Command.Group>

            {/* Products */}
            {filteredProducts.length > 0 && (
              <Command.Group heading="Products" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground mt-1">
                {filteredProducts.map(product => (
                  <Command.Item
                    key={product.id}
                    onSelect={() => {
                      onNavigate('sell')
                      onOpenChange(false)
                    }}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer aria-selected:bg-[#F0F4FE] dark:aria-selected:bg-[#1F45B8]/20 aria-selected:text-[#1F45B8] dark:aria-selected:text-[#9CB6F3] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {product.generic_name || product.category || ''}
                      </p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {product.stock_quantity ?? 0} in stock
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
