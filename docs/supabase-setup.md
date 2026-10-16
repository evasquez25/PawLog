# Connect PawLog to Supabase

## 1. Create your project

Open [Supabase](https://supabase.com/dashboard), sign in, create an organization on its Free plan if needed, then create a project named PawLog. Choose a region near your household. Set a strong database password and store it in your password manager; it is not needed in the frontend or this chat.

Wait for provisioning. Copy the project URL and **publishable key** from the project's Connect dialog or API settings. The URL typically ends in `.supabase.co`; current publishable keys start with `sb_publishable_`. Do not copy a secret key or service-role key. Legacy `anon` keys are supported by the SDK, but use the current publishable key for a new project.

These public values identify the project; they do not grant household membership. Database RLS and validated authentication tokens provide access control.

## 2. Apply the tracked migration

From the PawLog repository root, using Node 22:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

`YOUR_PROJECT_REF` is the actual project reference shown in the dashboard. Review the dry-run before applying to the selected project. Enter credentials only in the CLI's prompts. Never paste the database password or a CLI access token into this chat or commit them.

This applies `supabase/migrations/20261016000100_foundation.sql`; don't manually recreate tables in the dashboard. Do not pass `--include-seed` to a hosted project. The seed file is for disposable local development only.

## 3. Add application configuration

Create `apps/web/.env` using your real public configuration:

```dotenv
VITE_SUPABASE_URL=YOUR_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Create `apps/api/.env` for the same project:

```dotenv
PORT=3001
SUPABASE_URL=YOUR_PROJECT_URL
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

The uppercase values above are instructions to replace, not working credentials. The app needs no service-role key. Environment files are ignored by Git. Restart both development servers after edits.

## 4. Configure Auth

Enable email/password sign-up and retain email confirmation. For local development, set the Site URL to `http://127.0.0.1:5173` and add the exact redirect `http://127.0.0.1:5173/app`. If Vite chooses another port, add that actual origin and `/app` redirect too; localhost and 127.0.0.1 are separate origins. Vercel URLs will be added in Phase 8.

Supabase's default email sender is restricted and is not a production email service. Configure custom SMTP before inviting family members outside your Supabase organization. Choose a provider only after verifying its current free allowance; no paid service is assumed. Keep sign-up and email rate limits enabled. Password-reset UI is deferred; don't promise users recovery until it is added and its email flow is verified.

## 5. Verify the connection

Run `npm run dev` and open the printed Vite address:

1. Visit `/register`, sign up with your own email, and confirm via email.
2. Visit `/login` and sign in. `/app` should show your verified profile and household list. A new account has no household yet.
3. Refresh and reopen the app: the session should restore without showing another user's data.
4. Sign out, then visit `/app`: it should redirect to `/login`.
5. Enter a bad password: it should show a useful error without creating a session.
6. Stop the API: account loading must fail honestly and allow retry; it must not switch to sample data.

At this phase, `/` and `/settings` remain the explicitly labeled in-memory prototype. Real household creation/invitation screens and pet/activity endpoints are delivered in Phases 5–6. Database functions for transactional household creation, invitations, and profile updates already exist, but the frontend does not invoke database writes directly.

## Optional: full local Supabase

Install a Docker-compatible runtime first; none was available during implementation. Then:

```sh
npx supabase start
npx supabase status
```

Use the printed local API URL and public key in the app environment files. Local mail appears in the email testing service provided by the CLI. `supabase/config.toml` fixes auth redirect origins to port 5173 by default; adjust for your actual local server.

`npx supabase db reset --local` destroys local data and recreates it from migrations and `seed.sql`. Use it only for a disposable local environment. It is not required to run the automated embedded database tests. Fixture accounts deliberately cannot log in; create actual accounts through Auth.

## Verification limits and references

`npm test` runs the migration against an embedded PostgreSQL engine with a minimal Supabase Auth schema and JWT identity helper. This tests actual SQL, constraints, functions, role grants, and RLS. It does not run Supabase Auth, PostgREST, SMTP, Realtime, or independent database connections. Hosted sign-in, email delivery, session refresh, and deployment require the live checks above.

Official documentation: [React Auth](https://supabase.com/docs/guides/auth/quickstarts/react), [database migrations](https://supabase.com/docs/guides/local-development/database-migrations), [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [email sender restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
