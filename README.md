# PartsPro

Italy-focused B2B smartphone spare-parts storefront and operations dashboard.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- TailwindCSS v4
- shadcn/ui with Radix UI
- Supabase SSR client helpers
- TanStack Table
- React Hook Form + Zod
- Framer Motion
- Lucide React
- Recharts

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

The local database documentation lives in `supabase/schema.sql`. It reflects the
current remote v4 table names inspected read-only on 2026-05-24, including
`products`, `inventory_items`, `customers`, `orders`, `order_lines`,
`rma_requests`, `b2b_applications`, `profiles`, and related pricing/catalog
tables.

Pending migration draft: `supabase/migrations/20260524133225_harden_partspro_relations.sql`.
It has not been applied to the remote database. The draft adds profile to
customer/company links, staff role helpers, guarded B2B price visibility through
catalog views, order integrity constraints plus an authenticated order creation
RPC, and stricter RMA linkage to `order_lines` with quantity, attachment, and
status checks.

Apply this migration only after review and after catalog clients are ready to
read public catalog data from `catalog_public_summary` and buyer prices from
`catalog_buyer_prices`, because the draft narrows direct `products` SELECT
grants for `anon` and `authenticated`.

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
