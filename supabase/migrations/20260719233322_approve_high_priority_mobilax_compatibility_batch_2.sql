do $$
declare
  v_target_count integer;
  v_supplier_count integer;
begin
  select count(*)
  into v_target_count
  from public.products
  where sku_code = any(array[
    '3000000057810',
    '3000000057827',
    '3000000093085',
    '3000000096659',
    '3000000150122',
    '3000000166222',
    '3000000206485',
    '3000000207444',
    '3000000211663',
    '3000000338667'
  ]::text[]);

  if v_target_count <> 10 then
    raise exception 'Expected 10 target products, found %', v_target_count;
  end if;

  select count(*)
  into v_supplier_count
  from public.suppliers
  where code = 'MOBILAX';

  if v_supplier_count <> 1 then
    raise exception 'Expected one MOBILAX supplier, found %', v_supplier_count;
  end if;

  if exists (
    with inventory as (
      select
        sku_code,
        sum(actual_qty)::integer as actual_qty,
        sum(available_qty)::integer as available_qty,
        sum(locked_qty)::integer as locked_qty
      from public.inventory_items
      group by sku_code
    )
    select 1
    from public.products as product
    left join inventory
      on inventory.sku_code = product.sku_code
    where product.sku_code = any(array[
      '3000000057810',
      '3000000057827',
      '3000000093085',
      '3000000096659',
      '3000000150122',
      '3000000166222',
      '3000000206485',
      '3000000207444',
      '3000000211663',
      '3000000338667'
    ]::text[])
      and (
        inventory.sku_code is null
        or product.stock_qty <> inventory.available_qty
        or inventory.actual_qty <> inventory.available_qty + inventory.locked_qty
      )
  ) then
    raise exception 'Target inventory invariant failed before compatibility approval';
  end if;
end;
$$;

