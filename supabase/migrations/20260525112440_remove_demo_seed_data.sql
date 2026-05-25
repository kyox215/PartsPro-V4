-- Remove all previously seeded/demo PartsPro data and demo/test auth users.
-- This migration is intentionally scoped to known seed UUIDs, known seed
-- order numbers/SKUs, and obvious non-production demo/test email patterns.

do $$
declare
  v_demo_order_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000401'::uuid,
    '00000000-0000-4000-8000-000000000402'::uuid,
    '00000000-0000-4000-8000-000000000403'::uuid
  ];
  v_demo_order_line_ids uuid[] := array[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '11111111-1111-4111-8111-111111111112'::uuid,
    '11111111-1111-4111-8111-111111111113'::uuid,
    '11111111-1111-4111-8111-111111111114'::uuid
  ];
  v_demo_customer_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ];
  v_demo_product_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid,
    '00000000-0000-4000-8000-000000000105'::uuid,
    '00000000-0000-4000-8000-000000000106'::uuid,
    '00000000-0000-4000-8000-000000000107'::uuid,
    '00000000-0000-4000-8000-000000000108'::uuid
  ];
  v_demo_inventory_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000201'::uuid,
    '00000000-0000-4000-8000-000000000202'::uuid,
    '00000000-0000-4000-8000-000000000203'::uuid
  ];
begin
  delete from public.rma_requests
  where order_line_id = any(v_demo_order_line_ids)
     or order_no in ('ORD-2026-0565', 'ORD-2026-0566', 'ORD-2026-0567')
     or user_id in (
       select id
       from auth.users
       where lower(coalesce(email, '')) in (
         'codex-smoke-test@example.com',
         'codex-direct-no-return@example.com'
       )
          or lower(coalesce(email, '')) like '%@example.com'
          or lower(coalesce(email, '')) like '%demo%'
       );

  delete from public.order_events
  where order_id = any(v_demo_order_ids)
     or metadata ->> 'source' = 'seed';

  delete from public.order_lines
  where id = any(v_demo_order_line_ids)
     or order_id = any(v_demo_order_ids);

  delete from public.orders
  where id = any(v_demo_order_ids)
     or order_no in ('ORD-2026-0565', 'ORD-2026-0566', 'ORD-2026-0567')
     or customer_note = 'Seed order'
     or fiscal ->> 'purchase_order_number' like 'PO-DEMO-%';

  delete from public.inventory_items
  where id = any(v_demo_inventory_ids)
     or sku_code in (
       'IP13P-OLED-A+',
       'SAM-S21-BAT',
       'IP12-LCD-INC',
       'USB-C-DOCK',
       'IP11-CAM',
       'PXR-LCD',
       'HON90-FLEX',
       'OPPO-X5-COVER'
     );

  delete from public.products
  where id = any(v_demo_product_ids)
     or sku_code in (
       'IP13P-OLED-A+',
       'SAM-S21-BAT',
       'IP12-LCD-INC',
       'USB-C-DOCK',
       'IP11-CAM',
       'PXR-LCD',
       'HON90-FLEX',
       'OPPO-X5-COVER'
     );

  delete from public.customers
  where id = any(v_demo_customer_ids)
     or company_name in ('RiparaMi S.r.l.', 'TechFix Roma')
     or email in ('amministrazione@riparami.it', 'admin@techfixroma.it')
     or pec in ('amministrazione@riparami.pec.it', 'techfixroma@pec.it');

  delete from public.b2b_applications
  where lower(coalesce(email, '')) in (
      'codex-smoke-test@example.com',
      'codex-direct-no-return@example.com'
    )
     or lower(coalesce(email, '')) like '%@example.com'
     or lower(coalesce(email, '')) like '%demo%'
     or lower(coalesce(company_name, '')) like '%demo%';

  delete from public.profiles
  where id in (
    select id
    from auth.users
    where lower(coalesce(email, '')) in (
      'codex-smoke-test@example.com',
      'codex-direct-no-return@example.com'
    )
       or lower(coalesce(email, '')) like '%@example.com'
       or lower(coalesce(email, '')) like '%demo%'
  )
     or lower(coalesce(email, '')) like '%demo%'
     or lower(coalesce(email, '')) like '%@example.com';

  delete from auth.users
  where lower(coalesce(email, '')) in (
      'codex-smoke-test@example.com',
      'codex-direct-no-return@example.com'
    )
     or lower(coalesce(email, '')) like '%@example.com'
     or lower(coalesce(email, '')) like '%demo%';

  delete from public.price_groups
  where id in ('standard', 'pro', 'partner');
end $$;
