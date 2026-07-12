import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // TODO(foundation): require DATABASE_URL in CI migrate jobs; allow generate without it locally
  console.warn("[@rakshex/database] DATABASE_URL is not set — drizzle-kit migrate will fail");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex",
  },
});
