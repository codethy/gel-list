// prisma.config.ts

import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

// Prisma CLI does not auto-load .env.local (that is a Next.js convention).
// We manually load it here so process.env.DATABASE_URL is available
// when Prisma evaluates the datasource url.
dotenv.config({ path: ".env.local" });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
