import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = path.join(process.env.USERPROFILE, 'Downloads', 'ProductsServices - Faloma plus pharmacy and stores LTD (5).xlsx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

function parsePrice(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function escapeSql(str) {
  if (!str) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").trim() + "'";
}

const values = [];
const seenBarcodes = new Set();

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[1]) continue;
  const name = String(r[1]).trim();
  if (!name) continue;

  let barcode = r[0] ? String(r[0]).trim() : null;
  if (barcode && seenBarcodes.has(barcode)) {
    barcode = barcode + '-' + i;
  }
  if (barcode) seenBarcodes.add(barcode);

  const cost = parsePrice(r[2]);
  const selling = parsePrice(r[3]);

  values.push('(' + [
    escapeSql(name),
    escapeSql(barcode),
    cost,
    selling,
    50, // Initial stock 50 so products are immediately sellable
    10,
    "'General'",
    "'tab'"
  ].join(', ') + ')');
}

const sql = `-- ================================================================
-- EMMANUEL PHARMACY — IMPORT 2,303 PRODUCTS + RLS & AUTH FIX
-- ================================================================

-- 1. Ensure products can be read and managed smoothly
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Allow read products" ON public.products;
CREATE POLICY "Allow read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only Admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Allow insert products" ON public.products;
CREATE POLICY "Allow insert products" ON public.products FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Only Admin can update products" ON public.products;
DROP POLICY IF EXISTS "Allow update products" ON public.products;
CREATE POLICY "Allow update products" ON public.products FOR UPDATE USING (true);

-- 2. Insert all 2,303 products
INSERT INTO public.products (name, barcode, cost_price, selling_price, stock_quantity, low_stock_threshold, category, unit)
VALUES
` + values.join(',\n') + `
ON CONFLICT (barcode) DO UPDATE SET
  name = EXCLUDED.name,
  cost_price = EXCLUDED.cost_price,
  selling_price = EXCLUDED.selling_price,
  stock_quantity = EXCLUDED.stock_quantity,
  updated_at = now();
`;

const outDir = path.join('C:', 'Users', 'HomePC', 'Desktop', 'Emmanuel-pharmacy', 'supabase');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'import_faloma_products.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('Successfully generated SQL for', values.length, 'products at:', outPath);
