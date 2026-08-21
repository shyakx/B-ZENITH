const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { config } = require("dotenv");

config({ path: ".env.vercel.production", override: true });
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const url = new URL(raw.replace(/^"|"$/g, ""));
if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
  console.error("Refusing local database.");
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

(async () => {
  const [categories, products, variants, users, emails] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.user.count(),
    prisma.user.findMany({ select: { email: true } }),
  ]);
  const blocked = emails.filter((u) => /@example\.com$/i.test(u.email)).map((u) => u.email);
  console.log(JSON.stringify({ host: url.hostname, categories, products, variants, users, exampleEmails: blocked }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
