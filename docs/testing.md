# Testing PawLog

## Automated checks

Run the five commands in the root README before deployment. `npm test` currently runs 84 tests in 10 files with fixtures and temporary embedded database data; it does not write into the hosted family household.

| Area                | Automated evidence                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication      | API rejects missing/invalid tokens; protected UI waits for restoration, redirects signed-out users and renders signed-in routes; API 401 clears invalid local sessions |
| Household isolation | SQL RLS and RPC tests separate members, administrators, outsiders and anonymous users                                                                                  |
| Invitations         | Hashing, membership, expiry, one-time redemption and abuse limits                                                                                                      |
| Activity saves      | Validation, performer authorization, latest retrieval, idempotent replay/conflict and explicit feeding override                                                        |
| Interrupted saves   | Same key/body on retry, no premature success, dismissal blocked during save, dashboard preserves newer care after backdated entries                                    |
| Network behavior    | Offline submissions rejected, cancellation preserved, query reads bounded by a timeout                                                                                 |
| Realtime            | Household filters, invalidation, coalescing, cleanup, reconnect and periodic reconciliation                                                                            |
| PWA                 | Static-only cache, private requests excluded, offline navigation fallback, cache cleanup, explicit update consent and stale-worker handling                            |

Embedded SQL tests exercise the actual migrations with a mock platform authentication harness. They do not replace hosted Supabase Auth or genuine concurrent multi-connection database tests. The optional concurrency script requires a local PostgreSQL environment supporting shared memory; it could not start in this sandbox.

## Browser checks completed in Phase 9

- Inspected the real signed-in local household without saving or changing records.
- Opened a walking sheet: current member focused, proper dialog name, and Escape returned focus to the original button.
- Confirmed pet-form labels/list references have no duplicate IDs.
- Checked the dashboard at 320 pixels and settings at 390, 768 and 1280 pixels for horizontal overflow.
- Measured care and header action targets at 44 pixels on the small-phone dashboard.
- Improved small text and colored care-button contrast, inspected the rendered layout and retained reduced-motion/focus styles.
- Verified production routing, API health/auth denial and PWA file delivery after deployment.

These checks do not constitute a complete screen-reader or WCAG certification. A physical phone cannot be fully emulated by changing viewport size.

## Device acceptance

The user confirmed production sign-in and home-screen installation/launch in Phase 8. Recheck after substantive changes:

1. Sign in at the published URL, reload, close/reopen and verify the session and correct household.
2. Have another member create an account, confirm their email, and redeem a privately shared invitation. Confirm a used or expired code is rejected. Use a separate test household if testing artificial records.
3. Log actual care when appropriate. Verify the performer, chosen time and note on another connected device. Confirm a backdated entry does not replace a newer one on the dashboard.
4. For feeding, confirm a recent completion shows a warning and nothing saves until Log Anyway is chosen.
5. With the app open, turn on airplane mode. Verify the offline banner and disabled saves. Reconnect and confirm current data returns with no queued activity. A cold offline launch has no persisted household cache.
6. Check the installed app, browser Back, keyboard navigation, visible focus, dialog tab containment, Escape and the device's larger-text setting.
7. Finish open entries before choosing an app update. Confirm the app reloads and remains signed in.
8. Sign out and verify private routes return to sign-in. Test family records only through real care; use the demo or a disposable household for exploratory saves.

No real family record needs to be fabricated to repeat these checks.
