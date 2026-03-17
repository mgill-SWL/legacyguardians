// Prisma config: load env vars for CLI operations (migrate/generate).
//
// Vercel CLI writes .env.local, but Prisma config mode does NOT auto-load it,
// so we explicitly load it here.
import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "prisma/config";

dotenvConfig({ path: ".env.local" });
dotenvConfig();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
