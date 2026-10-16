# Phase 4 — Database and authentication

## Implemented

- Versioned schema for profiles, households, members, pets, activity types, append-only activity logs, and hashed expiring invitations.
- Composite household foreign keys, latest-activity index, idempotency-key uniqueness, timestamp/name/note constraints, profile creation trigger, and updated-at triggers.
- RLS for all application tables; members see only their households and shared profiles. Direct table writes are denied, and invitation hashes are not readable by authenticated users.
- Atomic database functions for household/admin/default-type creation, own-profile updates, admin invitation issuance, and single-use invitation redemption. Redemption uses a row lock and a per-user 10-attempt/15-minute limit. Invalid attempts return structured errors so counters commit.
- Supabase email/password registration and login, persisted sessions, SDK-managed refresh, unsubscribe cleanup, loading skeletons, protected `/app`, and sign-out. Unconfigured forms are explicitly disabled.
- Token-validation middleware and the minimal protected `/api/me` read required to verify profiles and household membership.
- Local configuration, deterministic password-free fixtures, embedded PostgreSQL tests, API authentication tests, and setup documentation.

## Decisions

The backend validates tokens with `auth.getUser(token)`, then creates user-scoped database requests carrying that token. Database RLS reads current memberships instead of trusting household IDs or roles in client input. This adds a small Auth request per API request, an acceptable MVP tradeoff for straightforward validation. No service-role credential is needed.

Database functions use fixed empty search paths, qualified objects, explicit identity/role checks, and restricted execute grants. Their `security definer` privilege is needed for atomic mutations while direct table writes remain denied. Authenticated RPCs are callable outside Express, so database validation is the security boundary and must remain complete. Future API endpoints will call these functions; the browser currently calls Supabase only for authentication.

Invitations store only a SHA-256 hash. The future API generates a high-entropy random code, shows it once, and sends only its hash to the database. Successful redemption locks the invitation before changing membership. Per-user limits supplement code entropy; broader API abuse controls remain part of Phase 5.

The demo stays separate from the protected account. No sample pet records are presented as real household data. The household/pet/logging API and onboarding screens remain in their approved later phases. Password reset is deferred until its recovery screen and SMTP flow can be verified together.

## Verification and external dependency

The user needs to create a Supabase project. No remote project has been created, no migration has been pushed remotely, and no application credentials were invented. Docker was unavailable, so the full local Supabase stack could not run. Embedded PostgreSQL tests exercise the actual migration with simulated Auth identity, not a mock of RLS. Hosted Auth, email confirmations, persistent-session refresh, PostgREST, and concurrent-connection behavior still need live verification.

See `docs/supabase-setup.md` for exact configuration and manual checks. Phase 4 is ready for configuration, with hosted acceptance checks pending. Do not mark it fully verified until those checks pass.

## Files

Added:

- `supabase/config.toml`
- `supabase/migrations/20261016000100_foundation.sql`
- `supabase/tests/foundation.test.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/account.ts`
- `apps/api/tests/auth.test.ts`
- `apps/web/src/lib/supabase.ts`
- `apps/web/src/contexts/AuthContext.tsx`
- `apps/web/src/components/layout/ProtectedRoute.tsx`
- `apps/web/src/pages/AccountPage.tsx`
- `apps/web/src/services/account.ts`
- `docs/supabase-setup.md`
- `docs/phase-4.md`

Updated: workspace dependency manifests and lockfile; API app; web routes, auth page, and styles; environment examples; test discovery; Supabase seed and README; root README.

## Next milestone

After hosted setup and Phase 4 acceptance: request approval for Phase 5, the remaining REST endpoints, validation, household/pet operations, and concurrency-safe activity logging. No Phase 5 implementation is included here.

## Final check results

All 22 automated tests passed (11 database tests, 8 authentication-boundary cases, and 3 API foundation tests), along with production builds, TypeScript checks, ESLint, and formatting. Browser checks confirmed unauthenticated `/app` redirects to `/login`, and both sign-in and registration stay disabled with clear setup messaging when configuration is absent. The separate sample household remains available.

The Supabase CLI dependency is pinned, but its executable could not initialize its home-directory cache under the environment's filesystem restrictions. No hosted linking or migration application was attempted. Full CLI configuration parsing and the full local Supabase stack remain unverified.

## Supplied project configuration

The user supplied the project URL and public publishable key. Both local application environment files are configured and ignored by Git. A read-only Auth settings request succeeded: email sign-up is enabled and email confirmation is required. A read-only Data API request reported `PGRST205` for `public.profiles`, so the hosted migration has not yet been verified as applied. No privileged credentials were requested or used. Hosted schema setup and the registration/session acceptance checks remain pending.

## Hosted migration follow-up

After the user applied the migration, the Supabase Data API recognized all seven application tables and rejected anonymous reads with PostgreSQL permission errors (`42501`), replacing the earlier missing-table error. Email/password sign-up remains enabled with confirmation required. The initial local API probe hit an older preview: health succeeded, but `/api/me` returned 404. The current preview was moved to API port 3002 before repeating the checks. Live registration, email confirmation, authenticated profile loading, refresh persistence, and sign-out remain pending the user's own account verification. The current development frontend origin is `http://127.0.0.1:5174`; add its `/app` callback to Supabase Auth's redirect allowlist.

The corrected local preview passed all three HTTP checks: health returned 200 and account requests with missing/invalid tokens returned 401. Local API port 3002 is selected in the ignored environment files; the frontend proxy supports an optional API_PROXY_TARGET override while retaining port 3001 as its default.
