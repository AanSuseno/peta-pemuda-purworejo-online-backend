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

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Info</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f4f5f7;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: #ffffff;
          padding: 40px 32px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          text-align: center;
          max-width: 360px;
        }
        .card h1 {
          font-size: 18px;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        .card p {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .btn {
          display: inline-block;
          background: #229ED9;
          color: #fff;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>API Service</h1>
        <p>Untuk info lebih lanjut mengenai API ini, silakan hubungi kami melalui Telegram.</p>
        <a class="btn" href="https://t.me/aansuseno" target="_blank">Hubungi via Telegram</a>
      </div>
    </body>
    </html>
  `);
});

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