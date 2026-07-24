-- ============================================
-- Emmanuel Pharmacy — Real Initial Inventory Seed (016)
-- Populates essential real pharmacy medications into public.products
-- ============================================

INSERT INTO public.products (name, brand, category, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, barcode)
SELECT * FROM (VALUES
  ('Paracetamol 500mg', 'Emzor', 'Analgesic', 30.00, 50.00, 250, 20, '2027-08-31'::date, '890123456701'),
  ('Amoxicillin 500mg', 'Fidson', 'Antibiotics', 85.00, 120.00, 150, 15, '2026-11-30'::date, '890123456702'),
  ('Artemether / Lumefantrine (Coartem)', 'Novartis', 'Anti-Malaria', 1250.00, 1800.00, 80, 10, '2027-05-31'::date, '890123456703'),
  ('Vitamin C 1000mg', 'Emzor', 'Vitamins', 18.00, 30.00, 400, 30, '2027-12-31'::date, '890123456704'),
  ('Ciprofloxacin 500mg', 'Swiss Pharma', 'Antibiotics', 320.00, 500.00, 60, 10, '2026-10-31'::date, '890123456705'),
  ('Omeprazole 20mg', 'M&B', 'Antacid / Ulcer', 280.00, 450.00, 95, 15, '2027-04-30'::date, '890123456706'),
  ('Metformin 500mg', 'Swiss Pharma', 'Diabetes Care', 55.00, 90.00, 180, 20, '2027-09-30'::date, '890123456707'),
  ('Metronidazole (Flagyl) 200mg', 'May & Baker', 'Antibiotics', 40.00, 70.00, 210, 25, '2026-12-31'::date, '890123456708'),
  ('ORS (Oral Rehydration Salts)', 'Generic', 'First Aid / Fluids', 65.00, 100.00, 130, 20, '2028-01-31'::date, '890123456709'),
  ('Ibuprofen 400mg', 'Emzor', 'Analgesic', 45.00, 80.00, 160, 20, '2027-07-31'::date, '890123456710'),
  ('Augmentin 625mg', 'GSK', 'Antibiotics', 3800.00, 5200.00, 35, 8, '2026-09-30'::date, '890123456711'),
  ('Diclofenac Potassium 50mg', 'M&B', 'Analgesic', 70.00, 120.00, 140, 15, '2027-06-30'::date, '890123456712'),
  ('Paracetamol Syrup 60ml', 'Emzor', 'Pediatrics', 350.00, 550.00, 75, 10, '2027-03-31'::date, '890123456713'),
  ('Multivitamin Syrup 100ml', 'Fidson', 'Pediatrics / Vitamins', 600.00, 950.00, 50, 10, '2027-05-31'::date, '890123456714'),
  ('Ventolin Inhaler 100mcg', 'GSK', 'Respiratory Care', 4200.00, 5800.00, 25, 5, '2027-11-30'::date, '890123456715')
) AS v(name, brand, category, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, barcode)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products WHERE public.products.name = v.name OR (v.barcode IS NOT NULL AND public.products.barcode = v.barcode)
);
