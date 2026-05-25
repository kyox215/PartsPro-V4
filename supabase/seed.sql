-- Seed data for local Supabase resets. It avoids auth-owned rows so it can run
-- in a fresh project without pre-created auth.users records.

insert into public.price_groups (id, name, description, discount_percent)
values
  ('standard', 'Standard', 'Default B2B price group', 0),
  ('pro', 'Pro', 'Approved repair shop price group', 8),
  ('partner', 'Partner', 'High-volume distributor price group', 15)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  discount_percent = excluded.discount_percent,
  updated_at = now();

insert into public.products (
  id,
  sku_code,
  name,
  brand,
  model,
  model_code,
  model_codes,
  category,
  quality_grade,
  stock_status,
  moq,
  cost_price,
  retail_price,
  b2b_price,
  warranty_days,
  stock_qty,
  location,
  compatibility_models,
  highlights,
  tier_prices,
  status
)
values
  ('00000000-0000-4000-8000-000000000101', 'IP13P-OLED-A+', 'Display OLED iPhone 13 Pro', 'Apple', 'iPhone 13 Pro', 'A2638', array['iPhone 13 Pro'], 'Schermi', 'A+', 'in_stock', 1, 32.00, 62.90, 45.90, 180, 25, 'Milano', array['iPhone 13 Pro'], array['OLED', 'True Tone', 'Wholesale'], '[{"group":"pro","price":42.50},{"group":"partner","price":39.90}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000102', 'SAM-S21-BAT', 'Batteria Samsung Galaxy S21', 'Samsung', 'Galaxy S21', 'G991', array['Galaxy S21'], 'Batterie', 'A', 'low_stock', 2, 18.20, 39.90, 28.50, 180, 18, 'Milano', array['Galaxy S21'], array['OEM', 'Alta capacita'], '[{"group":"pro","price":26.90},{"group":"partner","price":25.40}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000103', 'IP12-LCD-INC', 'Display LCD compatibile iPhone 12', 'Apple', 'iPhone 12', 'A2403', array['iPhone 12', 'iPhone 12 Pro'], 'Schermi', 'B', 'out_of_stock', 1, 16.40, 34.90, 26.00, 90, 0, 'Roma', array['iPhone 12', 'iPhone 12 Pro'], array['Compatibile', 'Economy'], '[{"group":"pro","price":24.20},{"group":"partner","price":22.80}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000104', 'USB-C-DOCK', 'Scheda connettore USB-C', 'Xiaomi', 'Redmi Note 12', '22111317G', array['Redmi Note 12', 'Poco F5'], 'Connettori', 'A+', 'in_stock', 5, 2.40, 8.90, 4.80, 180, 50, 'Milano', array['Redmi Note 12', 'Poco F5'], array['USB-C', 'Fast moving'], '[{"group":"pro","price":4.40},{"group":"partner","price":4.10}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000105', 'IP11-CAM', 'Modulo fotocamera iPhone 11', 'Apple', 'iPhone 11', 'A2221', array['iPhone 11'], 'Fotocamere', 'A', 'in_stock', 1, 11.50, 29.00, 19.00, 180, 12, 'Roma', array['iPhone 11'], array['OEM pull', 'Testato'], '[{"group":"pro","price":17.50},{"group":"partner","price":16.80}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000106', 'PXR-LCD', 'Display Pixel 8 ricondizionato', 'Google', 'Pixel 8', 'GKWS6', array['Pixel 8'], 'Schermi', 'Refurbished', 'low_stock', 1, 21.00, 44.90, 31.20, 90, 3, 'Milano', array['Pixel 8'], array['Ricondizionato', 'QC passato'], '[{"group":"pro","price":29.40},{"group":"partner","price":27.90}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000107', 'HON90-FLEX', 'Flat cable principale Honor 90', 'Honor', 'Honor 90', 'REA-NX9', array['Honor 90'], 'Flat Cable', 'A', 'in_stock', 3, 3.90, 12.50, 7.40, 180, 36, 'Milano', array['Honor 90'], array['Compatibile', 'Alta rotazione'], '[{"group":"pro","price":6.90},{"group":"partner","price":6.50}]'::jsonb, 'active'),
  ('00000000-0000-4000-8000-000000000108', 'OPPO-X5-COVER', 'Back cover Oppo Find X5', 'Oppo', 'Find X5', 'CPH2307', array['Find X5'], 'Back Cover', 'A+', 'in_stock', 2, 7.80, 21.50, 12.90, 180, 22, 'Roma', array['Find X5'], array['Nero', 'Vetro'], '[{"group":"pro","price":11.90},{"group":"partner","price":11.20}]'::jsonb, 'active')
