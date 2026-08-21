# Production environment checklist

Do not paste secrets into tickets, git, or chat.

Set these on **Vercel → Project → Settings → Environment Variables → Production**.

| Variable | Required | Rule |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** `postgresql://` URL for the intended production database. Must not be localhost. |
| `DATABASE_URL_UNPOOLED` | Yes for migrations/dumps | Same database, hostname **without** `-pooler`. |
| `NEXTAUTH_SECRET` | Yes | At least **32** cryptographically random characters. Not `BZenith@2026`, `changeme`, or `replace-with-a-long-random-secret`. |
| `NEXTAUTH_URL` | Yes | Public app URL with protocol, e.g. `https://your-domain`. Must be `https://` in production. |
| `NODE_ENV` | Set by Vercel | `production` |

The app throws at runtime (after build) if `NEXTAUTH_SECRET` is weak or `NEXTAUTH_URL` is not `https://`.

## Generate a secret (set it yourself)

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then in Vercel:

```bash
npx vercel env add NEXTAUTH_SECRET production
npx vercel env add NEXTAUTH_URL production
```

Do not run those commands until you are ready to paste the values. Redeploy after changing auth env.

## Migrations (do not run until backup is confirmed)

Use the **unpooled** URL:

```bash
# DATABASE TARGET: <unpooled-host>/neondb
# OPERATION: prisma migrate deploy (apply pending migrations only)
npx dotenv -e .env.vercel.production -- npx prisma migrate deploy
```

If `dotenv-cli` is not installed, set `DATABASE_URL` in the shell to the **unpooled** production URL, then:

```bash
npx prisma migrate deploy
```

Pending after this branch:

- `20260819120000_staff_pin` (already applied on Neon)
- `20260819123000_user_pin_identity` (already applied on Neon)
- `20260821160000_sale_idempotency_key` (**new**, nullable unique column; existing sales stay valid)

Never run `prisma migrate reset`, `prisma db push`, `prisma db seed`, or `npm run db:seed` against production. Seed overwrites menu selling prices and must not replace live products, sales, or stock. Opening quantities are entered only through Inventory stock-take (`docs/opening-stock.md`).
