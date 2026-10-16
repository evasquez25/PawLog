# Phase 2 — Project initialization

## Decisions

Use npm workspaces with independent app builds and a small shared package. Keep the repository root as the Vercel project root so one origin serves the Vite bundle and API. Express exports an app; only the local server starts a listener. No Sites configuration, service registration, or deployment is included.

TypeScript is strict. Tailwind uses its Vite plugin. shadcn/ui uses local component source, a configured `@/` alias, CSS variable tokens, and Lucide icons. The initial page is explicitly a setup screen, not a simulated pet dashboard. TanStack Query manages the API health request, including retry and cancellation.

Separate controllers/services/database modules will be introduced with actual business logic, rather than empty scaffolding. No Supabase secrets or placeholder credentials are required for this phase.

## Manual verification

1. Run `npm ci`, then `npm run dev` from the repository root.
2. Visit the Vite address and confirm the API connection status.
3. Stop the API, reload, and confirm an honest error with a retry action.
4. Restart the API and retry.
5. Visit an unknown frontend path: a return-home link should appear.
6. Request an unknown `/api` route: expect JSON with status 404, not HTML.

## Remaining work

No authentication, protected data, database, activity UI, realtime, installation support, or deployed environment exists. Browser layout and Vercel production routing require later verification. The Supabase model and invitation/concurrency design remain as approved in Phase 1.

## Next milestone (requires approval)

Phase 3: design tokens, authentication screens, dashboard, activity cards, accessible logging sheet, and settings using clearly labeled mock data. No real activity claims or unconfigured authentication presented as working.

## Configuration references

- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui existing Vite projects](https://ui.shadcn.com/docs/installation/vite)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

## Files created

- `.env.example`
- `.gitignore`
- `.npmrc`
- `.nvmrc`
- `.prettierignore`
- `.prettierrc.json`
- `README.md`
- `api/[...path].ts`
- `api/tsconfig.json`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/tests/app.test.ts`
- `apps/api/tsconfig.json`
- `apps/web/.env.example`
- `apps/web/components.json`
- `apps/web/index.html`
- `apps/web/package.json`
- `apps/web/src/lib/utils.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/services/api.ts`
- `apps/web/src/styles.css`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `docs/phase-2.md`
- `eslint.config.js`
- `package.json`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/tsconfig.json`
- `supabase/README.md`
- `tsconfig.base.json`
- `vercel.json`
- `vitest.config.ts`

## Verification results

Production builds, workspace type checks, ESLint, and all three API tests passed. HTTP checks passed for the frontend, direct API, and Vite API proxy. Browser visual QA and Vercel deployment have not been performed. Installation reported zero known vulnerabilities. Verification used the installed Node 22 runtime explicitly and an isolated workspace npm cache; global settings were unchanged.
