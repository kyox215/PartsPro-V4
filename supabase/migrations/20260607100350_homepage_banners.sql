create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_path text not null,
  image_alt text not null,
  target jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_banners_title_not_blank check (length(btrim(title)) > 0),
  constraint homepage_banners_image_path_not_blank check (length(btrim(image_path)) > 0),
  constraint homepage_banners_image_alt_not_blank check (length(btrim(image_alt)) > 0),
  constraint homepage_banners_target_object check (jsonb_typeof(target) = 'object'),
  constraint homepage_banners_position_nonnegative check (position >= 0),
  constraint homepage_banners_publish_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists homepage_banners_public_idx
  on public.homepage_banners (position asc, created_at desc)
  where deleted_at is null and is_active;

create index if not exists homepage_banners_admin_idx
  on public.homepage_banners (deleted_at, position asc, updated_at desc);

alter table public.homepage_banners enable row level security;

grant select on public.homepage_banners to anon, authenticated;
grant insert, update, delete on public.homepage_banners to authenticated;

do $$
begin
  drop policy if exists "partspro_homepage_banners_public_select" on public.homepage_banners;
  drop policy if exists "partspro_homepage_banners_staff_select" on public.homepage_banners;
  drop policy if exists "partspro_homepage_banners_staff_insert" on public.homepage_banners;
  drop policy if exists "partspro_homepage_banners_staff_update" on public.homepage_banners;
  drop policy if exists "partspro_homepage_banners_staff_delete" on public.homepage_banners;

  create policy "partspro_homepage_banners_public_select"
    on public.homepage_banners
    for select
    to anon, authenticated
    using (
      deleted_at is null
      and is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    );

  create policy "partspro_homepage_banners_staff_select"
    on public.homepage_banners
    for select
    to authenticated
    using ((select private.is_staff()));

  create policy "partspro_homepage_banners_staff_insert"
    on public.homepage_banners
    for insert
    to authenticated
    with check ((select private.partspro_has_permission('product.image_manage')));

  create policy "partspro_homepage_banners_staff_update"
    on public.homepage_banners
    for update
    to authenticated
    using ((select private.partspro_has_permission('product.image_manage')))
    with check ((select private.partspro_has_permission('product.image_manage')));

  create policy "partspro_homepage_banners_staff_delete"
    on public.homepage_banners
    for delete
    to authenticated
    using ((select private.partspro_has_permission('product.image_manage')));
end
$$;

do $$
begin
  drop policy if exists "partspro_banner_images_staff_select" on storage.objects;
  drop policy if exists "partspro_banner_images_staff_insert" on storage.objects;
  drop policy if exists "partspro_banner_images_staff_update" on storage.objects;
  drop policy if exists "partspro_banner_images_staff_delete" on storage.objects;

  create policy "partspro_banner_images_staff_select"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'banners/%'
      and (select private.is_staff())
    );

  create policy "partspro_banner_images_staff_insert"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'product-images'
      and name like 'banners/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );

  create policy "partspro_banner_images_staff_update"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'banners/%'
      and (select private.partspro_has_permission('product.image_manage'))
    )
    with check (
      bucket_id = 'product-images'
      and name like 'banners/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );

  create policy "partspro_banner_images_staff_delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'banners/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );
end
$$;
