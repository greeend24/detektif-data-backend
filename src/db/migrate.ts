/**
 * SQLite Database Migration Script
 * 
 * Creates all tables if they don't exist.
 * Runs automatically on first app launch via Electron.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

import { client } from "../db/index.js";

export async function runMigrations(): Promise<void> {
  console.log("[migrate] Running SQLite migrations...");

  // Better Auth Core Tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      username TEXT NOT NULL UNIQUE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  // Game Tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_stats (
      id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      total_score INTEGER NOT NULL DEFAULT 0,
      endless_high_score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_subbab_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      subbab_id INTEGER NOT NULL,
      unlocked INTEGER NOT NULL DEFAULT 0,
      current_stage INTEGER NOT NULL DEFAULT 1,
      stars TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, subbab_id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      badge_id TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      UNIQUE(user_id, badge_id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS quest_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      subbab_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL DEFAULT 30,
      points_earned INTEGER NOT NULL,
      time_remaining_seconds INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, subbab_id)
    )
  `);

  console.log("[migrate] ✅ All SQLite tables ready.");
}
