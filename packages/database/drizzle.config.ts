import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[@rakshex/database] DATABASE_URL unset — using local default postgresql://rakshex:***@127.0.0.1:5432/rakshex",
  );
}

export default defineConfig({
  schema: [
    "./drizzle/schema.ts",
    "./drizzle/schema-foundation.ts",
    "./drizzle/schema-enterprise.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
