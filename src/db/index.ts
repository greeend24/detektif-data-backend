import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────
// SQLite Database Setup (via libSQL)
// ─────────────────────────────────────────────
// In Electron: DB file is stored in app.getPath('userData')
// In dev: DB file is stored in ./detektif_data.db
// ─────────────────────────────────────────────

function getDbPath(): string {
  let dbPath: string;
  if (process.env.ELECTRON_USER_DATA) {
    dbPath = path.join(process.env.ELECTRON_USER_DATA, "detektif_data.db");
  } else {
    dbPath = path.join(process.cwd(), "detektif_data.db");
  }

  // Strictly ensure parent directory exists before SQLite / libSQL attempts to open connection
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    console.error("[db] Error creating database directory:", e);
  }

  return dbPath;
}

function getDbUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return `file:${getDbPath().replace(/\\/g, "/")}`;
}

const dbUrl = getDbUrl();

export const client = createClient({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });

