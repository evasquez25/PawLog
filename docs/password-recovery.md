# Password recovery

The sign-in page now links to `/forgot-password`. The user submits an email address and Supabase sends the recovery email. Its default recovery link verifies the token and returns to `/reset-password`, where the Supabase browser SDK restores the session. The reset page calls `auth.updateUser` with the new password only after a session is available.

No SQL migration, password table, admin API or service-role key is involved. Passwords are sent only to Supabase Auth, not to PawLog's API. The existing client uses Supabase's implicit callback flow; recovery links should be opened in a normal browser. Opening an email may use a browser session separate from an installed iOS app.

## Required Supabase configuration

Before testing email recovery, add exact callback addresses under Authentication → URL Configuration → Redirect URLs:

- `https://pawlog-flame.vercel.app/reset-password`
- `http://127.0.0.1:5174/reset-password` (or the exact port shown by your local Vite server)

Keep the existing Site URL and `/app` redirects. Do not add broad wildcard redirects. The default Reset Password email template should use Supabase's `ConfirmationURL`; custom templates need to preserve Supabase's recovery verification flow and requested redirect.

Configure a verified custom SMTP provider for reliable delivery to family members. Supabase's built-in mail delivery is restricted and rate limited; code alone cannot remove those limits. See [Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp) and [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). This implementation does not change provider settings or send a real recovery email automatically.

## Changes

- `pages/PasswordRecoveryPage.tsx`: email request and new-password forms, confirmation validation, neutral account-existence response, offline/pending states, rate-limit guidance, invalid/expired link guidance and server error handling. A normal authenticated session can also use the new-password route; Supabase still authorizes the password update.
- `contexts/AuthContext.tsx`: remembers `PASSWORD_RECOVERY` until the user finishes or leaves the flow; ordinary user-update/token-refresh events do not prematurely clear it.
- `main.tsx`: public recovery routes and routing for recovery events even if Supabase falls back to the Site URL.
- `pages/AuthPage.tsx`: Forgot password link and recovery-aware redirect.
- `lib/supabase.ts`: captures callback errors before the SDK cleans the callback URL, so an expired link cannot fall through to a previously signed-in session's password form. It never displays raw callback tokens or provider error descriptions.
- `styles.css`: small responsive recovery-page layout.
- `tests/password-recovery.test.ts`, `tests/auth-recovery.test.ts`: fixtures test email calls, neutral messages, duplicate blocking, limits, missing/expired sessions, initialization, password validation, success/failure, offline behavior and recovery events.

## Manual acceptance after configuration and deployment

1. From sign-in choose Forgot password and enter your own account email. Confirm a neutral acknowledgement and check delivery/spam.
2. Open the newest email link. Confirm the reset form opens rather than the dashboard, including while already signed in.
3. Try mismatched passwords; they should not submit. Save a new unique password and confirm success. Enter passwords only in the app.
4. Sign out and sign in with the new password. Reopen the installed app to check its session behavior.
5. Reuse or open an expired recovery link; expect fresh-link guidance. Also visit `/reset-password` while signed out.
6. Check a valid session's reset page after refresh. Its authenticated session permits changing the password. UI callback checks supplement, rather than replace, Supabase authorization.

Automated tests use fixtures; they do not send email or change a real account password. Live email delivery and a real password change require the account owner's acceptance test. The local implementation does not by itself publish a new Vercel deployment.
