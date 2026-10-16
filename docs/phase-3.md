# Phase 3 — Frontend prototype

## What changed

The setup screen is now a responsive pet-care prototype, with sage, cream, peach, lavender, and blue design tokens and original vector pet illustrations. Desktop navigation becomes a two-destination bottom bar on mobile.

- Home: pet switching, four care cards, latest completion times and caretakers, empty states, relative-time refresh, and confirmation toasts.
- Logging: native modal dialog, mobile bottom-sheet layout, member selection, editable local time, notes, input validation, recent-feeding confirmation, submission guard, offline feedback, Escape dismissal, and restored trigger focus.
- Settings: in-memory profile and household changes, members and roles, active pet, reset, and exit-demo actions.
- Authentication: login and registration interface previews with browser validation, explicit unconfigured feedback, and a separate sample-household entry. Credentials are neither sent nor persisted.

## Implementation decisions

Sample data is intentionally in React context, not TanStack Query: it is not server state. It is lost on refresh and never shared across devices. The shared API and query infrastructure remain ready for integration. Database-enforced idempotency and duplicate detection are not claimed by this prototype.

Every sample activity remains in memory; dashboard selection uses performed time, so backdated entries do not replace newer records. Luna starts empty to make first-use states easy to inspect. The default sample member is Eric, even if the demo display name changes.

The logging dialog uses the browser's modal behavior for focus containment and Escape, while the existing shadcn/ui Button supplies consistent form actions. No new dependencies were needed. Real protected routing, sessions, invitations, uploads, pet creation, and network-error recovery belong to subsequent phases.

## Files added

- `apps/web/src/contexts/DemoContext.tsx`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/components/layout/AppLayout.tsx`
- `apps/web/src/components/pets/PetPortrait.tsx`
- `apps/web/src/components/activities/LogSheet.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/AuthPage.tsx`
- `docs/phase-3.md`

Modified: `apps/web/src/main.tsx`, `apps/web/src/styles.css`, and `README.md`.

## How to review

Run `npm run dev` and use the Vite URL printed in the terminal. Preview the dashboard at `/`, settings at `/settings`, and auth screens at `/login` and `/register`.

1. Open feeding, select Sarah, add a note, and save. The caretaker/time should update and a demo toast should appear.
2. Open feeding again and save: the recent-feeding warning should appear. Cancel or explicitly log anyway.
3. Log an older activity: the latest card should retain its newer completion.
4. Switch to Luna: all four cards should start empty. Logging for Luna must not change Max.
5. Change your display and household names in Settings, save, and return Home. Refresh to reset the prototype.
6. Check keyboard-only navigation, modal Tab containment, Escape dismissal, and return focus.
7. Inspect at 375–430px widths: two-column cards, bottom navigation, and bottom-sheet form should remain usable.
8. Submit sample auth forms: no real account should be created; the unconfigured status must be explicit.

## Next approval boundary

Phase 4 adds Supabase migrations, authentication, household membership, database constraints, and RLS. It requires a Supabase project or a local Supabase development environment. This prototype is not deployed and does not use Sites hosting.

## Verification results

Production build, TypeScript (including the Vercel adapter), ESLint, and the three existing API tests pass. Browser checks exercised sample logging, recent-feeding warning and override, settings edits, pet switching, empty states, registration feedback, modal initial focus, Escape dismissal, and restored trigger focus. Final desktop and mobile screenshots were saved. The measured mobile CSS viewport was 390px with no horizontal page overflow. Real-device installability, screen-reader review, offline transitions, and multi-device sync remain unverified; the latter features require later phases.
