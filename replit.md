# Motorcycle ERP, POS & Public Website

## Overview
A comprehensive multi-warehouse motorcycle dealership system with:
- **Public website** (`/`) — Bilingual (EN/AR) storefront with live inventory from Supabase
- **ERP admin** (`/admin/`) — Full-featured ERP & POS system

Built with React + Vite frontends, Supabase BaaS (no Express API server).

## Architecture
- **Public Website**: `artifacts/moto-website` — React + Vite (port 26117), bilingual EN/AR, RTL support, reads from Supabase directly
- **ERP Admin**: `artifacts/moto-erp` — React + Vite + TypeScript + Tailwind CSS + shadcn/ui (port 23231, base /admin/), all CRUD via Supabase
- **Backend**: Supabase (PostgreSQL + Row Level Security + Auth + RPC functions)
- **Routing**: Wouter (frontend)
- **State**: React Query for server state

## Supabase Configuration
- Project URL: `https://dswchcyrltxtymvnpkdl.supabase.co`
- Client setup: `artifacts/moto-erp/src/lib/supabase.ts` and `artifacts/moto-website/src/lib/supabase.ts`
- Auth: Supabase email/password auth, profiles table stores role
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (system env), `SUPABASE_SERVICE_ROLE_KEY` (for server-side)

## Auth (ERP)
- Supabase Auth (email + password)
- Profiles table: `profiles(id, username, full_name, role, email, is_active)`
- Roles: `admin`, `storekeeper`, `technician`, `sales`
- Demo accounts:
  - admin@motoshop.com / Admin1234!
  - ali@motoshop.com / Store1234!
  - rahman@motoshop.com / Tech1234!
  - siti@motoshop.com / Sales1234!

## ERP Pages (all migrated to Supabase)
1. **LoginPage** — Supabase auth.signInWithPassword
2. **Dashboard** — KPIs + recharts analytics via Supabase queries
3. **Warehouses** — Multi-warehouse management with bin locations
4. **Categories / Subcategories** — Parts category hierarchy
5. **MotorcycleCategories / Subcategories / Brands** — Motorcycle taxonomy
6. **Parts** — Inventory with SKU, stock, subcategory→category join
7. **Motorcycles** — New + pre-owned with full spec fields, brand/subcategory join
8. **Vendors** — Supplier management
9. **Purchase Orders** (PO-XXXX) — Creation + confirm workflow
10. **GRN** (GRN-XXXX) — Goods received, increments parts stock, marks PO received
11. **Work Orders** (WO-XXXX) — Service tracking, status: draft→pending→in_progress→parts_reserved→completed/cancelled
12. **POS** — Cart + checkout: creates invoice, decrements stock, marks motorcycle sold
13. **Invoices** (INV-XXXX) — Read-only with PDF+QR download
14. **Returns** — Invoice return processing
15. **Inspections** — Pre-owned motorcycle inspection reports with grade
16. **Users** — User management (Admin only)
17. **Audit Log** — Full audit trail
18. **Settings** — Account info, change password, theme
19. **WebsiteCMS** — Edit site_settings key-value store

## Key DB Conventions
- All DB fields: **snake_case** (e.g. `quantity_on_hand`, `selling_price`)
- All frontend state: **camelCase** (mapped in `mapX()` helpers)
- `parts` has NO direct `category_id`; joins via `subcategory_id → subcategories(category_id) → categories`
- `work_order_status` enum: draft, pending, in_progress, parts_reserved, completed, cancelled
- `work_orders.assigned_to` is UUID (auth.users) — technicians queried from `profiles(role='technician')`
- `inspections.image_urls` is `TEXT[]` — inserted as `[]` (Storage bucket not configured)
- `site_settings` is a key-value table: `(id, key, value)` — fetched and converted to flat object for frontend

## Document Numbers
All generated via Supabase RPC: `supabase.rpc('next_document_number', { p_prefix: 'PO' })`
- PO-XXXX, GRN-XXXX, WO-XXXX, INV-XXXX, RET-XXXX

## Public Website Routes
- `/` — Home (hero, featured products)
- `/showroom` — Product grid (motorcycles + parts, read from Supabase)
- `/about` — About us with dynamic content from site_settings
- `/contact` — Contact form (inserts into contact_submissions table)
- `/signin` — Supabase auth → redirects to `/admin/`

## Public Website Data Access
All data in `artifacts/moto-website/src/lib/api.ts` uses Supabase client directly.
Public RLS policies allow `SELECT` without auth on: categories, subcategories, motorcycle_*, parts, motorcycles, site_settings.

## RBAC (ERP)
- **Admin**: Full access
- **Storekeeper**: Dashboard, Parts, Warehouses, Vendors, Purchase Orders, GRN
- **Technician**: Dashboard, Work Orders, Inspections
- **Sales**: Dashboard, Motorcycles, POS, Invoices, Returns

## Currency Format
Malaysian Ringgit (RM X,XXX.XX)

## Business Rules
- Stock decrement on POS checkout (per-part loop)
- Motorcycle status → "sold" on checkout
- Work-order transitions enforced client-side via VALID_TRANSITIONS map
- GRN submission increments `parts.quantity_on_hand` and updates bin_id

## Workflows
- `artifacts/moto-erp: web` — React Vite ERP (port 23231, /admin/)
- `artifacts/moto-website: web` — React Vite public site (port 26117, /)
- `artifacts/api-server: API Server` — Legacy Express (port 8080, still running for dashboard analytics)
