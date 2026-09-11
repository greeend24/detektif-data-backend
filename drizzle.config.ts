import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.ELECTRON_USER_DATA
      ? `file:${process.env.ELECTRON_USER_DATA}/detektif_data.db`
      : "file:./detektif_data.db",
  },
});
