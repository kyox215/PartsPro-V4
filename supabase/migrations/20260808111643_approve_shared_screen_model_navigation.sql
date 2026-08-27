-- Owner-approved shared-screen navigation batch from
-- docs/audits/2026-08-08-stocked-shared-screen-compatibility-review.csv.
-- Compatibility-only: 20 active Schermi products, 47 approved relations,
-- 47 canonical device identities. Inventory/product identity and commercial
-- fields are immutable. The three not_common ledger rows are intentionally
-- outside this migration.

set local statement_timeout = '30s';

do $$
declare
  v_target_count integer;
  v_supplier_count integer;
  v_batch_count integer;
  v_existing_relation_count integer;
begin
  with product_seed(
    sku_code,
    supplier_code,
    batch_code,
    expected_name,
    evidence_source,
    approved_models,
    stock_available,
    stock_actual,
    stock_locked
  ) as (
    values
      ('3000000290613', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Honor X7b/90 Smart Black', 'current_catalog_title', array['X7b', '90 Smart']::text[], 2, 2, 0),
      ('3000000133569', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Motorola Moto E32/Moto E32S Black', 'current_catalog_title', array['Moto E32', 'Moto E32S']::text[], 2, 2, 0),
      ('3000000093078', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen OPPO A16 4G/A16s/A54s CPH2271 CPH2269 CPH2273 Black', 'supplier_arrival_title', array['A16 4G', 'A16s', 'A54s']::text[], 3, 3, 0),
      ('3000000094204', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen OPPO A53s 2020/A53 4G 2020 CPH2139 / CPH2135 / CPH2127 Black', 'current_catalog_title', array['A53s 2020', 'A53 4G 2020']::text[], 2, 2, 0),
      ('3000000167175', 'MOBILAX', 'CVQY8D5SA8O', 'OEM Display Touchscreen OPPO A57 (CPH2387)/A57s 4G (CPH2385) Black', 'supplier_arrival_title', array['A57', 'A57s 4G']::text[], 5, 5, 0),
      ('3000000396674', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen Realme C71/P3 Lite 4G Black', 'supplier_arrival_title', array['C71', 'P3 Lite 4G']::text[], 2, 2, 0),
      ('3000000037713', 'MOBILAX', 'C9NS2AL2YZ1', 'Oled Display Touchscreen Samsung Galaxy J4 Plus J415/Galaxy J6 Plus J610 Black', 'current_catalog_title', array['Galaxy J4 Plus', 'Galaxy J6 Plus']::text[], 1, 1, 0),
      ('3000000321355', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen TCL 405/406/408/406s Black', 'current_catalog_title', array['405', '406', '408', '406s']::text[], 2, 2, 0),
      ('3000000096819', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y21s/Y21 Black', 'current_catalog_title', array['Y21s', 'Y21']::text[], 2, 2, 0),
      ('3000000325322', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y28s 5G/Y03 Black', 'current_catalog_title', array['Y28s 5G', 'Y03']::text[], 2, 2, 0),
      ('3000000383971', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y29s 5G/Y04 Black', 'current_catalog_title', array['Y29s 5G', 'Y04']::text[], 1, 1, 0),
      ('3000000147177', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen with Frame Xiaomi Poco M4 Pro 5G/Redmi Note 11T 5G Black', 'current_catalog_title', array['Poco M4 Pro 5G', 'Redmi Note 11T 5G']::text[], 2, 2, 0),
      ('3000000270240', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black', 'owner_statement_and_current_catalog_title', array['Poco C65', 'Redmi 13C']::text[], 4, 5, 1),
      ('3000000153703', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 10C/Poco C40', 'current_catalog_title', array['Redmi 10C', 'Poco C40']::text[], 5, 5, 0),
      ('3000000334393', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 14C/Poco C75 Black', 'current_catalog_title', array['Redmi 14C', 'Poco C75']::text[], 5, 5, 0),
      ('3000000039113', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi Note 9S/Redmi Note 9 Pro 4G Black', 'current_catalog_title', array['Redmi Note 9S', 'Redmi Note 9 Pro 4G']::text[], 2, 2, 0),
      ('3000000412534', 'MOBILAX', 'C9NS2AL2YZ1', 'Original Pulled Display Touchscreen Xiaomi Redmi 15C 4G/Poco C85 4G Version International Black', 'current_catalog_title', array['Redmi 15C 4G', 'Poco C85 4G']::text[], 2, 2, 0),
      ('PP-HON-X8B-200L-X8C-ORG-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'Original LCD Display Honor X8B / Honor 200 Lite / Honor X8C', 'current_catalog_title', array['X8B', '200 Lite', 'X8C']::text[], 2, 2, 0),
      ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT OPPO Find X5 Lite / OPPO Reno 8 5G / Realme Narzo 60 / Narzo 60X Black', 'current_catalog_title', array['Find X5 Lite', 'Reno 8 5G', 'Narzo 60', 'Narzo 60X']::text[], 3, 3, 0),
      ('PP-XIA-RN10-RN10S-M5S-TFT-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT Xiaomi Redmi Note 10 4G / Redmi Note 10S / Poco M5S', 'current_catalog_title', array['Redmi Note 10 4G', 'Redmi Note 10S', 'Poco M5S']::text[], 3, 3, 0)
  )
  select count(*) into v_target_count
  from public.products p
  join product_seed seed on seed.sku_code = p.sku_code;

  if v_target_count <> 20 then
    raise exception 'Expected exactly 20 approved target products, found %', v_target_count;
  end if;

  with product_seed(sku_code,supplier_code,batch_code,expected_name,evidence_source,approved_models,stock_available,stock_actual,stock_locked) as (
    values
      ('3000000290613', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Honor X7b/90 Smart Black', 'current_catalog_title', array['X7b', '90 Smart']::text[], 2, 2, 0),
      ('3000000133569', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Motorola Moto E32/Moto E32S Black', 'current_catalog_title', array['Moto E32', 'Moto E32S']::text[], 2, 2, 0),
      ('3000000093078', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen OPPO A16 4G/A16s/A54s CPH2271 CPH2269 CPH2273 Black', 'supplier_arrival_title', array['A16 4G', 'A16s', 'A54s']::text[], 3, 3, 0),
      ('3000000094204', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen OPPO A53s 2020/A53 4G 2020 CPH2139 / CPH2135 / CPH2127 Black', 'current_catalog_title', array['A53s 2020', 'A53 4G 2020']::text[], 2, 2, 0),
      ('3000000167175', 'MOBILAX', 'CVQY8D5SA8O', 'OEM Display Touchscreen OPPO A57 (CPH2387)/A57s 4G (CPH2385) Black', 'supplier_arrival_title', array['A57', 'A57s 4G']::text[], 5, 5, 0),
      ('3000000396674', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen Realme C71/P3 Lite 4G Black', 'supplier_arrival_title', array['C71', 'P3 Lite 4G']::text[], 2, 2, 0),
      ('3000000037713', 'MOBILAX', 'C9NS2AL2YZ1', 'Oled Display Touchscreen Samsung Galaxy J4 Plus J415/Galaxy J6 Plus J610 Black', 'current_catalog_title', array['Galaxy J4 Plus', 'Galaxy J6 Plus']::text[], 1, 1, 0),
      ('3000000321355', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen TCL 405/406/408/406s Black', 'current_catalog_title', array['405', '406', '408', '406s']::text[], 2, 2, 0),
      ('3000000096819', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y21s/Y21 Black', 'current_catalog_title', array['Y21s', 'Y21']::text[], 2, 2, 0),
      ('3000000325322', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y28s 5G/Y03 Black', 'current_catalog_title', array['Y28s 5G', 'Y03']::text[], 2, 2, 0),
      ('3000000383971', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y29s 5G/Y04 Black', 'current_catalog_title', array['Y29s 5G', 'Y04']::text[], 1, 1, 0),
      ('3000000147177', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen with Frame Xiaomi Poco M4 Pro 5G/Redmi Note 11T 5G Black', 'current_catalog_title', array['Poco M4 Pro 5G', 'Redmi Note 11T 5G']::text[], 2, 2, 0),
      ('3000000270240', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black', 'owner_statement_and_current_catalog_title', array['Poco C65', 'Redmi 13C']::text[], 4, 5, 1),
      ('3000000153703', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 10C/Poco C40', 'current_catalog_title', array['Redmi 10C', 'Poco C40']::text[], 5, 5, 0),
      ('3000000334393', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 14C/Poco C75 Black', 'current_catalog_title', array['Redmi 14C', 'Poco C75']::text[], 5, 5, 0),
      ('3000000039113', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi Note 9S/Redmi Note 9 Pro 4G Black', 'current_catalog_title', array['Redmi Note 9S', 'Redmi Note 9 Pro 4G']::text[], 2, 2, 0),
      ('3000000412534', 'MOBILAX', 'C9NS2AL2YZ1', 'Original Pulled Display Touchscreen Xiaomi Redmi 15C 4G/Poco C85 4G Version International Black', 'current_catalog_title', array['Redmi 15C 4G', 'Poco C85 4G']::text[], 2, 2, 0),
      ('PP-HON-X8B-200L-X8C-ORG-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'Original LCD Display Honor X8B / Honor 200 Lite / Honor X8C', 'current_catalog_title', array['X8B', '200 Lite', 'X8C']::text[], 2, 2, 0),
      ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT OPPO Find X5 Lite / OPPO Reno 8 5G / Realme Narzo 60 / Narzo 60X Black', 'current_catalog_title', array['Find X5 Lite', 'Reno 8 5G', 'Narzo 60', 'Narzo 60X']::text[], 3, 3, 0),
      ('PP-XIA-RN10-RN10S-M5S-TFT-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT Xiaomi Redmi Note 10 4G / Redmi Note 10S / Poco M5S', 'current_catalog_title', array['Redmi Note 10 4G', 'Redmi Note 10S', 'Poco M5S']::text[], 3, 3, 0)
  ), expected_suppliers as (
    select distinct supplier_code from product_seed
  )
  select count(*) into v_supplier_count
  from public.suppliers s
  join expected_suppliers e on e.supplier_code = s.code
  where s.status = 'active';

  if v_supplier_count <> 2 then
    raise exception 'Expected active MOBILAX and EXTERNAL suppliers, found %', v_supplier_count;
  end if;

  with batch_seed(supplier_code,batch_code) as (
    values
      ('MOBILAX','C9NS2AL2YZ1'),
      ('MOBILAX','CVBLUQU8H23'),
      ('MOBILAX','CVQY8D5SA8O'),
      ('EXTERNAL','WECHAT-20260618-A0646')
  )
  select count(*) into v_batch_count
  from batch_seed b
  join public.suppliers s on s.code = b.supplier_code
  join public.supplier_batches sb on sb.supplier_id = s.id and sb.batch_code = b.batch_code;

  if v_batch_count <> 4 then
    raise exception 'Expected four approved supplier batches, found %', v_batch_count;
  end if;

  with product_seed(sku_code,supplier_code,batch_code,expected_name,evidence_source,approved_models,stock_available,stock_actual,stock_locked) as (
    values
      ('3000000290613', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Honor X7b/90 Smart Black', 'current_catalog_title', array['X7b', '90 Smart']::text[], 2, 2, 0),
      ('3000000133569', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Motorola Moto E32/Moto E32S Black', 'current_catalog_title', array['Moto E32', 'Moto E32S']::text[], 2, 2, 0),
      ('3000000093078', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen OPPO A16 4G/A16s/A54s CPH2271 CPH2269 CPH2273 Black', 'supplier_arrival_title', array['A16 4G', 'A16s', 'A54s']::text[], 3, 3, 0),
      ('3000000094204', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen OPPO A53s 2020/A53 4G 2020 CPH2139 / CPH2135 / CPH2127 Black', 'current_catalog_title', array['A53s 2020', 'A53 4G 2020']::text[], 2, 2, 0),
      ('3000000167175', 'MOBILAX', 'CVQY8D5SA8O', 'OEM Display Touchscreen OPPO A57 (CPH2387)/A57s 4G (CPH2385) Black', 'supplier_arrival_title', array['A57', 'A57s 4G']::text[], 5, 5, 0),
      ('3000000396674', 'MOBILAX', 'CVBLUQU8H23', 'OEM Display Touchscreen Realme C71/P3 Lite 4G Black', 'supplier_arrival_title', array['C71', 'P3 Lite 4G']::text[], 2, 2, 0),
      ('3000000037713', 'MOBILAX', 'C9NS2AL2YZ1', 'Oled Display Touchscreen Samsung Galaxy J4 Plus J415/Galaxy J6 Plus J610 Black', 'current_catalog_title', array['Galaxy J4 Plus', 'Galaxy J6 Plus']::text[], 1, 1, 0),
      ('3000000321355', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen TCL 405/406/408/406s Black', 'current_catalog_title', array['405', '406', '408', '406s']::text[], 2, 2, 0),
      ('3000000096819', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y21s/Y21 Black', 'current_catalog_title', array['Y21s', 'Y21']::text[], 2, 2, 0),
      ('3000000325322', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y28s 5G/Y03 Black', 'current_catalog_title', array['Y28s 5G', 'Y03']::text[], 2, 2, 0),
      ('3000000383971', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Vivo Y29s 5G/Y04 Black', 'current_catalog_title', array['Y29s 5G', 'Y04']::text[], 1, 1, 0),
      ('3000000147177', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen with Frame Xiaomi Poco M4 Pro 5G/Redmi Note 11T 5G Black', 'current_catalog_title', array['Poco M4 Pro 5G', 'Redmi Note 11T 5G']::text[], 2, 2, 0),
      ('3000000270240', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black', 'owner_statement_and_current_catalog_title', array['Poco C65', 'Redmi 13C']::text[], 4, 5, 1),
      ('3000000153703', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 10C/Poco C40', 'current_catalog_title', array['Redmi 10C', 'Poco C40']::text[], 5, 5, 0),
      ('3000000334393', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi 14C/Poco C75 Black', 'current_catalog_title', array['Redmi 14C', 'Poco C75']::text[], 5, 5, 0),
      ('3000000039113', 'MOBILAX', 'C9NS2AL2YZ1', 'OEM Display Touchscreen Xiaomi Redmi Note 9S/Redmi Note 9 Pro 4G Black', 'current_catalog_title', array['Redmi Note 9S', 'Redmi Note 9 Pro 4G']::text[], 2, 2, 0),
      ('3000000412534', 'MOBILAX', 'C9NS2AL2YZ1', 'Original Pulled Display Touchscreen Xiaomi Redmi 15C 4G/Poco C85 4G Version International Black', 'current_catalog_title', array['Redmi 15C 4G', 'Poco C85 4G']::text[], 2, 2, 0),
      ('PP-HON-X8B-200L-X8C-ORG-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'Original LCD Display Honor X8B / Honor 200 Lite / Honor X8C', 'current_catalog_title', array['X8B', '200 Lite', 'X8C']::text[], 2, 2, 0),
      ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT OPPO Find X5 Lite / OPPO Reno 8 5G / Realme Narzo 60 / Narzo 60X Black', 'current_catalog_title', array['Find X5 Lite', 'Reno 8 5G', 'Narzo 60', 'Narzo 60X']::text[], 3, 3, 0),
      ('PP-XIA-RN10-RN10S-M5S-TFT-LCD', 'EXTERNAL', 'WECHAT-20260618-A0646', 'LCD Display TFT Xiaomi Redmi Note 10 4G / Redmi Note 10S / Poco M5S', 'current_catalog_title', array['Redmi Note 10 4G', 'Redmi Note 10S', 'Poco M5S']::text[], 3, 3, 0)
  )
  select count(*) into v_target_count
  from product_seed seed
  left join public.products p on p.sku_code = seed.sku_code
  left join public.suppliers s on s.code = seed.supplier_code
  where p.id is null
     or p.name is distinct from seed.expected_name
     or p.status <> 'active'
     or p.category <> 'Schermi'
     or p.supplier is distinct from s.name
     or p.batch_code is distinct from seed.batch_code;

  if v_target_count <> 0 then
    raise exception 'Approved target product precondition failed for % rows', v_target_count;
  end if;

  with inventory as (
    select sku_code, count(*)::integer as row_count,
           sum(available_qty)::integer as available_qty,
           sum(actual_qty)::integer as actual_qty,
           sum(locked_qty)::integer as locked_qty
    from public.inventory_items
    group by sku_code
  ), expected(sku_code,stock_available,stock_actual,stock_locked) as (
    values
      ('3000000290613',2,2,0),('3000000133569',2,2,0),('3000000093078',3,3,0),
      ('3000000094204',2,2,0),('3000000167175',5,5,0),('3000000396674',2,2,0),
      ('3000000037713',1,1,0),('3000000321355',2,2,0),('3000000096819',2,2,0),
      ('3000000325322',2,2,0),('3000000383971',1,1,0),('3000000147177',2,2,0),
      ('3000000270240',4,5,1),('3000000153703',5,5,0),('3000000334393',5,5,0),
      ('3000000039113',2,2,0),('3000000412534',2,2,0),
      ('PP-HON-X8B-200L-X8C-ORG-LCD',2,2,0),
      ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK',3,3,0),
      ('PP-XIA-RN10-RN10S-M5S-TFT-LCD',3,3,0)
  )
  select count(*) into v_target_count
  from expected e
  left join inventory i using (sku_code)
  join public.products p using (sku_code)
  where i.row_count is distinct from 1
     or i.available_qty is distinct from e.stock_available
     or i.actual_qty is distinct from e.stock_actual
     or i.locked_qty is distinct from e.stock_locked
     or p.stock_qty is distinct from e.stock_available;

  if v_target_count <> 0 then
    raise exception 'Approved target inventory baseline failed for % rows', v_target_count;
  end if;

  select count(*) into v_existing_relation_count
  from public.product_device_compatibilities c
  join public.products p on p.id = c.product_id
  where p.sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175',
    '3000000396674','3000000037713','3000000321355','3000000096819','3000000325322',
    '3000000383971','3000000147177','3000000270240','3000000153703','3000000334393',
    '3000000039113','3000000412534','PP-HON-X8B-200L-X8C-ORG-LCD',
    'PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[]);

  if v_existing_relation_count > 47 then
    raise exception 'Unexpected pre-existing target compatibility rows: %', v_existing_relation_count;
  end if;

  if exists (
    select 1
    from public.product_device_compatibilities c
    join public.products p on p.id = c.product_id
    where p.sku_code = any(array[
      '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175',
      '3000000396674','3000000037713','3000000321355','3000000096819','3000000325322',
      '3000000383971','3000000147177','3000000270240','3000000153703','3000000334393',
      '3000000039113','3000000412534','PP-HON-X8B-200L-X8C-ORG-LCD',
      'PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
    ]::text[])
      and c.review_status <> 'approved'
  ) then
    raise exception 'Target compatibility state contains non-approved rows; rejected rows are never reopened';
  end if;
end;
$$;

-- Canonical navigation identities. Existing identities keep their canonical
-- name and status; aliases/codes are merged and series are filled only when
-- the existing row has no series value.
with relation_seed(sku_code,brand,canonical_name,normalized_key,aliases,model_codes) as (
  values
    ('3000000290613','Honor','X7b','x7b',array['X7B']::text[], '{}'::text[]),
    ('3000000290613','Honor','90 Smart','90-smart','{}'::text[], '{}'::text[]),
    ('3000000133569','Motorola','Moto E32','moto-e32','{}'::text[], '{}'::text[]),
    ('3000000133569','Motorola','Moto E32S','moto-e32s','{}'::text[], '{}'::text[]),
    ('3000000093078','OPPO','A16 4G','a16-4g','{}'::text[], array['CPH2271']::text[]),
    ('3000000093078','OPPO','A16s','a16s','{}'::text[], array['CPH2269']::text[]),
    ('3000000093078','OPPO','A54s','a54s','{}'::text[], array['CPH2273']::text[]),
    ('3000000094204','OPPO','A53s 2020','a53s-2020','{}'::text[], array['CPH2139']::text[]),
    ('3000000094204','OPPO','A53 4G 2020','a53-4g-2020','{}'::text[], array['CPH2135','CPH2127']::text[]),
    ('3000000167175','OPPO','A57','a57','{}'::text[], array['CPH2387']::text[]),
    ('3000000167175','OPPO','A57s 4G','a57s-4g','{}'::text[], array['CPH2385']::text[]),
    ('3000000396674','Realme','C71','c71','{}'::text[], '{}'::text[]),
    ('3000000396674','Realme','P3 Lite 4G','p3-lite-4g','{}'::text[], '{}'::text[]),
    ('3000000037713','Samsung','Galaxy J4 Plus','galaxy-j4-plus','{}'::text[], array['J415']::text[]),
    ('3000000037713','Samsung','Galaxy J6 Plus','galaxy-j6-plus','{}'::text[], array['J610']::text[]),
    ('3000000321355','TCL','405','405','{}'::text[], '{}'::text[]),
    ('3000000321355','TCL','406','406','{}'::text[], '{}'::text[]),
    ('3000000321355','TCL','408','408','{}'::text[], '{}'::text[]),
    ('3000000321355','TCL','406s','406s','{}'::text[], '{}'::text[]),
    ('3000000096819','Vivo','Y21s','y21s','{}'::text[], '{}'::text[]),
    ('3000000096819','Vivo','Y21','y21','{}'::text[], '{}'::text[]),
    ('3000000325322','Vivo','Y28s 5G','y28s-5g','{}'::text[], '{}'::text[]),
    ('3000000325322','Vivo','Y03','y03','{}'::text[], '{}'::text[]),
    ('3000000383971','Vivo','Y29s 5G','y29s-5g','{}'::text[], '{}'::text[]),
    ('3000000383971','Vivo','Y04','y04','{}'::text[], '{}'::text[]),
    ('3000000147177','Xiaomi','Poco M4 Pro 5G','poco-m4-pro-5g','{}'::text[], '{}'::text[]),
    ('3000000147177','Xiaomi','Redmi Note 11T 5G','redmi-note-11t-5g','{}'::text[], '{}'::text[]),
    ('3000000270240','Xiaomi','Poco C65','poco-c65','{}'::text[], '{}'::text[]),
    ('3000000270240','Xiaomi','Redmi 13C','redmi-13c','{}'::text[], '{}'::text[]),
    ('3000000153703','Xiaomi','Redmi 10C','redmi-10c','{}'::text[], '{}'::text[]),
    ('3000000153703','Xiaomi','Poco C40','poco-c40','{}'::text[], '{}'::text[]),
    ('3000000334393','Xiaomi','Redmi 14C','redmi-14c','{}'::text[], '{}'::text[]),
    ('3000000334393','Xiaomi','Poco C75','poco-c75','{}'::text[], '{}'::text[]),
    ('3000000039113','Xiaomi','Redmi Note 9S','redmi-note-9s','{}'::text[], '{}'::text[]),
    ('3000000039113','Xiaomi','Redmi Note 9 Pro 4G','redmi-note-9-pro-4g','{}'::text[], '{}'::text[]),
    ('3000000412534','Xiaomi','Redmi 15C 4G','redmi-15c-4g','{}'::text[], '{}'::text[]),
    ('3000000412534','Xiaomi','Poco C85 4G','poco-c85-4g','{}'::text[], '{}'::text[]),
    ('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','X8B','x8b',array['X8B']::text[], '{}'::text[]),
    ('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','200 Lite','200-lite','{}'::text[], '{}'::text[]),
    ('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','X8C','x8c',array['X8C']::text[], '{}'::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','Find X5 Lite','find-x5-lite','{}'::text[], '{}'::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','Reno 8 5G','reno-8-5g','{}'::text[], '{}'::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','Narzo 60','narzo-60','{}'::text[], '{}'::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','Narzo 60X','narzo-60x','{}'::text[], '{}'::text[]),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Redmi Note 10 4G','redmi-note-10-4g','{}'::text[], '{}'::text[]),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Redmi Note 10S','redmi-note-10s','{}'::text[], '{}'::text[]),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Poco M5S','poco-m5s','{}'::text[], '{}'::text[])
)
insert into public.device_models (brand,canonical_name,normalized_key,aliases,model_codes,model_series)
select distinct on (brand,normalized_key)
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  private.partspro_model_series(brand,canonical_name)
from relation_seed
on conflict on constraint device_models_brand_key_unique do update set
  aliases = (
    select coalesce(array_agg(distinct value order by value), '{}'::text[])
    from unnest(coalesce(device_models.aliases, '{}'::text[]) || coalesce(excluded.aliases, '{}'::text[])) as merged(value)
    where nullif(btrim(value), '') is not null
  ),
  model_codes = (
    select coalesce(array_agg(distinct value order by value), '{}'::text[])
    from unnest(coalesce(device_models.model_codes, '{}'::text[]) || coalesce(excluded.model_codes, '{}'::text[])) as merged(value)
    where nullif(btrim(value), '') is not null
  ),
  model_series = coalesce(device_models.model_series, excluded.model_series);

-- Approved links use the supplier FK only because both MOBILAX and EXTERNAL
-- supplier identities and their expected batches were confirmed above.
with product_seed(sku_code,supplier_code,batch_code,evidence_source,source_title,approved_models) as (
  values
    ('3000000290613','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Honor X7b/90 Smart Black',array['X7b','90 Smart']::text[]),
    ('3000000133569','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Motorola Moto E32/Moto E32S Black',array['Moto E32','Moto E32S']::text[]),
    ('3000000093078','MOBILAX','CVBLUQU8H23','supplier_arrival_title','Display OEM OPPO A16 4G/A16s/A54s CPH2271 CPH2269 CPH2273 Nero',array['A16 4G','A16s','A54s']::text[]),
    ('3000000094204','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen OPPO A53s 2020/A53 4G 2020 CPH2139 / CPH2135 / CPH2127 Black',array['A53s 2020','A53 4G 2020']::text[]),
    ('3000000167175','MOBILAX','CVQY8D5SA8O','supplier_arrival_title','Display OEM OPPO A57 CPH2387 / A57s 4G CPH2385 Black',array['A57','A57s 4G']::text[]),
    ('3000000396674','MOBILAX','CVBLUQU8H23','supplier_arrival_title','Display OEM Realme C71/P3 Lite 4G Nero',array['C71','P3 Lite 4G']::text[]),
    ('3000000037713','MOBILAX','C9NS2AL2YZ1','current_catalog_title','Oled Display Touchscreen Samsung Galaxy J4 Plus J415/Galaxy J6 Plus J610 Black',array['Galaxy J4 Plus','Galaxy J6 Plus']::text[]),
    ('3000000321355','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen TCL 405/406/408/406s Black',array['405','406','408','406s']::text[]),
    ('3000000096819','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Vivo Y21s/Y21 Black',array['Y21s','Y21']::text[]),
    ('3000000325322','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Vivo Y28s 5G/Y03 Black',array['Y28s 5G','Y03']::text[]),
    ('3000000383971','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Vivo Y29s 5G/Y04 Black',array['Y29s 5G','Y04']::text[]),
    ('3000000147177','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen with Frame Xiaomi Poco M4 Pro 5G/Redmi Note 11T 5G Black',array['Poco M4 Pro 5G','Redmi Note 11T 5G']::text[]),
    ('3000000270240','MOBILAX','C9NS2AL2YZ1','owner_statement_and_current_catalog_title','OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black',array['Poco C65','Redmi 13C']::text[]),
    ('3000000153703','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Xiaomi Redmi 10C/Poco C40',array['Redmi 10C','Poco C40']::text[]),
    ('3000000334393','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Xiaomi Redmi 14C/Poco C75 Black',array['Redmi 14C','Poco C75']::text[]),
    ('3000000039113','MOBILAX','C9NS2AL2YZ1','current_catalog_title','OEM Display Touchscreen Xiaomi Redmi Note 9S/Redmi Note 9 Pro 4G Black',array['Redmi Note 9S','Redmi Note 9 Pro 4G']::text[]),
    ('3000000412534','MOBILAX','C9NS2AL2YZ1','current_catalog_title','Original Pulled Display Touchscreen Xiaomi Redmi 15C 4G/Poco C85 4G Version International Black',array['Redmi 15C 4G','Poco C85 4G']::text[]),
    ('PP-HON-X8B-200L-X8C-ORG-LCD','EXTERNAL','WECHAT-20260618-A0646','current_catalog_title','Original LCD Display Honor X8B / Honor 200 Lite / Honor X8C',array['X8B','200 Lite','X8C']::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','EXTERNAL','WECHAT-20260618-A0646','current_catalog_title','LCD Display TFT OPPO Find X5 Lite / OPPO Reno 8 5G / Realme Narzo 60 / Narzo 60X Black',array['Find X5 Lite','Reno 8 5G','Narzo 60','Narzo 60X']::text[]),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','EXTERNAL','WECHAT-20260618-A0646','current_catalog_title','LCD Display TFT Xiaomi Redmi Note 10 4G / Redmi Note 10S / Poco M5S',array['Redmi Note 10 4G','Redmi Note 10S','Poco M5S']::text[])
), relation_seed(sku_code,brand,canonical_name,normalized_key) as (
  values
    ('3000000290613','Honor','X7b','x7b'),('3000000290613','Honor','90 Smart','90-smart'),
    ('3000000133569','Motorola','Moto E32','moto-e32'),('3000000133569','Motorola','Moto E32S','moto-e32s'),
    ('3000000093078','OPPO','A16 4G','a16-4g'),('3000000093078','OPPO','A16s','a16s'),('3000000093078','OPPO','A54s','a54s'),
    ('3000000094204','OPPO','A53s 2020','a53s-2020'),('3000000094204','OPPO','A53 4G 2020','a53-4g-2020'),
    ('3000000167175','OPPO','A57','a57'),('3000000167175','OPPO','A57s 4G','a57s-4g'),
    ('3000000396674','Realme','C71','c71'),('3000000396674','Realme','P3 Lite 4G','p3-lite-4g'),
    ('3000000037713','Samsung','Galaxy J4 Plus','galaxy-j4-plus'),('3000000037713','Samsung','Galaxy J6 Plus','galaxy-j6-plus'),
    ('3000000321355','TCL','405','405'),('3000000321355','TCL','406','406'),('3000000321355','TCL','408','408'),('3000000321355','TCL','406s','406s'),
    ('3000000096819','Vivo','Y21s','y21s'),('3000000096819','Vivo','Y21','y21'),
    ('3000000325322','Vivo','Y28s 5G','y28s-5g'),('3000000325322','Vivo','Y03','y03'),
    ('3000000383971','Vivo','Y29s 5G','y29s-5g'),('3000000383971','Vivo','Y04','y04'),
    ('3000000147177','Xiaomi','Poco M4 Pro 5G','poco-m4-pro-5g'),('3000000147177','Xiaomi','Redmi Note 11T 5G','redmi-note-11t-5g'),
    ('3000000270240','Xiaomi','Poco C65','poco-c65'),('3000000270240','Xiaomi','Redmi 13C','redmi-13c'),
    ('3000000153703','Xiaomi','Redmi 10C','redmi-10c'),('3000000153703','Xiaomi','Poco C40','poco-c40'),
    ('3000000334393','Xiaomi','Redmi 14C','redmi-14c'),('3000000334393','Xiaomi','Poco C75','poco-c75'),
    ('3000000039113','Xiaomi','Redmi Note 9S','redmi-note-9s'),('3000000039113','Xiaomi','Redmi Note 9 Pro 4G','redmi-note-9-pro-4g'),
    ('3000000412534','Xiaomi','Redmi 15C 4G','redmi-15c-4g'),('3000000412534','Xiaomi','Poco C85 4G','poco-c85-4g'),
    ('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','X8B','x8b'),('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','200 Lite','200-lite'),('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','X8C','x8c'),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','Find X5 Lite','find-x5-lite'),('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','Reno 8 5G','reno-8-5g'),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','Narzo 60','narzo-60'),('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','Narzo 60X','narzo-60x'),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Redmi Note 10 4G','redmi-note-10-4g'),('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Redmi Note 10S','redmi-note-10s'),('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','Poco M5S','poco-m5s')
)
insert into public.product_device_compatibilities (
  product_id, device_model_id, source_type, source_supplier_id,
  source_reference, confidence, review_status, verified_at, note, metadata
)
select
  p.id,
  d.id,
  case when ps.evidence_source = 'supplier_arrival_title' then 'supplier' else 'manual' end,
  case when ps.evidence_source = 'supplier_arrival_title' then s.id else null end,
  'Approved compatibility ledger 2026-08-08; supplier batch ' || ps.batch_code || '; source title: ' || ps.source_title,
  case when ps.evidence_source = 'supplier_arrival_title' then 0.990 else 0.950 end,
  'approved',
  timestamptz '2026-08-08 00:00:00+00',
  case
    when ps.sku_code = '3000000270240'
      then 'Owner-approved Xiaomi::Poco C65 and Xiaomi::Redmi 13C; Xiaomi::Redmi 13C 5G is not included in this approved batch (no technical rejection asserted).'
    else 'Owner-approved compatibility ledger 2026-08-08; inventory_action=none.'
  end,
  jsonb_build_object(
    'review_batch', '2026-08-08-stocked-shared-screen-compatibility-review',
    'approval_decision', 'approved',
    'approved_by', 'PartsPro owner instruction 2026-08-08',
    'inventory_action', 'none',
    'evidence_source', ps.evidence_source,
    'supplier_code', ps.supplier_code,
    'batch_code', ps.batch_code,
    'owner_excluded_relations', case
      when ps.sku_code = '3000000270240' then jsonb_build_array('Xiaomi::Redmi 13C 5G')
      else '[]'::jsonb
    end
  )
from relation_seed rs
join product_seed ps on ps.sku_code = rs.sku_code
join public.products p on p.sku_code = rs.sku_code
join public.device_models d on d.brand_key = lower(rs.brand) and d.normalized_key = rs.normalized_key
join public.suppliers s on s.code = ps.supplier_code
on conflict (product_id,device_model_id) do update set
  source_type = excluded.source_type,
  source_supplier_id = excluded.source_supplier_id,
  source_reference = excluded.source_reference,
  confidence = excluded.confidence,
  review_status = excluded.review_status,
  verified_by = excluded.verified_by,
  verified_at = excluded.verified_at,
  note = excluded.note,
  metadata = product_device_compatibilities.metadata || excluded.metadata
where product_device_compatibilities.review_status <> 'rejected';

-- Projection is ordered exactly as the owner-approved ledger and contains
-- model names only; relation brands remain canonical in device_models.
with product_seed(sku_code,approved_models) as (
  values
    ('3000000290613',array['X7b','90 Smart']::text[]),
    ('3000000133569',array['Moto E32','Moto E32S']::text[]),
    ('3000000093078',array['A16 4G','A16s','A54s']::text[]),
    ('3000000094204',array['A53s 2020','A53 4G 2020']::text[]),
    ('3000000167175',array['A57','A57s 4G']::text[]),
    ('3000000396674',array['C71','P3 Lite 4G']::text[]),
    ('3000000037713',array['Galaxy J4 Plus','Galaxy J6 Plus']::text[]),
    ('3000000321355',array['405','406','408','406s']::text[]),
    ('3000000096819',array['Y21s','Y21']::text[]),
    ('3000000325322',array['Y28s 5G','Y03']::text[]),
    ('3000000383971',array['Y29s 5G','Y04']::text[]),
    ('3000000147177',array['Poco M4 Pro 5G','Redmi Note 11T 5G']::text[]),
    ('3000000270240',array['Poco C65','Redmi 13C']::text[]),
    ('3000000153703',array['Redmi 10C','Poco C40']::text[]),
    ('3000000334393',array['Redmi 14C','Poco C75']::text[]),
    ('3000000039113',array['Redmi Note 9S','Redmi Note 9 Pro 4G']::text[]),
    ('3000000412534',array['Redmi 15C 4G','Poco C85 4G']::text[]),
    ('PP-HON-X8B-200L-X8C-ORG-LCD',array['X8B','200 Lite','X8C']::text[]),
    ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK',array['Find X5 Lite','Reno 8 5G','Narzo 60','Narzo 60X']::text[]),
    ('PP-XIA-RN10-RN10S-M5S-TFT-LCD',array['Redmi Note 10 4G','Redmi Note 10S','Poco M5S']::text[])
)
update public.products p
set compatibility_models = seed.approved_models
from product_seed seed
where p.sku_code = seed.sku_code
  and p.compatibility_models is distinct from seed.approved_models;

do $$
declare
  v_approved_count integer;
  v_device_count integer;
begin
  select count(*) into v_approved_count
  from public.product_device_compatibilities c
  join public.products p on p.id = c.product_id
  where p.sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175',
    '3000000396674','3000000037713','3000000321355','3000000096819','3000000325322',
    '3000000383971','3000000147177','3000000270240','3000000153703','3000000334393',
    '3000000039113','3000000412534','PP-HON-X8B-200L-X8C-ORG-LCD',
    'PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[])
    and c.review_status = 'approved';

  if v_approved_count <> 47 then
    raise exception 'Expected exactly 47 approved compatibility links, found %', v_approved_count;
  end if;

  select count(distinct (d.brand_key,d.normalized_key)) into v_device_count
  from public.product_device_compatibilities c
  join public.products p on p.id = c.product_id
  join public.device_models d on d.id = c.device_model_id
  where p.sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175',
    '3000000396674','3000000037713','3000000321355','3000000096819','3000000325322',
    '3000000383971','3000000147177','3000000270240','3000000153703','3000000334393',
    '3000000039113','3000000412534','PP-HON-X8B-200L-X8C-ORG-LCD',
    'PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[])
    and c.review_status = 'approved';

  if v_device_count <> 47 then
    raise exception 'Expected exactly 47 canonical devices, found %', v_device_count;
  end if;

  if exists (
    select 1
    from public.product_device_compatibilities c
    join public.products p on p.id = c.product_id
    where p.sku_code = any(array[
      '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175',
      '3000000396674','3000000037713','3000000321355','3000000096819','3000000325322',
      '3000000383971','3000000147177','3000000270240','3000000153703','3000000334393',
      '3000000039113','3000000412534','PP-HON-X8B-200L-X8C-ORG-LCD',
      'PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
    ]::text[])
      and c.review_status = 'rejected'
  ) then
    raise exception 'A target compatibility link is rejected; migration never reopens rejected evidence';
  end if;

  if exists (
    select 1
    from public.product_device_compatibilities c
    join public.products p on p.id = c.product_id
    join public.device_models d on d.id = c.device_model_id
    where p.sku_code = '3000000270240'
      and d.brand_key = 'xiaomi'
      and d.normalized_key = 'redmi-13c-5g'
  ) then
    raise exception 'SKU 3000000270240 must not relate to Xiaomi::Redmi 13C 5G';
  end if;

  if exists (
    with expected(sku_code,relation_count) as (
      values
        ('3000000290613',2),('3000000133569',2),('3000000093078',3),('3000000094204',2),
        ('3000000167175',2),('3000000396674',2),('3000000037713',2),('3000000321355',4),
        ('3000000096819',2),('3000000325322',2),('3000000383971',2),('3000000147177',2),
        ('3000000270240',2),('3000000153703',2),('3000000334393',2),('3000000039113',2),
        ('3000000412534',2),('PP-HON-X8B-200L-X8C-ORG-LCD',3),
        ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK',4),('PP-XIA-RN10-RN10S-M5S-TFT-LCD',3)
    ), actual as (
      select p.sku_code,count(*)::integer as relation_count
      from public.product_device_compatibilities c
      join public.products p on p.id = c.product_id
      where c.review_status = 'approved' and p.sku_code in (select sku_code from expected)
      group by p.sku_code
    )
    select 1 from expected left join actual using (sku_code)
    where actual.relation_count is distinct from expected.relation_count
  ) then
    raise exception 'Per-SKU approved compatibility counts do not match the owner ledger';
  end if;

  if exists (
    with expected(sku_code,brand,normalized_key) as (
      values
        ('3000000290613','Honor','x7b'),('3000000290613','Honor','90-smart'),
        ('3000000133569','Motorola','moto-e32'),('3000000133569','Motorola','moto-e32s'),
        ('3000000093078','OPPO','a16-4g'),('3000000093078','OPPO','a16s'),('3000000093078','OPPO','a54s'),
        ('3000000094204','OPPO','a53s-2020'),('3000000094204','OPPO','a53-4g-2020'),
        ('3000000167175','OPPO','a57'),('3000000167175','OPPO','a57s-4g'),
        ('3000000396674','Realme','c71'),('3000000396674','Realme','p3-lite-4g'),
        ('3000000037713','Samsung','galaxy-j4-plus'),('3000000037713','Samsung','galaxy-j6-plus'),
        ('3000000321355','TCL','405'),('3000000321355','TCL','406'),('3000000321355','TCL','408'),('3000000321355','TCL','406s'),
        ('3000000096819','Vivo','y21s'),('3000000096819','Vivo','y21'),
        ('3000000325322','Vivo','y28s-5g'),('3000000325322','Vivo','y03'),
        ('3000000383971','Vivo','y29s-5g'),('3000000383971','Vivo','y04'),
        ('3000000147177','Xiaomi','poco-m4-pro-5g'),('3000000147177','Xiaomi','redmi-note-11t-5g'),
        ('3000000270240','Xiaomi','poco-c65'),('3000000270240','Xiaomi','redmi-13c'),
        ('3000000153703','Xiaomi','redmi-10c'),('3000000153703','Xiaomi','poco-c40'),
        ('3000000334393','Xiaomi','redmi-14c'),('3000000334393','Xiaomi','poco-c75'),
        ('3000000039113','Xiaomi','redmi-note-9s'),('3000000039113','Xiaomi','redmi-note-9-pro-4g'),
        ('3000000412534','Xiaomi','redmi-15c-4g'),('3000000412534','Xiaomi','poco-c85-4g'),
        ('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','x8b'),('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','200-lite'),('PP-HON-X8B-200L-X8C-ORG-LCD','Honor','x8c'),
        ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','find-x5-lite'),('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','OPPO','reno-8-5g'),
        ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','narzo-60'),('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','Realme','narzo-60x'),
        ('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','redmi-note-10-4g'),('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','redmi-note-10s'),('PP-XIA-RN10-RN10S-M5S-TFT-LCD','Xiaomi','poco-m5s')
    ), actual as (
      select p.sku_code,d.brand,d.normalized_key
      from public.product_device_compatibilities c
      join public.products p on p.id = c.product_id
      join public.device_models d on d.id = c.device_model_id
      where c.review_status = 'approved'
    )
    select 1
    from expected e
    left join actual a using (sku_code,brand,normalized_key)
    where a.sku_code is null
  ) then
    raise exception 'One or more owner-approved brand/model mappings are missing';
  end if;

  if exists (
    with product_seed(sku_code,approved_models) as (
      values
        ('3000000290613',array['X7b','90 Smart']::text[]),('3000000133569',array['Moto E32','Moto E32S']::text[]),
        ('3000000093078',array['A16 4G','A16s','A54s']::text[]),('3000000094204',array['A53s 2020','A53 4G 2020']::text[]),
        ('3000000167175',array['A57','A57s 4G']::text[]),('3000000396674',array['C71','P3 Lite 4G']::text[]),
        ('3000000037713',array['Galaxy J4 Plus','Galaxy J6 Plus']::text[]),('3000000321355',array['405','406','408','406s']::text[]),
        ('3000000096819',array['Y21s','Y21']::text[]),('3000000325322',array['Y28s 5G','Y03']::text[]),
        ('3000000383971',array['Y29s 5G','Y04']::text[]),('3000000147177',array['Poco M4 Pro 5G','Redmi Note 11T 5G']::text[]),
        ('3000000270240',array['Poco C65','Redmi 13C']::text[]),('3000000153703',array['Redmi 10C','Poco C40']::text[]),
        ('3000000334393',array['Redmi 14C','Poco C75']::text[]),('3000000039113',array['Redmi Note 9S','Redmi Note 9 Pro 4G']::text[]),
        ('3000000412534',array['Redmi 15C 4G','Poco C85 4G']::text[]),('PP-HON-X8B-200L-X8C-ORG-LCD',array['X8B','200 Lite','X8C']::text[]),
        ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK',array['Find X5 Lite','Reno 8 5G','Narzo 60','Narzo 60X']::text[]),
        ('PP-XIA-RN10-RN10S-M5S-TFT-LCD',array['Redmi Note 10 4G','Redmi Note 10S','Poco M5S']::text[])
    )
    select 1
    from public.products p
    join product_seed seed on seed.sku_code = p.sku_code
    where p.compatibility_models is distinct from seed.approved_models
  ) then
    raise exception 'compatibility_models projection does not match the approved ledger';
  end if;

  if exists (
    with inventory as (
      select sku_code, sum(available_qty)::integer as available_qty,
             sum(actual_qty)::integer as actual_qty, sum(locked_qty)::integer as locked_qty
      from public.inventory_items
      group by sku_code
    ), expected(sku_code,stock_available,stock_actual,stock_locked) as (
      values
        ('3000000290613',2,2,0),('3000000133569',2,2,0),('3000000093078',3,3,0),('3000000094204',2,2,0),
        ('3000000167175',5,5,0),('3000000396674',2,2,0),('3000000037713',1,1,0),('3000000321355',2,2,0),
        ('3000000096819',2,2,0),('3000000325322',2,2,0),('3000000383971',1,1,0),('3000000147177',2,2,0),
        ('3000000270240',4,5,1),('3000000153703',5,5,0),('3000000334393',5,5,0),('3000000039113',2,2,0),
        ('3000000412534',2,2,0),('PP-HON-X8B-200L-X8C-ORG-LCD',2,2,0),
        ('PP-OPP-FX5L-R8-N60-TFT-LCD-BLK',3,3,0),('PP-XIA-RN10-RN10S-M5S-TFT-LCD',3,3,0)
    )
    select 1 from expected e
    join public.products p using (sku_code)
    left join inventory i using (sku_code)
    where p.stock_qty is distinct from e.stock_available
       or i.available_qty is distinct from e.stock_available
       or i.actual_qty is distinct from e.stock_actual
       or i.locked_qty is distinct from e.stock_locked
  ) then
    raise exception 'Approved target inventory/product stock changed during compatibility migration';
  end if;

  if (select coalesce(sum(available_qty),0)::integer from public.inventory_items where sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175','3000000396674',
    '3000000037713','3000000321355','3000000096819','3000000325322','3000000383971','3000000147177',
    '3000000270240','3000000153703','3000000334393','3000000039113','3000000412534',
    'PP-HON-X8B-200L-X8C-ORG-LCD','PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[])) <> 52 then
    raise exception 'Approved target available total must remain 52';
  end if;

  if (select coalesce(sum(actual_qty),0)::integer from public.inventory_items where sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175','3000000396674',
    '3000000037713','3000000321355','3000000096819','3000000325322','3000000383971','3000000147177',
    '3000000270240','3000000153703','3000000334393','3000000039113','3000000412534',
    'PP-HON-X8B-200L-X8C-ORG-LCD','PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[])) <> 53 then
    raise exception 'Approved target actual total must remain 53';
  end if;

  if (select coalesce(sum(locked_qty),0)::integer from public.inventory_items where sku_code = any(array[
    '3000000290613','3000000133569','3000000093078','3000000094204','3000000167175','3000000396674',
    '3000000037713','3000000321355','3000000096819','3000000325322','3000000383971','3000000147177',
    '3000000270240','3000000153703','3000000334393','3000000039113','3000000412534',
    'PP-HON-X8B-200L-X8C-ORG-LCD','PP-OPP-FX5L-R8-N60-TFT-LCD-BLK','PP-XIA-RN10-RN10S-M5S-TFT-LCD'
  ]::text[])) <> 1 then
    raise exception 'Approved target locked total must remain 1';
  end if;
end;
$$;

notify pgrst, 'reload schema';
