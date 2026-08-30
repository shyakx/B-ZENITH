# B-ZENITH

A simple POS and business management system for the B-ZENITH bar and hospitality business.

Staff use it to take orders, record payments, print factures, track stock, and see who did what.

## Roles

| Role | What they do |
| --- | --- |
| Waiter | Take orders for a table |
| Cashier | Record payments and print factures |
| Manager | Sales, stock, products, reports, Maison de Passage |
| Admin | Users, access, settings, audit |

Kitchen, Cafe and Bar are product areas, not staff roles.

## Development setup

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or a local PostgreSQL database.
2. Copy environment values:

```bash
copy .env.example .env
```

3. Start the database and seed development data:

```bash
docker compose up -d
npm install
npm run db:setup
npm run dev
```

If Docker is not available on Windows and PostgreSQL binaries are installed locally:

```bash
npm run db:start
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Development credentials

These accounts exist only after seeding. Do not use them in production.

| Name | Role | PIN |
| --- | --- | --- |
| John | Waiter | 1111 |
| Mary | Waiter | 1112 |
| Grace | Cashier | 2222 |
| Patrick | Manager | 3333 |
| Admin | Admin | 4444 |

## Daily use

**Waiter:** Home → New Order → select table → add products → Submit.

**Cashier:** Orders / Bills → open the table → record the money → print facture if asked.

Printing a facture does not mark a bill as paid.

## Scripts

```bash
npm run dev
npm test
npm run db:setup
npm run build
```

## Stack

Next.js, TypeScript, PostgreSQL, Prisma, Tailwind CSS.
