import { useState, useEffect, useCallback } from 'react'

export function useCart() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('ep_attendant_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ep_attendant_cart', JSON.stringify(items))
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e)
    }
  }, [items])

  const addItem = useCallback((product) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id)
      const maxStock = product.stock_quantity !== undefined ? Number(product.stock_quantity) : undefined
      if (maxStock !== undefined && maxStock <= 0) {
        return prev // Cannot add out of stock item
      }
      if (existingIndex > -1) {
        const item = prev[existingIndex]
        const effectiveMax = maxStock !== undefined ? maxStock : item.stock_quantity
        if (effectiveMax !== undefined && item.quantity >= effectiveMax) {
          return prev // Reached stock limit
        }
        const updated = [...prev]
        updated[existingIndex] = {
          ...item,
          quantity: item.quantity + 1,
          stock_quantity: effectiveMax,
        }
        return updated
      } else {
        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            brand: product.brand,
            unit: product.unit || 'tab',
            selling_price: Number(product.selling_price),
            stock_quantity: maxStock,
            quantity: 1,
          },
        ]
      }
    })
  }, [])

  const updateQuantity = useCallback((productId, delta) => {
    setItems((prev) => {
      return prev
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta
            if (delta > 0 && item.stock_quantity !== undefined && newQty > item.stock_quantity) {
              return item // Reached stock ceiling
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null
          }
          return item
        })
        .filter(Boolean)
    })
  }, [])

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    try {
      localStorage.removeItem('ep_attendant_cart')
    } catch (e) {}
  }, [])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.selling_price * item.quantity, 0)

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalItems,
    totalAmount,
  }
}
