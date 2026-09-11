import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import questRoutes from "./routes/quest.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { runMigrations } from "./db/migrate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isElectronProduction = !!process.env.ELECTRON_USER_DATA && process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Electron)
      if (!origin) return callback(null, true);
      // Allow all local development origins
      if (
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") || 
        origin.startsWith("app://") || 
        origin === env.FRONTEND_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

// Better Auth handles all /api/auth/* routes
app.use("/api/auth", authRoutes);

// Game API routes
app.use("/api/progress", progressRoutes);
app.use("/api/quest", questRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);

// Researcher / Admin Dashboard
function getAdminHtmlPath(): string {
  const candidates = [
    path.join(__dirname, "views", "admin.html"),
    path.join(__dirname, "..", "src", "views", "admin.html"),
    path.join(process.cwd(), "src", "views", "admin.html"),
    path.join(process.cwd(), "dist", "views", "admin.html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, "views", "admin.html");
}

app.get("/admin", (_req, res) => {
  const htmlPath = getAdminHtmlPath();
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send("Admin dashboard HTML file not found.");
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    mode: isElectronProduction ? "electron-offline" : "web",
  });
});

// All registered users list endpoint (for Pilih Akun board)
app.get("/api/auth/all-users", async (_req, res) => {
  try {
    const { db } = await import("./db/index.js");
    const { user } = await import("./db/schema.js");
    const users = await db.select({ username: user.username, fullname: user.name }).from(user);
    res.json({ success: true, users: users.map(u => ({ username: u.username, fullname: u.fullname || u.username })) });
  } catch (err) {
    res.json({ success: false, users: [] });
  }
});

import fs from "fs";

// ─────────────────────────────────────────────
// Serve Frontend Static Files
// ─────────────────────────────────────────────

const candidateDistPaths = [
  process.env.ELECTRON_RESOURCES_PATH ? path.join(process.env.ELECTRON_RESOURCES_PATH, "frontend", "dist") : null,
  process.env.ELECTRON_RESOURCES_PATH ? path.join(process.env.ELECTRON_RESOURCES_PATH, "dist") : null,
  path.join(__dirname, "..", "..", "dist"),
  path.join(__dirname, "..", "..", "frontend", "dist"),
].filter(Boolean) as string[];

let resolvedDistPath: string | null = null;
for (const p of candidateDistPaths) {
  if (p && fs.existsSync(path.join(p, "index.html"))) {
    resolvedDistPath = p;
    break;
  }
}

if (resolvedDistPath) {
  console.log("[server] Serving frontend static files from:", resolvedDistPath);
  app.use(express.static(resolvedDistPath));

  // SPA fallback — all non-API routes serve index.html
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(resolvedDistPath!, "index.html"));
  });
} else {
  console.warn("[server] Warning: No frontend dist folder found in candidates:", candidateDistPaths);
}

// ─────────────────────────────────────────────
// Start Server (with SQLite migration)
// ─────────────────────────────────────────────

async function startServer() {
  try {
    // Run SQLite migrations before starting the server
    await runMigrations();

    app.listen(env.PORT, () => {
      console.log(`\n🦉 Detektif Data Backend running on port ${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Local URL:   http://localhost:${env.PORT}`);
      console.log(`   IPv4 URL:    http://127.0.0.1:${env.PORT}`);
      console.log(`   Dashboard:   http://localhost:${env.PORT}/admin`);
      console.log(`   (atau buka:  http://127.0.0.1:${env.PORT}/admin)\n`);

      // Signal to Electron that the server is ready
      if (process.send) {
        process.send("server-ready");
      }
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

startServer();

export default app;
