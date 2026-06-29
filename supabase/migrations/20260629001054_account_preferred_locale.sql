alter table public.profiles
  add column if not exists preferred_locale text;

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_preferred_locale_check;

  alter table public.profiles
    add constraint profiles_preferred_locale_check
    check (preferred_locale is null or preferred_locale in ('it-IT', 'zh-CN'));
end $$;

comment on column public.profiles.preferred_locale is
  'Account-wide default UI language for PartsPro. Null falls back to the request cookie or scope default.';
