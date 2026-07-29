# Alibaba Logistics & Transportation — Backend (alibaba-api)

## What this is
Next.js 15 API routes powering a LIVE Nigerian transport platform (car rental,
interstate bus booking, event/VIP charter, driver portal, admin panel). Real
paying customers use this daily — treat every change as production-critical.

## Stack
- Next.js 15 API routes on Vercel (alibaba-api.vercel.app)
- PostgreSQL on Supabase, SESSION pooler port 5432 — never the 6543 transaction
  pooler, it's IPv6-only and breaks on Vercel
- Supabase Storage for uploads (receipts, car images/videos) — private buckets,
  signed URLs
- Paystack (online) + manual bank transfer (parallel payment method)
- Deps: pg, bcryptjs, jsonwebtoken
- GitHub: Governor-HQ/alibaba-api, branch main. Solo dev — force-push to main is safe.

## Auth & permissions
- Admin routes use `requireAdmin(request, 'PERM')` from lib/admin-auth.js —
  re-checks the DB every call, so suspensions/permission changes apply instantly.
  Super admin bypasses all permission checks.
- Use `hasPerm(admin, 'perm')` for extra in-route permission checks.
- EVERY mutating admin action (create/update/delete/cancel/undo) MUST call
  `logAdminAction(admin, action, detail)` — this is the audit trail, not optional.
- Grantable permissions live in admin.html's GRANTABLE_PERMS — if you add a new
  gated action, add the permission there too and flag it in your summary.

## Payment reference prefixes
Car = ALB-PAY-, Bus = ALB-BUS-, Charter = ALB-CHT-. Always generate via
makeRef() in lib/ref.js (cryptographically random, unguessable).

## Conventions
- Diagnose root cause before writing code. State your plan briefly before changing files.
- Surgical fixes over rewrites — don't touch working code you don't need to.
- Syntax-check every route file before finishing:
  `node --input-type=module --check < path/to/route.js`
- SQL migrations go in their own .sql file at repo root (e.g. feature-schema.sql),
  using `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` so they're safe
  to re-run. NEVER write a migration that drops or truncates existing data.
- This is a LIVE site — never risk losing, corrupting, or exposing real bookings,
  payments, or user data.

## When you're done
Summarize exactly what changed and why, list every file touched, state whether a
SQL migration needs to run (give its exact contents) and whether it must run
before or after the code deploy.