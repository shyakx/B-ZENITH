# B-ZENITH POS

Restaurant, café, bar and lounge point of sale. The live application is the repository root (`src/`, `prisma/`).

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

Required by the running application:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — public app URL (`https://your-domain`)
- `NEXTAUTH_SECRET` — required in production. 32+ random characters. The development placeholder and `BZenith@2026` are rejected.
- `NODE_ENV=production` — set automatically by `npm run start` and Vercel

Seed-only (not required to run the app):

- `SEED_USER_PASSWORD` — local example staff only
- `SEED_DEV_USERS` — cannot create example staff when `NODE_ENV=production` or when `DATABASE_URL` is not localhost

Do not commit secrets. Do not use `BZenith@2026` as `NEXTAUTH_SECRET`.

## Local development

PostgreSQL runs in Docker on host port **5433**, database `bzenith`. `npm run db:seed` is **local only**. Never run it against production.

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Production database

**Never run `npm run db:seed` or `prisma db seed` against production.** Seed overwrites menu selling prices and must not replace live data after go-live.

Production schema changes are **migrations only**. Use the **unpooled** Neon URL after a confirmed backup. See `docs/production-environment.md` and `docs/backup-and-recovery.md`.

Do **not** recreate products, reset inventory, or load the local seed menu into production. Opening quantities must be entered in **Inventory → Physical stock take**, not by seeding. See `docs/opening-stock.md`.

If you ever need a first OWNER on an empty database, that is a one-time bootstrap (`scripts/create-first-owner.ts`) on a **new** database only. It must not be used to overwrite an existing production staff list.

## Production build

```bash
npm run build
npm run start
```

## Deploy on Vercel

1. Confirm Production env: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `NEXTAUTH_URL` (`https://…`), `NEXTAUTH_SECRET` (32+ random characters).
2. Backup Neon (snapshot/PITR plus off-site `pg_dump` via `scripts/backup-postgres.js`).
3. Apply **pending Prisma migrations only** with the unpooled URL (`npx prisma migrate deploy`). Do **not** seed. Do **not** `db push` or `migrate reset`.
4. Deploy the committed production-hardening branch.
5. Smoke-test login and a sale. Enter opening stock through Inventory stock-take.

Do not deploy until environment variables and the backup/migration steps are done. Existing production data must never be replaced by seed data.
