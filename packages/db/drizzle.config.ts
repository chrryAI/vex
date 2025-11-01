import { defineConfig } from "drizzle-kit"
import "dotenv/config"

const NODE_ENV = process.env.NODE_ENV
const TESTING_ENV = process.env.TESTING_ENV

const connectionString =
  TESTING_ENV === "e2e"
    ? process.env.DB_URL!
    : NODE_ENV === "production"
      ? process.env.DB_PROD_URL!
      : process.env.DB_URL!

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
})
