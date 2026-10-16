# Database and Auth

See `../docs/supabase-setup.md` for hosted and local setup. Migrations define the schema, authorization, and scoped atomic writes. `npm test` runs real SQL against embedded PostgreSQL with a minimal Auth harness; it is not a full Supabase stack.

`seed.sql` is for disposable local development only and creates sample accounts without passwords or Auth login identities. Do not apply it to production. Automated tests use isolated fixtures.
