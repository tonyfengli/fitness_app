# fitness_app

Elev8's gym app (Next.js on Vercel, Supabase Postgres via Drizzle). The Mac Mini agents that
read it live in `~/ai-crew` (see its CLAUDE.md).

- **Database schema:** read `packages/db/NAMING.md` before adding a table. Edit the schema
  files only; Tony runs `pnpm db:push`, which runs the naming check first.
- **No member names in git:** describe members ("a prepaid PT client"), never name them in
  commits, docs or pushed files.
- **Commits and pushes need Tony's OK.** Pushes to main auto-deploy to Vercel.
- **One `next dev`:** never start a second dev server in `apps/nextjs`.
