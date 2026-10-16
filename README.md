# PawLog

Happy pets. Happy households.

[Open the app](https://pawlog-flame.vercel.app)

PawLog helps a household see the latest feeding, potty break, walk, and bath for each pet. Members share care records in near real time. Administrators manage pets, household settings, and invitations. Users can belong to multiple independent households.

## Status

Phases 1–8 are complete. The user confirmed production sign-in and launching the installed home-screen app. Phase 9 adds reliability and accessibility fixes, regression tests, responsive checks, and this handoff documentation. See [the phase report](docs/phase-9.md) for evidence and limits.

`/app` is the real, authenticated application. `/demo` is a separate sample household that stores no server records.

## Local setup

Use Node 22.12 or newer in the Node 22 line and npm 10 or newer. `.nvmrc` selects Node 22.

```sh
npm ci
```

Copy `apps/web/.env.example` to `apps/web/.env` and `apps/api/.env.example` to `apps/api/.env`. Supply your Supabase project URL and public publishable key. Follow [Supabase setup](docs/supabase-setup.md) and apply all three migrations in filename order. For the existing hosted project, those migrations have already been applied; do not reset its database.

```sh
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). The API defaults to http://127.0.0.1:3001/api/health. If that port is occupied, change `PORT` in the API environment and `API_PROXY_TARGET` in the web environment to the same API address. The current local setup uses frontend port 5174 and API port 3002.

Vite forwards `/api` to Express during development. Both processes stop with Ctrl+C. To run them separately, build shared first (`npm run build -w @pawlog/shared`), then run each workspace's `dev` command. Rebuild shared after modifying its schemas.

## Architecture

- `apps/web`: React/TypeScript, Vite, Tailwind, React Router, TanStack Query and reusable UI components.
- `apps/api`: Express/TypeScript API, authenticated Supabase access and Zod validation. The local listener is separate from the exported app.
- `packages/shared`: request/response schemas and inferred types.
- `api/[...path].ts`: Vercel Function adapter; production does not start a listening server.
- `supabase/migrations`: reproducible PostgreSQL schema, RLS, transactional RPCs and realtime publication.
- `supabase/tests`: embedded PostgreSQL tests of migrations and authorization.
- `docs`: setup, phase reports, deployment and testing instructions.

Supabase Auth manages sessions. The client forwards its token to Express; Express verifies the identity and calls user-scoped database operations. PostgreSQL independently enforces membership and administrator permissions. The browser has no service-role key. Realtime notifications trigger authoritative API refetches rather than directly replacing care records.

Care logs are append-only. An idempotency key lets an uncertain activity save be retried without creating another record. A recent-feeding warning requires an explicit override. Invitation codes are single-use, expire after 48 hours and are stored only as hashes.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

The 84 tests cover API authentication/contracts, input validation, household permissions, real SQL constraints/RLS/RPCs in an embedded PostgreSQL engine, activity retries, feeding conflicts, protected routes, realtime lifecycle and PWA cache/update behavior. See [testing instructions](docs/testing.md) for browser/device acceptance and the scope of those results.

`npm run test:concurrency` is an optional separate multi-connection PostgreSQL check requiring usable local PostgreSQL binaries and permission to initialize a temporary cluster. It is not part of the 84 passing tests and was blocked by shared-memory restrictions in this environment.

Builds create ignored `dist` folders. `npm run format` formats source. Shared builds first because its consumers use the emitted package exports.

## Production deployment

The Vercel project is `evasquez25s-projects/pawlog`, with repository root as its root directory, framework Other, Node 22.x, build `npm run build`, and output `apps/web/dist`. Frontend and API share one HTTPS origin. See [Phase 8 deployment details](docs/phase-8.md).

Vercel Production and Preview have these values configured:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

`VITE_` values are public and embedded at build time. Never use a service-role key there. Local environment files are excluded from deployment. Configuration changes require redeployment.

```sh
npx vercel@64.3.1 --prod
```

Supabase Site URL is `https://pawlog-flame.vercel.app`; the allowed production redirect is `https://pawlog-flame.vercel.app/app`. Keep your exact local development callback too. This deployment uses local source; a GitHub repository and automatic Git deployments have not been connected.

## Installation and offline behavior

Install from Safari's Share → Add to Home Screen on iPhone/iPad, or Chrome's Install app/Add to home screen menu on Android. Settings includes instructions and an install button when the browser makes it available.

The service worker caches static app files only. API responses, Supabase data and user photos are not cached. Offline writes are disabled and never queued. A cold offline launch can load the app shell but cannot load household records. An app update prompts before refreshing; finish any open care entry before selecting Update now.

## Known limits

The MVP has no activity history UI, reminders, notifications, offline synchronization, or account recovery screen. Password reset and production custom SMTP remain follow-up work. Free hosting is subject to provider quotas and possible Supabase inactivity pauses; see the deployment report. The accessibility checks are focused checks, not a formal conformance certification.

For future changes, keep migrations append-only, preserve existing household data, run the checks above, deploy, and confirm the production health endpoint and protected routes. Use the separate demo for exploratory UI changes and record actual household care only when appropriate.
