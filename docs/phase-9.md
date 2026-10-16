# Phase 9 — Testing and polish

## Result

Reviewed the existing MVP, fixed concrete reliability/accessibility issues, expanded regression coverage and replaced stale setup notes with a current handoff README. No database migration or new product feature was needed.

## Fixes and files

- `apps/web/src/services/client.ts`: query cancellation now combines with the 20-second deadline. Previously providing a query signal silently removed the timeout, allowing an unresponsive dashboard read to remain pending indefinitely.
- `apps/web/src/components/live/PetForm.tsx`: each species suggestion list uses its own React ID. The edit and new-pet forms previously duplicated `species-options` in Settings.
- `apps/web/src/pages/LiveDashboardPage.tsx`: photo failures are tracked by URL, so updating a broken photo link can display the replacement instead of remaining on the illustration.
- `apps/web/src/styles.css`: darkened supporting text and colored care-button labels, increased header touch targets, made mobile care metadata more readable and accommodated the narrow header/section layout.
- `apps/web/src/tests/client.test.ts`: regression for reads with both timeout and cancellation.
- `apps/web/src/tests/protected-route.test.ts`: session restoration/loading, signed-out redirect and authenticated rendering.
- `apps/web/src/tests/log-sheet.test.ts`: pending saves cannot be dismissed; after an uncertain failure cancellation is available again.
- `README.md`, `docs/testing.md` and this report: current architecture, development, deployment, installed-app behavior, test matrix, acceptance instructions and known limits.

## Verification

84 tests in 10 files pass. TypeScript, ESLint, production build and formatting pass. The actual migration/RLS tests run in embedded PostgreSQL. Browser checks verify the signed-in local household, dialog focus/Escape, unique form references, responsive widths and action sizes. Live deployment checks verify API health, unauthenticated denial, route fallback and manifest/service-worker delivery.

The user had already confirmed production login and the installed home-screen app. Existing real records were inspected but not modified for Phase 9. See `docs/testing.md` for exact coverage and manual checks.

## Remaining limits

The optional standalone concurrent PostgreSQL test remains environment-blocked by shared-memory restrictions; it is not counted among passing tests. Complete screen-reader certification and every physical browser/OS combination have not been performed. A GitHub repository/automatic deployments, password-reset UI and custom SMTP are not configured. No paid service was added. The known free-tier and offline limitations remain documented in Phase 8 and the README.

## Next step

Use PawLog for ordinary household care and follow the device acceptance checklist after future changes. Any new feature or separate development phase should be discussed before implementation.