on conflict (sku_code) do update
set
  name = excluded.name,
  brand = excluded.brand,
  model = excluded.model,
  model_code = excluded.model_code,
  model_codes = excluded.model_codes,
  category = excluded.category,
  quality_grade = excluded.quality_grade,
  stock_status = excluded.stock_status,
  moq = excluded.moq,
  retail_price = excluded.retail_price,
  b2b_price = excluded.b2b_price,
  warranty_days = excluded.warranty_days,
  stock_qty = excluded.stock_qty,
  location = excluded.location,
  compatibility_models = excluded.compatibility_models,
  highlights = excluded.highlights,
  tier_prices = excluded.tier_prices,
  status = excluded.status,
  updated_at = now();

insert into public.inventory_items (
  id,
  sku_code,
  product_name,
  brand,
  model,
  quality_grade,
  batch_code,
  location,
  actual_qty,
  available_qty,
  supplier
)
values
  ('00000000-0000-4000-8000-000000000201', 'IP13P-OLED-A+', 'Display OLED iPhone 13 Pro', 'Apple', 'iPhone 13 Pro', 'A+', 'BATCH-2605-MI-01', 'Milano', 25, 25, 'Mobilax'),
  ('00000000-0000-4000-8000-000000000202', 'SAM-S21-BAT', 'Batteria Samsung Galaxy S21', 'Samsung', 'Galaxy S21', 'A', 'BATCH-2605-MI-02', 'Milano', 18, 18, 'PartsPro EU'),
  ('00000000-0000-4000-8000-000000000203', 'USB-C-DOCK', 'Scheda connettore USB-C', 'Xiaomi', 'Redmi Note 12', 'A+', 'BATCH-2605-MI-03', 'Milano', 50, 50, 'PartsPro CN')
on conflict (id) do update
set
  actual_qty = excluded.actual_qty,
  available_qty = excluded.available_qty,
  last_movement_at = now();

insert into public.customers (
  id,
  company_name,
  contact_name,
  email,
  vat_number,
  fiscal_code,
  sdi,
  pec,
  phone,
  registered_address,
  billing_address,
  shipping_address,
  tier,
  price_group_id,
  status,
  monthly_purchase,
  orders_count,
  revenue,
  credit_limit,
  payment_terms,
  profile_completed_at
)
values
  ('00000000-0000-4000-8000-000000000301', 'RiparaMi S.r.l.', 'Marco Bianchi', 'amministrazione@riparami.it', 'IT12345678901', '12345678901', 'M5UXCR1', 'amministrazione@riparami.pec.it', '+39 02 1234567', 'Via Torino 24, 20123 Milano MI', 'Via Torino 24, 20123 Milano MI', 'Via Torino 24, 20123 Milano MI', 'pro', 'pro', 'active', '2500-5000', 2, 401.92, 5000, 'Bonifico 30 giorni', now()),
  ('00000000-0000-4000-8000-000000000302', 'TechFix Roma', 'Giulia Rossi', 'admin@techfixroma.it', 'IT09876543210', '09876543210', '0000000', 'techfixroma@pec.it', '+39 06 7654321', 'Via Appia 18, 00179 Roma RM', 'Via Appia 18, 00179 Roma RM', 'Via Appia 18, 00179 Roma RM', 'standard', 'standard', 'pending', '1000-2500', 1, 82.96, 1500, 'Bonifico anticipato', null)
