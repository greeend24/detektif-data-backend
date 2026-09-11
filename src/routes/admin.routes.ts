import { Router, Request, Response, NextFunction } from "express";
import {
  getAdminOverview,
  getAllStudentsData,
  generateStudentsCsv,
  deleteStudentById,
  resetAllStudentsData,
} from "../services/admin.service.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * Middleware to verify admin password via Header ('x-admin-key' or Authorization) or query param (?key=...)
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["x-admin-key"] || req.headers["authorization"];
  const queryKey = req.query.key as string;
  const provided = (authHeader ? String(authHeader).replace("Bearer ", "") : queryKey)?.trim();

  if (!provided || provided !== env.ADMIN_PASSWORD) {
    res.status(401).json({
      success: false,
      error: "Akses Ditolak: Password admin salah atau tidak disertakan!",
    });
    return;
  }
  next();
}

/**
 * POST /api/admin/login
 * Verify admin password.
 */
router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (password && password.trim() === env.ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login admin berhasil!" });
  } else {
    res.status(401).json({ success: false, message: "Password admin salah!" });
  }
});

// All routes below require valid admin authentication
router.use(requireAdminAuth);

/**
 * GET /api/admin/overview
 * Overview stats for researcher dashboard.
 */
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminOverview();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("[admin.routes] GET /overview error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch admin overview" });
  }
});

/**
 * GET /api/admin/students
 * List of all students with chapter/stage progress and quest exam scores.
 */
router.get("/students", async (_req: Request, res: Response) => {
  try {
    const students = await getAllStudentsData();
    res.json({ success: true, data: students });
  } catch (error) {
    console.error("[admin.routes] GET /students error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch student data" });
  }
});

/**
 * GET /api/admin/export-csv
 * Direct download of student scores formatted for Microsoft Excel & SPSS.
 */
router.get("/export-csv", async (_req: Request, res: Response) => {
  try {
    const csvContent = await generateStudentsCsv();
    const filename = `rekap_nilai_siswa_relasi_fungsi_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("[admin.routes] GET /export-csv error:", error);
    res.status(500).json({ success: false, error: "Failed to generate CSV export" });
  }
});

/**
 * DELETE /api/admin/students/:id
 * Delete a specific student and all related progress, scores, and badges.
 */
router.delete("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: "Student ID required" });
      return;
    }
    await deleteStudentById(id);
    res.json({ success: true, message: "Data siswa berhasil dihapus!" });
  } catch (error) {
    console.error("[admin.routes] DELETE /students/:id error:", error);
    res.status(500).json({ success: false, error: "Gagal menghapus data siswa" });
  }
});

/**
 * POST /api/admin/reset-all
 * Reset all student records (clean slate for new research trial).
 */
router.post("/reset-all", async (_req: Request, res: Response) => {
  try {
    await resetAllStudentsData();
    res.json({ success: true, message: "Seluruh data siswa berhasil dibersihkan!" });
  } catch (error) {
    console.error("[admin.routes] POST /reset-all error:", error);
    res.status(500).json({ success: false, error: "Gagal membersihkan data siswa" });
  }
});

export default router;