with device_seed (
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series
) as (
  values
    ('Xiaomi', 'Redmi 9A', 'redmi-9a', '{}'::text[], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi 9C NFC', 'redmi-9c-nfc', '{}'::text[], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi 10A', 'redmi-10a', '{}'::text[], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi A1', 'redmi-a1', '{}'::text[], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi A1+', 'redmi-a1-plus', array['Redmi A1 Plus'], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi A2', 'redmi-a2', '{}'::text[], '{}'::text[], 'Redmi'),
    ('Xiaomi', 'Redmi A2+', 'redmi-a2-plus', array['Redmi A2 Plus'], '{}'::text[], 'Redmi'),
    ('Samsung', 'Galaxy A12', 'galaxy-a12', array['Galaxy A12 A125'], array['A12', 'A125', 'A125F'], 'Galaxy A'),
    ('Samsung', 'Galaxy M12', 'galaxy-m12', array['Galaxy M12 M127'], array['M12', 'M127', 'M127F'], 'Galaxy M'),
    ('Samsung', 'Galaxy A13 5G', 'galaxy-a13-5g', array['Galaxy A13 5G A136'], array['A13', 'A136', 'A136B'], 'Galaxy A'),
    ('Samsung', 'Galaxy M13 5G', 'galaxy-m13-5g', array['Galaxy M13 5G M136'], array['M13', 'M136', 'M136B'], 'Galaxy M'),
    ('Samsung', 'Galaxy A23 4G', 'galaxy-a23-4g', array['Galaxy A23 4G A235'], array['A23', 'A235', 'A235F'], 'Galaxy A'),
    ('Samsung', 'Galaxy A23 5G', 'galaxy-a23-5g', array['Galaxy A23 5G A236'], array['A23', 'A236', 'A236B'], 'Galaxy A'),
    ('Samsung', 'Galaxy A73 5G', 'galaxy-a73-5g', array['Galaxy A73 5G A736'], array['A73', 'A736', 'A736B'], 'Galaxy A'),
    ('Samsung', 'Galaxy M23 5G', 'galaxy-m23-5g', array['Galaxy M23 5G M236'], array['M23', 'M236', 'M236B'], 'Galaxy M'),
    ('Samsung', 'Galaxy M52 5G', 'galaxy-m52-5g', array['Galaxy M52 5G M526'], array['M52', 'M526', 'M526B'], 'Galaxy M'),
    ('Samsung', 'Galaxy M53 5G', 'galaxy-m53-5g', array['Galaxy M53 5G M536'], array['M53', 'M536', 'M536B'], 'Galaxy M'),
    ('Samsung', 'Galaxy A32 5G', 'galaxy-a32-5g', array['Galaxy A32 5G A326'], array['A32', 'A326', 'A326B'], 'Galaxy A'),
    ('Samsung', 'Galaxy A42 5G', 'galaxy-a42-5g', array['Galaxy A42 5G A426'], array['A42', 'A426', 'A426B'], 'Galaxy A'),
    ('Samsung', 'Galaxy A72 4G', 'galaxy-a72-4g', array['Galaxy A72 4G A725'], array['A72', 'A725', 'A725F'], 'Galaxy A'),
    ('Samsung', 'Galaxy A72 5G', 'galaxy-a72-5g', array['Galaxy A72 5G A726'], array['A72', 'A726', 'A726B'], 'Galaxy A'),
    ('Samsung', 'Galaxy M22', 'galaxy-m22', array['Galaxy M22 M225'], array['M22', 'M225', 'M225F'], 'Galaxy M'),
    ('Samsung', 'Galaxy M32', 'galaxy-m32', array['Galaxy M32 M325'], array['M32', 'M325', 'M325F'], 'Galaxy M'),
    ('Samsung', 'Galaxy A16 4G', 'galaxy-a16-4g', array['Galaxy A16 4G A165'], array['A16', 'A165', 'A165F'], 'Galaxy A'),
    ('Samsung', 'Galaxy A16 5G', 'galaxy-a16-5g', array['Galaxy A16 5G A166'], array['A16', 'A166', 'A166B'], 'Galaxy A'),
    ('Samsung', 'Galaxy A17 4G', 'galaxy-a17-4g', array['Galaxy A17 4G A175'], array['A17', 'A175', 'A175F'], 'Galaxy A'),
    ('Samsung', 'Galaxy A17 5G', 'galaxy-a17-5g', array['Galaxy A17 5G A176'], array['A17', 'A176', 'A176B'], 'Galaxy A'),
    ('Samsung', 'Galaxy A26 5G', 'galaxy-a26-5g', array['Galaxy A26 5G A266'], array['A26', 'A266', 'A266B'], 'Galaxy A'),
    ('OPPO', 'A53s 2020', 'a53s-2020', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A74 5G', 'a74-5g', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A54 5G', 'a54-5g', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A53 4G 2020', 'a53-4g-2020', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A16 4G', 'a16-4g', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A54s', 'a54s', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A16s', 'a16s', '{}'::text[], '{}'::text[], 'A'),
    ('OPPO', 'A54 4G', 'a54-4g', '{}'::text[], '{}'::text[], 'A')
)
insert into public.device_models (
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series
)
select
  seed.brand,
  seed.canonical_name,
  seed.normalized_key,
  seed.aliases,
  seed.model_codes,
  seed.model_series
from device_seed as seed
on conflict on constraint device_models_brand_key_unique do nothing;

with compatibility_seed (
  sku_code,
  brand,
  normalized_key,
  source_reference,
  confidence,
  note,
  evidence_url
) as (
  values
    ('3000000057810', 'Xiaomi', 'redmi-9a', 'Mobilax catalog product title snapshot; SKU/EAN 3000000057810', 0.970, 'The supplier product title explicitly lists Redmi 9A, Redmi 9C NFC and Redmi 10A.', 'https://www.mobilax.com'),
    ('3000000057810', 'Xiaomi', 'redmi-9c-nfc', 'Mobilax catalog product title snapshot; SKU/EAN 3000000057810', 0.970, 'The supplier product title explicitly lists Redmi 9A, Redmi 9C NFC and Redmi 10A.', 'https://www.mobilax.com'),
    ('3000000057810', 'Xiaomi', 'redmi-10a', 'Mobilax catalog product title snapshot; SKU/EAN 3000000057810', 0.970, 'The supplier product title explicitly lists Redmi 9A, Redmi 9C NFC and Redmi 10A.', 'https://www.mobilax.com'),
    ('3000000057827', 'Xiaomi', 'redmi-9a', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000057827; BN56', 0.990, 'Mobilax identifies this BN56 battery for all five approved Redmi models.', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56'),
    ('3000000057827', 'Xiaomi', 'redmi-9c-nfc', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000057827; BN56', 0.990, 'Mobilax identifies this BN56 battery for all five approved Redmi models.', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56'),
    ('3000000057827', 'Xiaomi', 'redmi-10a', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000057827; BN56', 0.990, 'Mobilax identifies this BN56 battery for all five approved Redmi models.', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56'),
    ('3000000057827', 'Xiaomi', 'redmi-a1', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000057827; BN56', 0.990, 'Mobilax identifies this BN56 battery for all five approved Redmi models.', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56'),
    ('3000000057827', 'Xiaomi', 'redmi-a1-plus', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000057827; BN56', 0.990, 'Mobilax identifies this BN56 battery for all five approved Redmi models.', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56'),
    ('3000000093085', 'OPPO', 'a53s-2020', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a74-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a54-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a53-4g-2020', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a16-4g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a54s', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a16s', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000093085', 'OPPO', 'a54-4g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000093085; BLP805', 0.990, 'Mobilax explicitly lists eight OPPO models for the same BLP805 battery.', 'https://www.mobilax.com/sim-card-tray-oppo-a54-5g-twilight-black'),
    ('3000000096659', 'Apple', 'iphone-12', 'Mobilax product page; SKU/EAN 3000000096659', 0.990, 'The Mobilax display title explicitly lists iPhone 12 and iPhone 12 Pro.', 'https://www.mobilax.com/touchpanel-lcd-tft-apple-iphone-12-iphone-12-pro-black'),
    ('3000000096659', 'Apple', 'iphone-12-pro', 'Mobilax product page; SKU/EAN 3000000096659', 0.990, 'The Mobilax display title explicitly lists iPhone 12 and iPhone 12 Pro.', 'https://www.mobilax.com/touchpanel-lcd-tft-apple-iphone-12-iphone-12-pro-black'),
    ('3000000150122', 'Samsung', 'galaxy-a12', 'Mobilax arrival batches C05J9J76369 and CVBLUQU8H23; EAN 3000000150122', 0.990, 'Two Mobilax receipts identify the same dock connector for Galaxy A12 and Galaxy M12.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a?page=21'),
    ('3000000150122', 'Samsung', 'galaxy-m12', 'Mobilax arrival batches C05J9J76369 and CVBLUQU8H23; EAN 3000000150122', 0.990, 'Two Mobilax receipts identify the same dock connector for Galaxy A12 and Galaxy M12.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a?page=21'),
    ('3000000166222', 'Xiaomi', 'redmi-a1', 'Mobilax arrival batch CVBLUQU8H23; EAN 3000000166222', 0.990, 'The Mobilax receipt explicitly lists Redmi A1, A1+, A2 and A2+ for one display.', 'https://www.mobilax.com/spare-parts/mobile-phone/xiaomi/redmi-series/redmi-a1'),
    ('3000000166222', 'Xiaomi', 'redmi-a1-plus', 'Mobilax arrival batch CVBLUQU8H23; EAN 3000000166222', 0.990, 'The Mobilax receipt explicitly lists Redmi A1, A1+, A2 and A2+ for one display.', 'https://www.mobilax.com/spare-parts/mobile-phone/xiaomi/redmi-series/redmi-a1'),
    ('3000000166222', 'Xiaomi', 'redmi-a2', 'Mobilax arrival batch CVBLUQU8H23; EAN 3000000166222', 0.990, 'The Mobilax receipt explicitly lists Redmi A1, A1+, A2 and A2+ for one display.', 'https://www.mobilax.com/spare-parts/mobile-phone/xiaomi/redmi-series/redmi-a1'),
    ('3000000166222', 'Xiaomi', 'redmi-a2-plus', 'Mobilax arrival batch CVBLUQU8H23; EAN 3000000166222', 0.990, 'The Mobilax receipt explicitly lists Redmi A1, A1+, A2 and A2+ for one display.', 'https://www.mobilax.com/spare-parts/mobile-phone/xiaomi/redmi-series/redmi-a1'),
    ('3000000206485', 'Samsung', 'galaxy-a23-4g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000206485', 'Samsung', 'galaxy-a23-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000206485', 'Samsung', 'galaxy-a73-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000206485', 'Samsung', 'galaxy-m23-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000206485', 'Samsung', 'galaxy-m52-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000206485', 'Samsung', 'galaxy-m53-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000206485; EB-BM526ABS', 0.990, 'Mobilax identifies one EB-BM526ABS battery for the six approved Galaxy models.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-a/galaxy-a23-5g-a236'),
    ('3000000207444', 'Samsung', 'galaxy-a32-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000207444', 'Samsung', 'galaxy-a42-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000207444', 'Samsung', 'galaxy-a72-4g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000207444', 'Samsung', 'galaxy-a72-5g', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000207444', 'Samsung', 'galaxy-m22', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000207444', 'Samsung', 'galaxy-m32', 'Mobilax arrival batch CVENMWEBUU8; EAN 3000000207444; EB-BA426ABY', 0.990, 'Mobilax identifies one EB-BA426ABY battery for the six approved Galaxy models.', 'https://www.mobilax.com/brands/spare-parts/samsung/mobile-phone/galaxy-a/galaxy-a72-4g-a725'),
    ('3000000211663', 'Samsung', 'galaxy-a13-5g', 'Mobilax arrival batch C05J9J76369; EAN 3000000211663', 0.990, 'The Mobilax receipt explicitly identifies the dock connector for Galaxy A13 5G and Galaxy M13 5G.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-m/galaxy-m13-5g-m136'),
    ('3000000211663', 'Samsung', 'galaxy-m13-5g', 'Mobilax arrival batch C05J9J76369; EAN 3000000211663', 0.990, 'The Mobilax receipt explicitly identifies the dock connector for Galaxy A13 5G and Galaxy M13 5G.', 'https://www.mobilax.com/spare-parts/mobile-phone/samsung/galaxy-m/galaxy-m13-5g-m136'),
    ('3000000338667', 'Samsung', 'galaxy-a16-4g', 'Mobilax product page and arrival batch CVENMWEBUU8; EAN 3000000338667; EB-BA166ASE', 0.990, 'The current product page and earlier receipt agree on five approved models; Galaxy A27 5G remains withheld.', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b'),
    ('3000000338667', 'Samsung', 'galaxy-a16-5g', 'Mobilax product page and arrival batch CVENMWEBUU8; EAN 3000000338667; EB-BA166ASE', 0.990, 'The current product page and earlier receipt agree on five approved models; Galaxy A27 5G remains withheld.', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b'),
    ('3000000338667', 'Samsung', 'galaxy-a17-4g', 'Mobilax product page and arrival batch CVENMWEBUU8; EAN 3000000338667; EB-BA166ASE', 0.990, 'The current product page and earlier receipt agree on five approved models; Galaxy A27 5G remains withheld.', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b'),
    ('3000000338667', 'Samsung', 'galaxy-a17-5g', 'Mobilax product page and arrival batch CVENMWEBUU8; EAN 3000000338667; EB-BA166ASE', 0.990, 'The current product page and earlier receipt agree on five approved models; Galaxy A27 5G remains withheld.', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b'),
    ('3000000338667', 'Samsung', 'galaxy-a26-5g', 'Mobilax product page and arrival batch CVENMWEBUU8; EAN 3000000338667; EB-BA166ASE', 0.990, 'The current product page and earlier receipt agree on five approved models; Galaxy A27 5G remains withheld.', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b')
)
insert into public.product_device_compatibilities (
  product_id,
  device_model_id,
  source_type,
  source_supplier_id,
  source_reference,
  confidence,
  review_status,
  verified_at,
  note,
  metadata
)
select
  product.id,
  device.id,
  'supplier',
  supplier.id,
  seed.source_reference,
  seed.confidence,
  'approved',
  now(),
  seed.note,
  jsonb_build_object(
    'review_batch', '2026-07-20-high-priority-batch-2',
    'approved_by', 'PartsPro owner instruction',
    'evidence_url', seed.evidence_url,
    'inventory_action', 'none'
  ) || case
    when seed.sku_code = '3000000338667'
      then jsonb_build_object('withheld_models', jsonb_build_array('Galaxy A27 5G'))
    else '{}'::jsonb
  end
from compatibility_seed as seed
join public.products as product
  on product.sku_code = seed.sku_code
join public.device_models as device
  on device.brand_key = lower(seed.brand)
  and device.normalized_key = seed.normalized_key
join public.suppliers as supplier
  on supplier.code = 'MOBILAX'
on conflict (product_id, device_model_id) do update
set
  source_type = excluded.source_type,
  source_supplier_id = excluded.source_supplier_id,
  source_reference = excluded.source_reference,
  confidence = excluded.confidence,
  review_status = excluded.review_status,
  verified_at = excluded.verified_at,
  note = excluded.note,
  metadata = product_device_compatibilities.metadata || excluded.metadata
where product_device_compatibilities.review_status <> 'rejected';

with offer_seed (
  sku_code,
  supplier_sku,
  ean,
  manufacturer_part_number,
  source_url,
  source_reference,
  last_seen_at
) as (
  values
    ('3000000057810', null::text, '3000000057810', null::text, 'https://www.mobilax.com', 'Mobilax catalog product title snapshot', '2026-07-19 00:00:00+02'::timestamptz),
    ('3000000057827', null::text, '3000000057827', 'BN56', 'https://www.mobilax.com/battery-xiaomi-redmi-9a-redmi-9c-nfc-bn56', 'Mobilax arrival batch CVENMWEBUU8', '2026-05-26 21:36:00+02'::timestamptz),
    ('3000000093085', null::text, '3000000093085', 'BLP805', 'https://www.mobilax.com', 'Mobilax arrival batch CVENMWEBUU8', '2026-05-26 21:36:00+02'::timestamptz),
    ('3000000096659', null::text, '3000000096659', null::text, 'https://www.mobilax.com/touchpanel-lcd-tft-apple-iphone-12-iphone-12-pro-black', 'Mobilax catalog product page', '2026-07-19 00:00:00+02'::timestamptz),
    ('3000000150122', '3000000150122', '3000000150122', null::text, 'https://www.mobilax.com', 'Mobilax arrival batch CVBLUQU8H23', '2026-07-02 13:33:00+02'::timestamptz),
    ('3000000166222', '3000000166222', '3000000166222', null::text, 'https://www.mobilax.com', 'Mobilax arrival batch CVBLUQU8H23', '2026-07-02 13:33:00+02'::timestamptz),
    ('3000000206485', null::text, '3000000206485', 'EB-BM526ABS', 'https://www.mobilax.com', 'Mobilax arrival batch CVENMWEBUU8', '2026-05-26 21:36:00+02'::timestamptz),
    ('3000000207444', null::text, '3000000207444', 'EB-BA426ABY', 'https://www.mobilax.com', 'Mobilax arrival batch CVENMWEBUU8', '2026-05-26 21:36:00+02'::timestamptz),
    ('3000000211663', '3000000211663', '3000000211663', null::text, 'https://www.mobilax.com', 'Mobilax arrival batch C05J9J76369', '2026-05-28 16:43:00+02'::timestamptz),
    ('3000000338667', '3000000338667', '3000000338667', 'EB-BA166ASE', 'https://www.mobilax.com/premium-battery-samsung-galaxy-a16-5g-a166b', 'Mobilax product page and arrival batches CVENMWEBUU8/CVBLUQU8H23', '2026-07-02 13:33:00+02'::timestamptz)
)
insert into public.product_supplier_offers (
  product_id,
  supplier_id,
  supplier_sku,
  ean,
  manufacturer_part_number,
  quality_grade,
  source_url,
  source_reference,
  last_seen_at,
  metadata
)
select
  product.id,
  supplier.id,
  seed.supplier_sku,
  seed.ean,
  seed.manufacturer_part_number,
  product.quality_grade,
  seed.source_url,
  seed.source_reference,
  seed.last_seen_at,
  jsonb_build_object('review_batch', '2026-07-20-high-priority-batch-2')
from offer_seed as seed
join public.products as product
  on product.sku_code = seed.sku_code
join public.suppliers as supplier
  on supplier.code = 'MOBILAX'
on conflict do nothing;

update public.products as product
set compatibility_models = case product.sku_code
  when '3000000057810' then array['Redmi 9A', 'Redmi 9C NFC', 'Redmi 10A']
  when '3000000057827' then array['Redmi 9A', 'Redmi 9C NFC', 'Redmi 10A', 'Redmi A1', 'Redmi A1+']
  when '3000000093085' then array['A53s 2020', 'A74 5G', 'A54 5G', 'A53 4G 2020', 'A16 4G', 'A54s', 'A16s', 'A54 4G']
  when '3000000096659' then array['iPhone 12', 'iPhone 12 Pro']
  when '3000000150122' then array['Galaxy A12', 'Galaxy M12']
  when '3000000166222' then array['Redmi A1', 'Redmi A2', 'Redmi A1+', 'Redmi A2+']
  when '3000000206485' then array['Galaxy M52 5G', 'Galaxy A73 5G', 'Galaxy A23 5G', 'Galaxy M23 5G', 'Galaxy M53 5G', 'Galaxy A23 4G']
  when '3000000207444' then array['Galaxy A42 5G', 'Galaxy A32 5G', 'Galaxy A72 4G', 'Galaxy A72 5G', 'Galaxy M32', 'Galaxy M22']
  when '3000000211663' then array['Galaxy A13 5G', 'Galaxy M13 5G']
  when '3000000338667' then array['Galaxy A16 5G', 'Galaxy A16 4G', 'Galaxy A26 5G', 'Galaxy A17 5G', 'Galaxy A17 4G']
end
where product.sku_code = any(array[
  '3000000057810',
  '3000000057827',
  '3000000093085',
  '3000000096659',
  '3000000150122',
  '3000000166222',
  '3000000206485',
  '3000000207444',
  '3000000211663',
  '3000000338667'
]::text[])
and product.compatibility_models is distinct from case product.sku_code
  when '3000000057810' then array['Redmi 9A', 'Redmi 9C NFC', 'Redmi 10A']
  when '3000000057827' then array['Redmi 9A', 'Redmi 9C NFC', 'Redmi 10A', 'Redmi A1', 'Redmi A1+']
  when '3000000093085' then array['A53s 2020', 'A74 5G', 'A54 5G', 'A53 4G 2020', 'A16 4G', 'A54s', 'A16s', 'A54 4G']
  when '3000000096659' then array['iPhone 12', 'iPhone 12 Pro']
  when '3000000150122' then array['Galaxy A12', 'Galaxy M12']
  when '3000000166222' then array['Redmi A1', 'Redmi A2', 'Redmi A1+', 'Redmi A2+']
  when '3000000206485' then array['Galaxy M52 5G', 'Galaxy A73 5G', 'Galaxy A23 5G', 'Galaxy M23 5G', 'Galaxy M53 5G', 'Galaxy A23 4G']
  when '3000000207444' then array['Galaxy A42 5G', 'Galaxy A32 5G', 'Galaxy A72 4G', 'Galaxy A72 5G', 'Galaxy M32', 'Galaxy M22']
  when '3000000211663' then array['Galaxy A13 5G', 'Galaxy M13 5G']
  when '3000000338667' then array['Galaxy A16 5G', 'Galaxy A16 4G', 'Galaxy A26 5G', 'Galaxy A17 5G', 'Galaxy A17 4G']
end;

do $$
declare
  v_approved_count integer;
  v_offer_count integer;
begin
  select count(*)
  into v_approved_count
  from public.product_device_compatibilities as compatibility
  join public.products as product
    on product.id = compatibility.product_id
  where product.sku_code = any(array[
    '3000000057810',
    '3000000057827',
    '3000000093085',
    '3000000096659',
    '3000000150122',
    '3000000166222',
    '3000000206485',
    '3000000207444',
    '3000000211663',
    '3000000338667'
  ]::text[])
    and compatibility.review_status = 'approved';

  if v_approved_count <> 43 then
    raise exception 'Expected 43 approved compatibility links, found %', v_approved_count;
  end if;

  if exists (
    with expected(sku_code, relation_count) as (
      values
        ('3000000057810', 3),
        ('3000000057827', 5),
        ('3000000093085', 8),
        ('3000000096659', 2),
        ('3000000150122', 2),
        ('3000000166222', 4),
        ('3000000206485', 6),
        ('3000000207444', 6),
        ('3000000211663', 2),
        ('3000000338667', 5)
    ),
    actual as (
      select product.sku_code, count(*)::integer as relation_count
      from public.product_device_compatibilities as compatibility
      join public.products as product
        on product.id = compatibility.product_id
      where compatibility.review_status = 'approved'
        and product.sku_code in (select expected.sku_code from expected)
      group by product.sku_code
    )
    select 1
    from expected
    left join actual using (sku_code)
    where actual.relation_count is distinct from expected.relation_count
  ) then
    raise exception 'Per-product approved compatibility count does not match the reviewed batch';
  end if;

  if exists (
    select 1
    from public.product_device_compatibilities as compatibility
    join public.products as product
      on product.id = compatibility.product_id
    join public.device_models as device
      on device.id = compatibility.device_model_id
    where product.sku_code = '3000000338667'
      and device.normalized_key = 'galaxy-a27-5g'
      and compatibility.review_status = 'approved'
  ) then
    raise exception 'Galaxy A27 5G must remain withheld for SKU 3000000338667';
  end if;

  select count(*)
  into v_offer_count
  from public.product_supplier_offers as offer
  join public.products as product
    on product.id = offer.product_id
  join public.suppliers as supplier
    on supplier.id = offer.supplier_id
  where supplier.code = 'MOBILAX'
    and product.sku_code = any(array[
      '3000000057810',
      '3000000057827',
      '3000000093085',
      '3000000096659',
      '3000000150122',
      '3000000166222',
      '3000000206485',
      '3000000207444',
      '3000000211663',
      '3000000338667'
    ]::text[]);

  if v_offer_count <> 10 then
    raise exception 'Expected 10 Mobilax supplier offers, found %', v_offer_count;
  end if;

  if exists (
    with inventory as (
      select
        sku_code,
        sum(actual_qty)::integer as actual_qty,
        sum(available_qty)::integer as available_qty,
        sum(locked_qty)::integer as locked_qty
      from public.inventory_items
      group by sku_code
    )
    select 1
    from public.products as product
    left join inventory
      on inventory.sku_code = product.sku_code
    where product.sku_code = any(array[
      '3000000057810',
      '3000000057827',
      '3000000093085',
      '3000000096659',
      '3000000150122',
      '3000000166222',
      '3000000206485',
      '3000000207444',
      '3000000211663',
      '3000000338667'
    ]::text[])
      and (
        inventory.sku_code is null
        or product.stock_qty <> inventory.available_qty
        or inventory.actual_qty <> inventory.available_qty + inventory.locked_qty
      )
  ) then
    raise exception 'Target inventory invariant failed after compatibility approval';
  end if;
end;
$$;

notify pgrst, 'reload schema';
