create or replace function private.customer_effective_level(
  _level text,
  _tier text,
  _lifetime_spend_net numeric,
  _promo_level text,
  _promo_level_starts_at timestamptz,
  _promo_level_expires_at timestamptz,
  _as_of timestamptz default now()
)
returns text
language sql
stable
set search_path = private, public, pg_temp
as $$
  select case
    when _promo_level is not null
      and _promo_level_starts_at is not null
      and _promo_level_expires_at is not null
      and _as_of >= _promo_level_starts_at
      and _as_of < _promo_level_expires_at
      then private.normalize_customer_tier(_promo_level)
    when _promo_level is not null
      and _promo_level_expires_at is not null
      and _as_of >= _promo_level_expires_at
      then private.customer_level_for_spend(coalesce(_lifetime_spend_net, 0))
    else private.normalize_customer_tier(coalesce(_level, _tier, 'bronze'))
  end
$$;

comment on function private.customer_effective_level(text, text, numeric, text, timestamptz, timestamptz, timestamptz) is
  'Returns the customer level currently used for pricing. Active promo levels override stored/manual levels; expired promos fall back to spend-based level.';