on conflict (id) do update
set
  company_name = excluded.company_name,
  contact_name = excluded.contact_name,
  email = excluded.email,
  vat_number = excluded.vat_number,
  fiscal_code = excluded.fiscal_code,
  sdi = excluded.sdi,
  pec = excluded.pec,
  phone = excluded.phone,
  registered_address = excluded.registered_address,
  billing_address = excluded.billing_address,
  shipping_address = excluded.shipping_address,
  tier = excluded.tier,
  price_group_id = excluded.price_group_id,
  status = excluded.status,
  monthly_purchase = excluded.monthly_purchase,
  orders_count = excluded.orders_count,
  revenue = excluded.revenue,
  credit_limit = excluded.credit_limit,
  payment_terms = excluded.payment_terms,
  updated_at = now();

insert into public.orders (
  id,
  order_no,
  customer_id,
  customer_name,
  customer_tier,
  status,
  payment_status,
  stock_risk,
  total_net,
  vat,
  shipping,
  shipping_method,
  fiscal,
  delivery_address,
  customer_note,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000401', 'ORD-2026-0567', '00000000-0000-4000-8000-000000000301', 'RiparaMi S.r.l.', 'pro', 'picking', 'paid', 'low', 220.18, 48.44, 16.00, 'GLS/BRT 24-48h', '{"payment_method":"bank_transfer","purchase_order_number":"PO-DEMO-2026-0567"}'::jsonb, 'Via Torino 24, 20123 Milano MI, IT', 'Seed order', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000402', 'ORD-2026-0566', '00000000-0000-4000-8000-000000000301', 'RiparaMi S.r.l.', 'pro', 'shipped', 'paid', 'clear', 96.15, 21.15, 0.00, 'GLS/BRT 24-48h', '{"payment_method":"agreed_terms","purchase_order_number":"PO-DEMO-2026-0566"}'::jsonb, 'Via Torino 24, 20123 Milano MI, IT', 'Seed order', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000403', 'ORD-2026-0565', '00000000-0000-4000-8000-000000000302', 'TechFix Roma', 'standard', 'submitted', 'pending', 'clear', 68.00, 14.96, 0.00, 'GLS/BRT 24-48h', '{"payment_method":"bank_transfer","purchase_order_number":"PO-DEMO-2026-0565"}'::jsonb, 'Via Appia 18, 00179 Roma RM, IT', 'Seed order', now() - interval '3 days')
on conflict (order_no) do update
set
  status = excluded.status,
  payment_status = excluded.payment_status,
  stock_risk = excluded.stock_risk,
  total_net = excluded.total_net,
  vat = excluded.vat,
  shipping = excluded.shipping,
  fiscal = excluded.fiscal,
  delivery_address = excluded.delivery_address,
  updated_at = now();

insert into public.order_lines (
  id,
  order_id,
  sku_code,
  product_name,
  quality_grade,
  quantity,
  unit_price,
  stock_status,
  location
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000402', 'IP13P-OLED-A+', 'Display OLED iPhone 13 Pro', 'A+', 2, 45.90, 'in_stock', 'Milano'),
  ('11111111-1111-4111-8111-111111111112', '00000000-0000-4000-8000-000000000402', 'SAM-S21-BAT', 'Batteria Samsung Galaxy S21', 'A', 1, 28.50, 'low_stock', 'Milano'),
  ('11111111-1111-4111-8111-111111111113', '00000000-0000-4000-8000-000000000401', 'USB-C-DOCK', 'Scheda connettore USB-C', 'A+', 8, 4.80, 'in_stock', 'Milano'),
  ('11111111-1111-4111-8111-111111111114', '00000000-0000-4000-8000-000000000401', 'PXR-LCD', 'Display Pixel 8 ricondizionato', 'Refurbished', 3, 31.20, 'low_stock', 'Milano')
on conflict (id) do update
set
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  stock_status = excluded.stock_status,
  location = excluded.location;

insert into public.order_events (order_id, event_type, to_status, note, metadata, created_at)
values
  ('00000000-0000-4000-8000-000000000402', 'created', 'submitted', 'Seed order created', '{"source":"seed"}'::jsonb, now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000402', 'shipped', 'shipped', 'Seed order shipped', '{"carrier":"GLS"}'::jsonb, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000401', 'created', 'submitted', 'Seed order created', '{"source":"seed"}'::jsonb, now() - interval '1 day')
on conflict do nothing;
