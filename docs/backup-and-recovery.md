# Production backup and recovery

Do not store connection strings, passwords, or dump files in git.

## Before go-live

1. Open the Neon Console for this project.
2. Confirm the **Instant restore / history window**. Note the value. If it is only a few hours, do not rely on it as the only backup.
3. Create a **snapshot** or a **branch** from production at a known time. Name it with the date, for example `pre-open-2026-08-21`.
4. Take a `pg_dump` using the **direct / unpooled** hostname (no `-pooler`).

Example (replace the host with the real unpooled hostname):

```bash
node scripts/backup-postgres.js --env-file=.env.vercel.production --url-env=DATABASE_URL_UNPOOLED --confirm-host=YOUR_UNPOOLED_HOST --out=backups/bzenith-YYYYMMDD.dump
```

The script prints:

```
DATABASE TARGET: <host>/<database>
OPERATION: pg_dump ...
```

It refuses to run if:

- the host does not match `--confirm-host`
- the host contains `-pooler`
- the host is localhost (unless `--allow-local=true`)

Copy the dump to encrypted storage **outside** this repository. Add `backups/` to local ignore if you keep dumps on disk.

## Restore procedure

1. Restore into a **new** Neon branch or a separate database. Never restore directly over production on the first attempt.
2. Verify counts match the dump source:

```sql
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Sale";
SELECT COUNT(*) FROM "SaleItem";
SELECT COUNT(*) FROM "Payment";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FILTER (WHERE "trackInventory") FROM "Product";
```

3. Spot-check a known receipt number and its items and payment.
4. Only after those checks, decide whether production should switch `DATABASE_URL` to the restored database.

`pg_restore` also needs the **direct** connection string.

## What this repo does not do

- Vercel deploy does not dump or restore the database.
- App startup does not seed, reset, or truncate.
- This runbook is not a substitute for confirming the Neon plan in the console.
