create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_account_type_created_idx
  on public.profiles (account_type, created_at desc);

create index if not exists profiles_email_trgm_idx
  on public.profiles using gin (email extensions.gin_trgm_ops)
  where email is not null;

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name extensions.gin_trgm_ops)
  where display_name is not null;

create index if not exists profiles_role_trgm_idx
  on public.profiles using gin (role extensions.gin_trgm_ops)
  where role is not null;

create index if not exists customers_user_profile_kind_updated_idx
  on public.customers (user_id, profile_kind, updated_at desc)
  where user_id is not null;

create index if not exists orders_active_operations_queue_sort_idx
  on public.orders (
    admin_queue_bucket asc,
    created_at desc,
    admin_status_rank asc,
    order_no desc
  )
  where soft_deleted_at is null;

create index if not exists orders_active_order_no_trgm_idx
  on public.orders using gin (order_no extensions.gin_trgm_ops)
  where soft_deleted_at is null and order_no is not null;

create index if not exists orders_active_customer_name_trgm_idx
  on public.orders using gin (customer_name extensions.gin_trgm_ops)
  where soft_deleted_at is null and customer_name is not null;

create index if not exists orders_active_staff_note_trgm_idx
  on public.orders using gin (staff_note extensions.gin_trgm_ops)
  where soft_deleted_at is null and staff_note is not null;
