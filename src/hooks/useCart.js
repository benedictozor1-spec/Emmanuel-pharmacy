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
      if (existingIndex > -1) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
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
