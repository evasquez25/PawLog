# Phase 7 — Realtime care synchronization

## Outcome

PawLog now subscribes to new care records in the selected household and refetches the affected pet's latest-care API query automatically. It handles reconnects, offline/background transitions, household switches, and sign-out without retaining an active old-household listener. No new history, reminders, or presence features were added.

## Required Supabase update

Run the complete contents of `supabase/migrations/20261016000300_care_realtime.sql` in the project's SQL editor, or apply pending migrations through the linked Supabase CLI. Run only this new migration; do not recreate the foundation tables or load local seed records.

It idempotently adds `public.activity_logs` to the `supabase_realtime` publication. Existing publication tables are preserved. It does not change table grants, RLS, rows, or replica identity. No publication was changed on the hosted project by the assistant.

## Architecture and tradeoffs

- One channel per authenticated user/active household, created only after the real membership read succeeds. The channel has an `INSERT` listener filtered by `household_id`. Postgres Changes applies the existing SELECT RLS policies; a filter or channel name alone is not authorization.
- Only append-only activity records are streamed. Invitations, profiles, and membership tables are not newly published. Skipping UPDATE/DELETE events avoids depending on old-row delivery and replica-identity settings.
- The pinned SDK supports `postgres_changes_options.wait: true`. The connected badge waits for that subscription acknowledgement, rather than assuming a WebSocket join means replication is ready. It is a transport status, not a guarantee of event delivery.
- Events are hints, not replacement records. The handler validates household and pet IDs and invalidates only that user's affected-pet query. The existing authenticated Express endpoint reloads database-authoritative data. Bursts are coalesced over 100ms.
- Subscriptions are removed and all scheduled work/listeners are canceled on unmount, user change, loss of membership readiness, and household switch. Late callbacks are ignored. Unique per-instance channel names prevent asynchronous cleanup from reusing a previous channel.
- Supabase Auth/SDK handles refreshed tokens and automatic subscription retry. Returning online starts a fresh channel and refetches current data. Focus and return from background also refetch.
- Visible online clients reconcile current queries every 60 seconds even when connected, recovering from silently missed events. While reconnecting, the fallback checks every 15 seconds. Polling pauses offline and while hidden. These modest extra reads trade efficiency for reliability in a small-household MVP.
- Household/member/pet metadata is reconciled periodically, but this phase's immediate notifications cover care activity. Realtime Broadcast would offer different scaling characteristics at the cost of more authorization/trigger setup; Postgres Changes is sufficient here.

Official references: [Postgres Changes and RLS](https://supabase.com/docs/guides/realtime/postgres-changes), [subscription readiness and missed events](https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting). The installed SDK source documents the subscription-wait option used here.

## Verification

Automated tests cover publication idempotency and preserved anonymous denial, household filter configuration, event scoping, coalescing, no payload-driven data replacement, household-switch cleanup, late callbacks, successful reconnect refetch, 15/60-second reconciliation, hidden/offline behavior, online resubscription, logout cleanup, and two independent query clients reacting to one simulated household event. Existing database/API/logging regressions remain in the suite.

These tests simulate SDK event delivery and exercise real PostgreSQL publication metadata/RLS in the embedded engine. They do not prove delivery through the hosted Supabase replication service or cross-device network behavior. A real two-client test remains necessary after the publication migration is applied.

Read-only browser QA found the real household and pet created by the user, the persisted feeding, empty states, and an honest reconnecting/fallback status while hosted publication setup is pending. No activity was submitted or altered by the assistant. A duplicate-key warning in the existing Settings form was corrected by giving household and invitation components distinct keys. Live pet illustrations now use the selected pet's name in their accessible label rather than a demo name.

## Live acceptance checks

1. Apply the new migration and open `/app` on two devices (or two separately signed-in browser sessions), both belonging to the same household.
2. Confirm **Live updates connected** on both. A reconnecting message means periodic reads are available, but it does not verify live delivery.
3. Keep device B in view. On A, record an actual completed care activity you want to preserve. B's matching pet card should update without refresh. Do not add fake activities solely to test: logs remain append-only.
4. Backdate a legitimate activity: B should still show the latest completion, not the last inserted older one.
5. Disconnect B, record a legitimate completion on A, then reconnect B. Its current state should refetch even if it missed the notification. It must never claim an offline save succeeded.
6. Background and reopen B; check that current data is fetched. Repeat while switching household/pet where applicable.
7. A different household account must not receive or read the first household's care. Sign out and confirm there is no continuing visible household activity.
8. If delivery fails, verify `activity_logs` is enabled under Database → Publications → `supabase_realtime`, check Realtime service availability/quotas and logs, and verify the account is a current household member. Do not disable RLS as a workaround.

## Files

Added:

- `apps/web/src/hooks/useCareRealtime.ts`
- `apps/web/src/tests/realtime.test.ts`
- `supabase/migrations/20261016000300_care_realtime.sql`
- `docs/phase-7.md`

Updated household context, connection-status UI/styles, database regression tests, Settings component keys, pet illustration accessibility, and README. No new dependencies.

## Next milestone

After the publication update and live acceptance, Phase 8 requires approval: PWA manifest/icons, service-worker caching, install/offline checks, and Vercel deployment. Sites hosting remains unused.

Final results: all 74 automated tests passed; TypeScript, ESLint, formatting, and production builds passed. The targeted realtime tests also passed after checking distinct user IDs in the two-client case. The live dashboard showed the persisted care data with a reconnecting/fallback status; hosted publication setup and real event delivery still await the migration and user acceptance checks above.
