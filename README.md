# B-ZENITH POS

Restaurant, café, bar and lounge point of sale. The live application is the repository root (`src/`, `prisma/`).

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

Required:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — public app URL
- `NEXTAUTH_SECRET` — long random secret (32+ characters) in production

Optional:

- `SEED_USER_PASSWORD` — used only by the development seed
- `SEED_DEV_USERS=true` — allow example staff accounts when seeding in production (not recommended)

A placeholder `NEXTAUTH_SECRET` is rejected on non-local production deployments.

## Local development

PostgreSQL runs in Docker on host port **5433**, database `bzenith`.

```bash
npm install
npx prisma generate
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Production build

```bash
npm run build
npm run start
```
