# PartsPro

Italy-focused B2B smartphone spare-parts storefront and operations dashboard.

## Tech Stack

- Next.js 16.2.6 App Router
- TypeScript
- TailwindCSS v4
- shadcn/ui with Radix UI
- Supabase SSR client helpers
- TanStack Table
- React Hook Form + Zod
- Framer Motion
- Lucide React
- Recharts

## Agent and Operations Rules

- Repository-wide agent rules live in `AGENTS.md`. `CLAUDE.md` points to the same file through `@AGENTS.md`.
- Reusable sub-agent profiles live in `docs/agents/`.
- AI department task workflow lives in `docs/tasks/`.
- Supabase migration safety rules live in `docs/PartsPro 代理协作与迁移护栏.md`.
- Treat the linked Supabase project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4` as production-sensitive. Do not apply linked migrations unless the migration safety gate passes.

## Routes

- `/` storefront home: Italian B2B entry, categories, recommended products, cart preview
- `/catalogo` catalog: brand, model, category, warehouse and stock filtering UI
- `/prodotto/[sku]` product detail: compatibility, B2B price gate, MOQ, RMA, stock and logistics
- `/carrello` cart: quantities, IVA, shipping and order summary
- `/checkout` checkout: company data, e-invoice fields, shipping address and payment choice
- `/account` customer area: company data, orders, RMA and documents
- `/rma` RMA: return request form, attachment placeholder and status timeline
- `/admin` dashboard: KPI cards, charts, inventory table, add-product dialog and stock alerts

## API Routes

- `GET /api/catalogo` Supabase-aware catalog API with strict query validation, pagination and sorting. If Supabase is unavailable, it returns an empty result instead of local sample data.
- `GET/POST /api/orders` Supabase-aware order API with company, SKU, MOQ and stock validation. Order totals are always recalculated server-side, and unknown client money fields are rejected.
- `GET/POST /api/rma` Supabase-aware RMA listing and creation API with Zod validation. Writes require a configured Supabase session.
- `POST /api/b2b-applications` B2B onboarding application endpoint. It writes to the remote `b2b_applications` table and fails closed when Supabase is not configured.

## Supabase

The local database reference lives in `supabase/schema.sql`, but it is only a
snapshot. The linked database migration state must be checked with:

```bash
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
```

When a task adds or changes `supabase/migrations/*.sql`, follow
`docs/PartsPro 代理协作与迁移护栏.md`. Automatic linked migration application is
allowed only when the dry-run contains only the current task's migration and all
safety checks pass. Do not use `--include-seed`, `--include-all`, `migration repair`,
or `db reset --linked` unless explicitly authorized.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The Supabase helpers are in `src/lib/supabase`.

## Google Login

Google OAuth uses Supabase Auth with the SSR PKCE callback at
`/auth/callback`. Enable the Google provider in the Supabase dashboard, add the
Google Client ID and Client Secret there, and allow this redirect URL:

```bash
https://parts-pro-v4.vercel.app/auth/callback
```

For local development, also allow:

```bash
http://localhost:3000/auth/callback
```

## WeChat Login

WeChat login uses a Supabase Custom OAuth provider named `custom:wechat`. The
app starts the flow at `/auth/wechat` and reuses the SSR PKCE callback at
`/auth/callback`.

The login entry is hidden by default. Enable it only when the provider is ready:

```bash
PARTSPRO_ENABLE_WECHAT_LOGIN=true
```

In Supabase Auth Providers, create a Custom OAuth provider with:

```bash
Identifier: custom:wechat
Scopes: snsapi_login
Authorization URL: https://open.weixin.qq.com/connect/qrconnect
Token URL: https://api.weixin.qq.com/sns/oauth2/access_token
UserInfo URL: https://api.weixin.qq.com/sns/userinfo
Email optional: enabled
```

Add the WeChat Open Platform app ID and secret as the provider Client ID and
Client Secret. Copy the provider Callback URL shown by Supabase into the WeChat
Open Platform website application settings. Also keep the app callback URL
allowed in Supabase:

```bash
https://parts-pro-v4.vercel.app/auth/callback
http://localhost:3000/auth/callback
```
