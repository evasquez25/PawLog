# Phase 5 — Backend API

## Outcome

The API implements household setup and administration, invitations, pets, activity types, profile updates, latest activities, and append-only activity logging. The frontend remains the Phase 3 sample dashboard plus the real Phase 4 account page; these endpoints are connected to the care screens in Phase 6.

## Database update required

Apply only `supabase/migrations/20261016000200_api_operations.sql` to the configured Supabase project, after the foundation migration already applied. Use `npx supabase db push --dry-run` and then `npx supabase db push` if the project is linked, or execute the entire new migration in the project's SQL editor. Do not rerun the foundation migration, and do not apply local seed data to your hosted project.

This new migration adds the household feeding-warning interval (15 minutes by default, 0 disables it), admin pet/household mutations, atomic activity creation, and efficient latest-activity retrieval. No remote schema or real household data was changed during this phase.

## How the API works

All endpoints below require a Supabase Bearer token. Express verifies identity and checks household membership or admin role before accessing scoped data. Database functions independently enforce permissions and validation; browser-supplied identities never determine the authenticated logger.

| Method      | Path                                 | Result                                                        |
| ----------- | ------------------------------------ | ------------------------------------------------------------- |
| GET / PATCH | `/api/me`                            | Account summary / update own display name                     |
| GET / POST  | `/api/households`                    | List memberships' households / create household and defaults  |
| GET / PATCH | `/api/households/:id`                | Read / admin update name or feeding-warning interval          |
| GET         | `/api/households/:id/members`        | Member IDs, display names, roles                              |
| POST        | `/api/households/:id/invitations`    | Admin-only, one-time code, 48-hour lifetime                   |
| POST        | `/api/invitations/redeem`            | Join by valid, unused invitation                              |
| GET / POST  | `/api/households/:id/pets`           | List / admin create pet                                       |
| GET / PATCH | `/api/pets/:id`                      | Read / admin update pet                                       |
| GET         | `/api/households/:id/activity-types` | Active care types in display order                            |
| GET         | `/api/pets/:id/latest-activities`    | One latest completion per active type, null if never recorded |
| POST        | `/api/pets/:id/activities`           | Idempotent activity submission                                |

Success uses `{ "data": ... }`; errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation errors include field paths. Inaccessible pets/households return 404, member attempts at admin operations return 403, and unapplied RPC migrations return 503 with `MIGRATION_REQUIRED`. SQL details and invitation codes are not logged. API responses use `Cache-Control: no-store`.

## Activity contract

`POST /api/pets/:id/activities` requires a UUID `Idempotency-Key` header and this body:

```json
{
  "activity_type_id": "UUID from the household activity types",
  "performed_by": "UUID of a member of this household",
  "performed_at": "2026-10-15T18:30:00-04:00",
  "notes": "Optional, at most 280 characters",
  "allow_recent": false
}
```

The UUID descriptions above explain the fields; use actual UUIDs. Completion time must include a timezone and cannot be in the future. The server takes `logged_by` from verified identity; supplying it in the body is rejected. Notes default to an empty string and `allow_recent` defaults to false.

A successful new log returns 201 with `{ data: { log, replayed: false } }`. A retry of the same actor/key/payload returns the original log with status 200 and `replayed: true`. Reusing the key for different pet, type, performer, time, or notes returns 409 `IDEMPOTENCY_CONFLICT`.

A recent feeding returns 409 `RECENT_FEEDING`, including the latest completion and warning interval. No log is inserted. Keep the same submission key and original body, and resend with `allow_recent: true` only after the person explicitly chooses Log Anyway. Network retries must retain both that key and the original timestamp. Closely spaced non-feeding activities remain allowed.

## Important decisions

- A transaction-scoped advisory lock serializes an actor's idempotency key, including reuse across pets. A pet row lock serializes new inserts before testing recent feeding. Locks release automatically at transaction end.
- Latest activity is selected by `performed_at`, then `created_at` and ID for deterministic ties. Old records are preserved; entering yesterday's walk cannot replace today's walk.
- Latest-activity retrieval uses an indexed lateral query rather than transferring history. Every active type remains present, even without a completion.
- Invitation codes contain 32 random bytes, encoded as base64url. Only a SHA-256 hash is stored; the code is returned once. Durable database redemption limits remain 10 attempts per user per 15 minutes, with a 429 response and retry guidance. Invalid codes don't disclose a household.
- Pet photos are optional HTTPS URLs. An omitted photo in a patch retains it; an explicit null clears it. No upload service was introduced.
- Mutations return one record consistently even when PostgREST represents a composite result as a one-row array.

References: [PostgreSQL advisory locks](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS), [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [PostgREST RPC response types](https://docs.postgrest.org/en/v16/references/api/functions.html).

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from the repository root. Database tests apply both migrations to embedded PostgreSQL and exercise authorization, admin mutations, invitations, idempotent replay, changed-payload conflicts, recent-feeding override/configuration, append-only backdating, input limits, and latest/empty states. API tests exercise Express with a stubbed database client; they validate HTTP contracts and independent API permission checks, not hosted PostgREST.

`npm run test:concurrency` is a separate optional multi-connection PostgreSQL test. It initializes its own disposable temporary cluster, checks simultaneous duplicate logs, competing feedings, and invitation redemptions, then stops and deletes only that cluster. It requires `initdb`, `pg_ctl`, and `psql` on PATH; optional `PAWLOG_INITDB`, `PAWLOG_PG_CTL`, and `PAWLOG_PSQL` variables can point at their executables. It never connects to the hosted project or an existing cluster.

The local PostgreSQL installation was found, but its cluster startup failed because the managed environment denied shared-memory allocation (`shmget`). Therefore multi-connection race assertions are prepared but have not run successfully. Embedded tests validate transaction logic and sequential retries; they do not prove cross-connection scheduling. Hosted acceptance and migration application remain pending.

After applying the migration, verify using your own signed-in account: create a household, list its four defaults, create a pet as admin, log a completion twice with one key, confirm the replay, and try a second feeding with a new key. Use another household account to verify isolation. Phase 6 supplies these user-facing flows; no developer token needs to be pasted into chat.

## Files changed

Added:

- `supabase/migrations/20261016000200_api_operations.sql`
- `apps/api/src/routes/pawlog.ts`
- `apps/api/src/services/pawlog.ts`
- `apps/api/src/lib/errors.ts`
- `apps/api/tests/pawlog.test.ts`
- `scripts/test-concurrency.mjs`
- `docs/phase-5.md`

Updated: shared Zod schemas/types and exports, Express app factory/error wiring, database regression tests, root test scripts, and README. No frontend flows were changed.

## Next milestone

Apply the new migration and confirm this phase. Phase 6 then connects the real household, pets, settings, and care dashboard to these endpoints, replacing prototype data for signed-in users. Realtime remains Phase 7.

Final standard verification: all 50 automated tests passed across four files; TypeScript, ESLint, formatting, and production builds passed. The build retains the existing frontend bundle-size advisory. The optional separate-connection PostgreSQL test remains blocked by shared-memory restrictions and is not included in the passing count.

Hosted migration follow-up: Supabase recognized the new feeding-warning column and all five Phase 5 RPC signatures. Anonymous probes were denied with PostgreSQL permission errors (42501), confirming the functions are registered and not executable anonymously. No authenticated mutation or real household data change was performed. Hosted functional and race checks still remain separate from this schema/access verification.
