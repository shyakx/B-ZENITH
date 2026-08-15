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

PostgreSQL runs in Docker on host port **5433**, database `bzenith`.

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Production database

Fresh production Postgres:

```bash
npx prisma migrate deploy
NODE_ENV=production npx prisma db seed
npx tsx scripts/create-first-owner.ts
```

`NODE_ENV=production npx prisma db seed` loads the official 40 / 270 / 302 menu and does **not** create `owner@example.com` or password `BZenith@2026`.

Create the first OWNER once, with a real staff email (not `@example.com`):

```bash
# PowerShell
$env:OWNER_NAME="B-ZENITH Owner"
$env:OWNER_EMAIL="owner@your-domain"
$env:OWNER_PASSWORD="your-own-password"
npx tsx scripts/create-first-owner.ts
```

Do not re-run seed after go-live. Enter opening stock in Inventory after deploy.

## Production build

```bash
npm run build
npm run start
```

## Deploy on Vercel

1. Create a production PostgreSQL database.
2. In Vercel project settings, set `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
3. From this repo, with production `DATABASE_URL` in the shell: `npx prisma migrate deploy`, then `NODE_ENV=production npx prisma db seed`, then `npx tsx scripts/create-first-owner.ts`.
4. Deploy: `npx vercel --prod`

Do not deploy until those environment variables and the database steps are done.
