# Phase 6 — Frontend integration

## Outcome

The authenticated app at `/app` now reads and writes real household data through Express. It supports create/join household setup, household/pet switching, first-pet creation, the shared care dashboard, confirmed activity logging, profile/household/pet editing, household members, and admin invitation generation. The separate `/demo` and `/demo/settings` routes retain the clearly labeled in-memory prototype. The root URL sends signed-in users to their real account and other users to sign-in.

No new database migration is required for this phase. Both earlier migrations must already be applied, as confirmed in Phase 5. Nothing has been deployed.

## Key decisions

- A shared typed API client supplies the current Supabase access token and validates successful responses against Zod schemas. React never writes privileged application records directly to Supabase.
- TanStack Query owns server state. Query keys include the authenticated user plus the relevant household or pet. Changing households cannot display another household's selected pet. Only the chosen household ID is stored locally; activity data stays in the server cache in memory.
- Authentication clears caches when the user changes or signs out, while routine token refresh no longer destroys the active queries. An API 401 clears the invalid local session to prevent sign-in redirect loops.
- Account, household, members, pets, and latest care all have honest loading/error states. API errors never substitute sample records. Empty household/pet states guide the user into setup.
- Saving an activity waits for a confirmed server response. Its UUID submission key and original payload survive in-sheet network retries. A recent-feeding response requires explicit Log Anyway; uncertain saves lock the fields and offer Retry to confirm. Closing the sheet after an uncertain save loses that in-memory attempt, so the warning tells users to avoid starting a second submission; refresh/crash recovery is not an offline queue.
- Confirmed activity responses update cached cards without replacing a later completion with a backdated record, then refetch authoritative latest data. Equal timestamps retain the displayed completion until the server resolves its deterministic tie-break.
- Offline events show a banner and disable save controls. Mutations are not queued for later delivery, and failed/unknown saves never produce success toasts. Mutation requests have a 20-second confirmation timeout.
- Admin-only controls appear after membership roles load. Authorization remains enforced by the API and database. Pet photos use optional HTTPS links with an illustration fallback.
- Route-level lazy loading separates live, authentication, and demo screens and removes the earlier single-large-bundle warning.

## What to try

Run `npm run dev` from the repository root, and use the printed frontend URL (currently `http://127.0.0.1:5174`). Its `/api` proxy points at the configured local API, currently port 3002. Existing sessions persist on the same frontend origin.

1. Sign in and create your actual household, or redeem a valid invitation. The creator becomes admin.
2. Add your actual pet. Verify all four activities initially show **Not recorded yet**.
3. Log a completed activity: current user/time should be selected. Change the caretaker, backdate if appropriate, and add a note. Save should update the card after confirmation.
4. Log another feeding soon afterward: inspect the server warning, then cancel or explicitly confirm. Do not use real feeding records solely to test a warning unless you want to keep them; logs are append-only.
5. In Settings, edit your display name, household name/warning interval, and pet details. Refresh to check persistence.
6. Create an invitation as admin and share it yourself with an intended family member. Codes are displayed only on the current page and work once.
7. Use a second real account to redeem that code, then verify the shared household and member permissions. Automatic cross-device updates are Phase 7; refresh currently retrieves updates, and app focus/reconnection also refetch.
8. Try the app offline: it must display disconnection and must not claim a save. If a save's result is uncertain, retry it in the same sheet without changing fields.
9. Sign out and visit `/app`: it must return to login. `/demo` remains explicitly separate from actual records.

## Verification performed

Automated tests cover API authentication/validation and PostgreSQL authorization from earlier phases, plus the frontend API client's offline/session/error/response handling and logging sheet behavior. Component tests verify current-member defaults, no double submission, no premature success, stable retries, explicit feeding override, and backdated-save cache behavior.

The user signed in through the live Supabase configuration. Read-only browser checks confirmed authenticated household setup, the real profile in Settings, persistent sign-in after page reload, and a 390px mobile layout with no horizontal overflow. Browser logs showed no application errors during these checks.

A proposed save of the unchanged profile name was rejected by automatic approval review because it would persist a mutation to the user's live account. No profile save or new household/pet/activity/invitation records were submitted during browser QA. Live end-to-end write verification therefore remains a user acceptance step; isolated tests cover those flows without populating the user's account. Separate-connection PostgreSQL races also retain the previously documented environment limitation.

## Files

Added:

- `apps/web/src/services/client.ts`
- `apps/web/src/contexts/HouseholdContext.tsx`
- `apps/web/src/hooks/useOnline.ts`
- `apps/web/src/components/live/Feedback.tsx`
- `apps/web/src/components/live/LiveLayout.tsx`
- `apps/web/src/components/live/LiveLogSheet.tsx`
- `apps/web/src/components/live/PetForm.tsx`
- `apps/web/src/pages/HouseholdSetupPage.tsx`
- `apps/web/src/pages/LiveDashboardPage.tsx`
- `apps/web/src/pages/LiveSettingsPage.tsx`
- `apps/web/src/tests/client.test.ts`
- `apps/web/src/tests/log-sheet.test.ts`
- `docs/phase-6.md`

Updated shared response schemas, routing/lazy loading, auth cache lifecycle, account service, demo links/text, styles, test aliases, development-test dependencies/lockfile, and README. Removed the obsolete Phase 4 `AccountPage.tsx` placeholder.

## Next phase

After your acceptance of these flows, request approval for Phase 7: authorized Supabase Realtime subscriptions, query invalidation, subscription cleanup, reconnect handling, and two-client verification. PWA installation and deployment remain Phase 8.

Final checks: the full 62-test suite passed, followed by the eight API-client tests after adding one additional non-idempotent retry regression case (63 tests total). TypeScript, ESLint, formatting, and production builds pass. Mobile and default-size previews were saved to the task outputs. The latest local servers remain running on frontend port 5174 and API port 3002.
