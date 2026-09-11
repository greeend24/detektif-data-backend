import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─────────────────────────────────────────────
// Better Auth Core Tables (SQLite)
// ─────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // ── Extension: username for game login ──
  username: text("username").notNull().unique(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ─────────────────────────────────────────────
// Game Tables (SQLite)
// ─────────────────────────────────────────────

/**
 * user_stats — 1:1 with user.
 * Stores aggregate game scores.
 */
export const userStats = sqliteTable("user_stats", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull().default(0),
  endlessHighScore: integer("endless_high_score").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * user_subbab_progress — Up to 7 rows per user.
 * Tracks per-subbab unlock status, current stage, and star ratings per stage.
 * `stars` is JSON text: { "1": 3, "5": 3, "21": 3 }
 */
export const userSubbabProgress = sqliteTable(
  "user_subbab_progress",
  {
    id: text("id").primaryKey(), // generated as userId_subbabId
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subbabId: integer("subbab_id").notNull(), // 1–7
    unlocked: integer("unlocked", { mode: "boolean" }).notNull().default(false),
    currentStage: integer("current_stage").notNull().default(1),
    stars: text("stars").notNull().default("{}"), // JSON string: { stageNum: starsEarned }
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_subbab_unique").on(table.userId, table.subbabId)]
);

/**
 * user_badges — Up to 10 rows per user.
 * Tracks which badges the user has unlocked.
 */
export const userBadges = sqliteTable(
  "user_badges",
  {
    id: text("id").primaryKey(), // generated as userId_badgeId
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull(), // 'badge1' .. 'badge10'
    unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_badge_unique").on(table.userId, table.badgeId)]
);

/**
 * quest_scores — Up to 7 rows per user (1 per subbab).
 * Records each Quest Mode exam completion (30 questions):
 * score (0-100), correct count, points, speed bonus / time remaining.
 * Critical for S2 thesis data analysis & grading.
 */
export const questScores = sqliteTable(
  "quest_scores",
  {
    id: text("id").primaryKey(), // generated as userId_quest_subbabId
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subbabId: integer("subbab_id").notNull(), // 1–7
    score: integer("score").notNull(), // 0–100 scale
    correctCount: integer("correct_count").notNull(), // e.g. 26
    totalQuestions: integer("total_questions").notNull().default(30),
    pointsEarned: integer("points_earned").notNull(),
    timeRemainingSeconds: integer("time_remaining_seconds").notNull().default(0),
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_subbab_quest_unique").on(table.userId, table.subbabId)]
);

