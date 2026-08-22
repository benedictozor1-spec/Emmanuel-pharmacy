import React from 'react'

export function formatMoney(amount) {
  const num = Number(amount) || 0
  return '₦' + Math.round(num).toLocaleString('en-NG')
}

export default function Money({ amount = 0, className = '', prefix = '', suffix = '', hideSymbol = false }) {
  const num = Number(amount) || 0
  const formattedNum = Math.round(num).toLocaleString('en-NG')

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{!hideSymbol && '₦'}{formattedNum}{suffix}
    </span>
  )
}
