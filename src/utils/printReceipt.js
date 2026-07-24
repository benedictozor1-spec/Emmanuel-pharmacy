/**
 * Bulletproof Thermal POS Receipt Printing Utility
 * Spawns an isolated hidden iframe containing ONLY the receipt HTML so no background UI can ever leak into the print preview.
 */
export const printThermalReceipt = (receiptElementId) => {
  const receiptEl = document.getElementById(receiptElementId)
  if (!receiptEl) {
    window.print()
    return
  }

  // Remove any previous print iframe if existing
  const existingFrame = document.getElementById('thermal-print-iframe')
  if (existingFrame) {
    existingFrame.remove()
  }

  // Create isolated print iframe
  const iframe = document.createElement('iframe')
  iframe.id = 'thermal-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <base href="${window.location.origin}">
        <title>Thermal Receipt</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 8px;
            width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            box-sizing: border-box;
          }
          img {
            max-height: 54px;
            max-width: 100%;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px;
          }
          /* Preserve flexbox layout inside thermal print frame */
          div[style*="display: flex"], div[style*="display:flex"] {
            display: flex !important;
            justify-content: space-between !important;
          }
          div, p, span, h2 {
            color: #000000 !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 80mm; margin: 0 auto; background: white; padding: 4px;">
          ${receiptEl.innerHTML}
        </div>
      </body>
    </html>
  `)
  doc.close()

  // Wait for images inside iframe to load before printing
  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch (e) {
      console.error('Print iframe error:', e)
      window.print()
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe)
        }
      }, 2000)
    }
  }, 300)
}
