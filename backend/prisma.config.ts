import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: "../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The harmless fallback lets `prisma generate` run while building an image.
    // Migration commands still fail unless a real database is reachable.
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://prisma:prisma@localhost:5432/prisma",
  },
});
