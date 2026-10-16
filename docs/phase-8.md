# Phase 8 — PWA and Vercel

PawLog is published at https://pawlog-flame.vercel.app using Vercel frontend hosting and a same-origin Express Function. It connects to the existing Supabase project; existing household records and access policies are unchanged.

## What changed and why

- `apps/web/vite.config.ts`: pinned vite-plugin-pwa 2.0.0 with injectManifest. The plugin discovers the built app files, including lazy route chunks, and inserts their revisions into the service worker.
- `apps/web/service-worker/sw.js`: precaches only app files. API calls, Supabase responses, credentials, and user photos are never added to the service-worker cache. Navigation tries the network and falls back to the cached app shell when unavailable. Household data remains in memory only; cold offline starts cannot show saved care records.
- `apps/web/public/manifest.webmanifest` and four PNG icons: home-screen name, standalone display, start route, standard/maskable/Apple icons. The paw artwork stays inside the maskable icon's safe area.
- `apps/web/index.html`: manifest, icon, Apple home-screen metadata.
- `apps/web/src/components/PwaUpdates.tsx` and `main.tsx`: production service-worker registration and an explicit update prompt. Updates wait until chosen, so an app update does not automatically interrupt a care entry. Choosing Update now reloads that tab; finish any entry first.
- `apps/web/src/components/live/InstallApp.tsx`, `pages/LiveSettingsPage.tsx`, `styles.css`: installation instructions and browser-native install button where supported. Installation is optional; the web app remains usable normally.
- `apps/web/src/tests/pwa.test.ts` and `pwa-updates.test.ts`: checks that private responses/writes are never intercepted, offline navigation falls back to the app shell, and updates clean only PawLog's old caches and wait for consent.
- `package.json`, `apps/web/package.json`, `package-lock.json`: pinned PWA dependency.
- `vercel.json`: service-worker/manifest cache headers and long-lived caching for content-hashed assets.
- `tsconfig.json`: exposes the function adapter’s TypeScript configuration at the project root. `apps/api/src/services/pawlog.ts` uses the equivalent `hasOwnProperty.call` check to avoid a Vercel function-compiler library warning.
- `.vercelignore`: excludes local environment files, dependencies, and generated builds from upload.

No database migration is needed. No offline writes, push notifications, app-store release, or paid add-on was added.

## Deployment

The linked Vercel project is `evasquez25s-projects/pawlog`; use Node 22.x, the repository root, framework Other, `npm run build`, and output `apps/web/dist`. The root `api/[...path].ts` exports the Express app; the production function never starts a listening server.

Four configuration variables are saved in Vercel Production and Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

These use the existing public Supabase project configuration. No service-role key is required. Frontend values are embedded at build time, so changing them requires redeployment. Local `.env` files were excluded from upload.

Deploy from the project root with `npx vercel@64.3.1 --prod`. This project was deployed from local source; no GitHub repository or automatic Git deployments have been configured. To enable those later, import this project root from your GitHub repository into the existing Vercel project.

In [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/zvkfyakxpdriawbuutbz/auth/url-configuration), set:

- Site URL: `https://pawlog-flame.vercel.app`
- Additional redirect URL: `https://pawlog-flame.vercel.app/app`

Keep `http://127.0.0.1:5174/app` for development. Use exact production URLs rather than broad wildcard redirects. See [Supabase redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls). Existing confirmed users can sign in without receiving a new confirmation email; new email-confirmed accounts need the production redirect configured.

## Validation and acceptance

Local build, TypeScript checks, ESLint, formatting, and 79 tests pass. PWA generation includes all 28 static app files. Live smoke checks cover API health, unauthenticated denial, deep-link routing, icons, manifest, JavaScript/CSS delivery and service-worker headers. The browser check covers the real login page and the installation section. These automated and browser checks do not replace installation on a physical phone.

The user confirmed saving the production Supabase redirect settings. Finish these checks on your devices:

1. Open the production link and sign in with your existing account. Confirm Benji and the household appear. Reload and confirm the session remains signed in.
2. On iPhone/iPad, use Safari → Share → Add to Home Screen. On Android, use Chrome → menu → Install app or Add to Home screen. Launch the icon and confirm PawLog opens without ordinary browser controls. Installation controls vary by browser/OS.
3. Record actual care when appropriate. Confirm it appears on another signed-in phone/browser. Your local preview may serve as the other connected client because both use the same Supabase project.
4. With the installed app open, turn on airplane mode. Confirm the offline notice appears and save controls are disabled. A cold offline launch can show the cached app shell but cannot load household records. Reconnect; confirm current care reloads and no offline write is submitted.
5. When an app update is available, leave an entry open and verify it stays open until you explicitly choose Update now. Finish the entry before applying the update.
6. Sign out and verify protected pages return to sign-in.

## Free-tier scope

No paid service or subscription was purchased or upgraded. Vercel [Hobby](https://vercel.com/docs/plans/hobby) supports personal, noncommercial use, subject to quotas. Supabase [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) can pause low-activity projects over a seven-day period; resume through the dashboard if necessary. Existing Supabase email-delivery limits still apply; custom SMTP/password-reset work is outside this phase.

Phase 9 is testing and polish and requires separate approval after production sign-in and phone installation are confirmed.
