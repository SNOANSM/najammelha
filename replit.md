# نجمّلها

منصة كويتية مجتمعية للإبلاغ عن مشاكل الأماكن العامة، متابعة معالجتها، وكسب نقاط للمساهمة في جعل الكويت أجمل.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/najammelha` — the Arabic RTL React/Vite application and its civic visual system.
- `artifacts/api-server` — Express API routes for reports, dashboard data, admin overview, and image uploads.
- `lib/api-spec/openapi.yaml` — source of truth for the API contract and generated client hooks.
- `lib/db/src/schema/najammelha.ts` — PostgreSQL/Drizzle tables for users, reports, categories, locations, points, and notifications.
- `attached_assets` — source brand assets supplied for the product.

## Architecture decisions

- The web app is Arabic-first and RTL, with a restrained civic palette derived from Kuwaiti identity rather than a government portal aesthetic.
- Report image uploads use Replit App Storage presigned URLs; PostgreSQL stores the returned object path with report metadata.
- Development ships with clearly marked seeded demo data so the platform has meaningful content on first run.
- Accounts use PostgreSQL-backed sessions and scrypt password hashes; the seeded admin area is separate from normal user accounts.
- API contracts are OpenAPI-first and generated hooks are consumed by the React client.

## Product

Users can browse and filter community reports, support reports, submit a photo-backed report through a short flow, choose browser geolocation or enter a place name, follow notifications and points in their dashboard, and manage report statuses from the separate admin area.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI contract.
- The web build command needs workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for local preview.
- Uploaded report images are private object paths and should be served through the API storage route.
- The default development admin login is `admin@najammelha.kw` with password `Najammelha@2026`; set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before public deployment.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
