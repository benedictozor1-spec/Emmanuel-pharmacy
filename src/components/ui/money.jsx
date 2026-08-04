import React from 'react'

const ngnFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

export function formatMoney(amount) {
  const num = Number(amount) || 0
  return ngnFormatter.format(num)
}

export default function Money({ amount = 0, className = '', prefix = '', suffix = '' }) {
  const formatted = formatMoney(amount)

  return (
    <span className={`tabular-nums tracking-tight ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
