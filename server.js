// server.js
import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import usersRoutes from "./routes/users.routes.js";
import communitiesRoutes from "./routes/communities.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import donationRoutes from "./routes/donations.routes.js";
import scoresRoutes from "./routes/scores.routes.js";

// Import cleanup functions
import { cleanupUnusedFiles, getFileStats } from "./utils/cleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.TZ = 'Asia/Jakarta';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// =============================================
// CLEANUP ENDPOINTS
// =============================================

// GET: Lihat statistik file
app.get("/file-stats", async (req, res) => {
    try {
        const stats = await getFileStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET: Hapus file yang tidak terpakai
app.get("/cleanup-files", async (req, res) => {
    try {
        const result = await cleanupUnusedFiles();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST: Hapus file yang tidak terpakai (lebih aman)
app.post("/cleanup-files", async (req, res) => {
    try {
        const result = await cleanupUnusedFiles();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================
// ROUTES
// =============================================

app.use("/auth", authRoutes);
app.use("/categories", categoriesRoutes);
app.use("/users", usersRoutes);
app.use("/communities", communitiesRoutes);
app.use("/posts", postsRoutes);
app.use("/donations", donationRoutes);
app.use("/scores", scoresRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;