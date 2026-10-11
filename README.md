# Smart Home Dashboard

[![CI](https://github.com/brian7952002/smart-home-dashboard/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/brian7952002/smart-home-dashboard/actions/workflows/ci.yml)

A mobile-first smart-home management **demo**. It shows a simulated home with a floor plan, rooms, devices, scenes, automations, device health, and AI-assisted troubleshooting. Simulated state lives in PostgreSQL.

The full specification is in [docs/smart-home-dashboard-design.md](docs/smart-home-dashboard-design.md).

> **Nothing here controls real hardware.** Power, brightness, temperature, and reconnect only change simulated records. Scenarios and automations are saved records that never run. There are no user accounts.

## Requirements

- **Node.js 22.12 or later.** Current releases of the OpenAI SDK, Vitest, and Vite require it, and Node 20 is end-of-life.
- **Docker Desktop**, for the local PostgreSQL 16 container. Any PostgreSQL 14+ works if you set `DATABASE_URL` yourself.
- Optional: an OpenAI API key. Without one, the AI features use built-in offline guidance.

## Quick start

```bash
npm ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

Open http://localhost:5000. On first start the server seeds the demo data: 4 rooms, 10 devices, 3 scenarios, and 2 automations. On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## Scripts

| Script | What it does |
|---|---|
| `npm run db:up` / `db:down` | Start or stop the Postgres container (`docker compose`) |
| `npm run db:migrate` | Apply the committed SQL migrations in `migrations/` |
| `npm run db:seed` | Seed demo data, only if there are no rooms |
| `npm run db:reset` | Wipe all tables and reseed (restores the demo state) |
| `npm run db:generate` | Generate a new migration after changing `shared/schema.ts`; commit the result |
| `npm run db:push` | Push the schema directly, for local prototyping only (never in CI or production) |
| `npm run dev` | Express API + Vite dev server with hot reload on one port (`PORT`, default 5000) |
| `npm run check` | TypeScript typecheck |
| `npm run lint` | ESLint |
| `npm test` | API tests (Vitest + Supertest) against `TEST_DATABASE_URL` |
| `npm run test:e2e` | Production build, then Playwright UI tests at 390×844 and 1280×800 |
| `npm run build` | Build the client to `dist/public` and bundle the server to `dist/index.js` |
| `npm start` | Run the production build (serves the API and the client from one origin) |

Before the first `npm run test:e2e`, install the test browser with `npx playwright install chromium`.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string. The server exits with a clear message if it's missing or unreachable; there's no in-memory fallback. |
| `TEST_DATABASE_URL` | for tests | — | A **separate** database; tests wipe it. The Compose container creates `smarthome_test` for this. |
| `PORT` | no | `5000` | HTTP port |
| `OPENAI_API_KEY` | no | empty | Enables AI answers. Read only on the server, never sent to the browser or written to logs. |
| `OPENAI_MODEL` | no | `gpt-4o` | Model for diagnosis, guide, and chat |
| `AI_RATE_LIMIT_PER_MIN` | no | `20` | Per-IP limit on `/api/ai/*` |
| `ENABLE_DEMO_ENDPOINTS` | no | `false` | Registers `POST /api/devices/:id/simulate-error` and `POST /api/demo/reset`, and shows the demo tools in the UI. `.env.example` turns it on for local use. |
| `SEED_ON_START` | no | `true` | Seed demo data at startup when the database has no rooms |

## Production

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

`npm start` sets `NODE_ENV=production`, serves `dist/public`, and handles client-side routes. Set real environment variables on the host instead of using `.env`.

> **Security warning:** there's no authentication. Anyone who can reach the server can change all data and spend your OpenAI quota. Run it locally or behind your own access control, and keep `ENABLE_DEMO_ENDPOINTS` off anywhere shared.

## How it works

- **Stack:**
  - Client: React 19, TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS 4, Radix primitives, Lucide icons, Sonner toasts.
  - Server: Express 5, Zod validation, Drizzle ORM on `pg`.
  - AI: OpenAI SDK, server-side only.
- **Layout:**
  - `client/`: the React app.
  - `server/`: the Express app, services, and AI layer.
  - `shared/`: the Drizzle schema, Zod schemas, types, and status/geometry helpers used by both sides.
  - `migrations/`: committed SQL migrations.
  - `tests/`: API and end-to-end tests.
- **Floor plan:** rooms live on a fixed 350 × 450 logical plane that the client scales to fit, so saved positions work at any screen width. Rooms can't overlap or leave the plan, and layout saves are all-or-nothing.
- **Device rules:**
  - Offline or errored devices can't be powered or adjusted.
  - Reconnect brings an offline device back online and clears errors marked fixable.
  - Errors that need manual troubleshooting return a clear explanation, and the device's state is left unchanged.
  - Every change is recorded in a simulated activity log.
- **AI:**
  - Diagnosis, the support guide, and chat are `POST` endpoints, rate-limited, with successful answers cached by device state.
  - Prompts include only the device type, manufacturer, model, firmware, and state, never device or room names.
  - Model output is validated. Any failure (no key, timeout, invalid output) falls back to built-in guidance labeled "Offline guidance".
- **Manufacturer support links:** each link in `shared/supportLinks.ts` was checked on 2026-10-11 and leads to an official support site. Re-verify before changing them.

## Troubleshooting

- **"Cannot connect to PostgreSQL":** start Docker Desktop, then run `npm run db:up`. Check that nothing else is using port 5432.
- **"Database tables are missing":** run `npm run db:migrate`.
- **`smarthome_test` doesn't exist:** the init script only runs when the Docker volume is first created. Create the database with `docker compose exec db psql -U postgres -c "CREATE DATABASE smarthome_test"`.
- **Port 5000 is busy** (e.g. AirPlay on macOS): set `PORT` in `.env`.
