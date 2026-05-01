import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback";

const allowedOrigins = [
  "http://localhost:5173",
  "https://yourtaskist.com",
  "https://www.yourtaskist.com",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/", (req, res) => res.send("API running ✅"));
app.get("/api/health", (req, res) => res.json({ ok: true }));

const VALID_PRIORITIES = new Set(["high", "medium", "low"]);
const VALID_STATUSES = new Set(["todo", "in_progress", "done"]);

function normalizePriority(value) {
  return VALID_PRIORITIES.has(value) ? value : "medium";
}

function normalizeStatus(value) {
  return VALID_STATUSES.has(value) ? value : "todo";
}

function normalizeDueDate(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
      ADD COLUMN IF NOT EXISTS due_date TEXT;
  `);
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = auth.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Enter a valid email." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1;", [
      email,
    ]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const created = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email;",
      [email, password_hash],
    );

    const user = created.rows[0];
    const token = createToken({ id: user.id, email: user.email });
    res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const found = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1;",
      [email],
    );

    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    const token = createToken({ id: user.id, email: user.email });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, title, completed, priority, status, due_date
      FROM tasks
      WHERE owner_id = $1
      ORDER BY id DESC;
      `,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    if (title.length < 2) {
      return res
        .status(400)
        .json({ error: "Title must be at least 2 characters." });
    }

    const priority = normalizePriority(req.body.priority);
    const status = normalizeStatus(req.body.status);
    const dueDate = normalizeDueDate(req.body.dueDate ?? req.body.due_date);

    const created = await pool.query(
      `
      INSERT INTO tasks (owner_id, title, completed, priority, status, due_date)
      VALUES ($1, $2, FALSE, $3, $4, $5)
      RETURNING id, title, completed, priority, status, due_date;
      `,
      [req.user.id, title, priority, status, dueDate],
    );

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { title, completed } = req.body;
    let changed = 0;

    if (typeof title === "string") {
      const trimmed = title.trim();
      if (trimmed.length < 2) {
        return res
          .status(400)
          .json({ error: "Title must be at least 2 characters." });
      }

      const updatedTitle = await pool.query(
        `
        UPDATE tasks
        SET title = $1
        WHERE id = $2 AND owner_id = $3
        `,
        [trimmed, taskId, req.user.id],
      );
      changed += updatedTitle.rowCount;
    }

    if (typeof completed === "boolean") {
      const updatedCompleted = await pool.query(
        `
        UPDATE tasks
        SET completed = $1
        WHERE id = $2 AND owner_id = $3
        `,
        [completed, taskId, req.user.id],
      );
      changed += updatedCompleted.rowCount;
    }

    const hasMetaUpdate =
      Object.hasOwn(req.body, "priority") ||
      Object.hasOwn(req.body, "status") ||
      Object.hasOwn(req.body, "dueDate") ||
      Object.hasOwn(req.body, "due_date");

    if (hasMetaUpdate) {
      const currentTask = await pool.query(
        `
        SELECT priority, status, due_date
        FROM tasks
        WHERE id = $1 AND owner_id = $2
        `,
        [taskId, req.user.id],
      );

      const existingTask = currentTask.rows[0];
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found." });
      }

      const priority = Object.hasOwn(req.body, "priority")
        ? normalizePriority(req.body.priority)
        : existingTask.priority;
      const status = Object.hasOwn(req.body, "status")
        ? normalizeStatus(req.body.status)
        : existingTask.status;
      const dueDate =
        Object.hasOwn(req.body, "dueDate") || Object.hasOwn(req.body, "due_date")
          ? normalizeDueDate(req.body.dueDate ?? req.body.due_date)
          : existingTask.due_date;

      const updatedMeta = await pool.query(
        `
        UPDATE tasks
        SET priority = $1, status = $2, due_date = $3
        WHERE id = $4 AND owner_id = $5
        `,
        [priority, status, dueDate, taskId, req.user.id],
      );
      changed += updatedMeta.rowCount;
    }

    if (changed === 0) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const deleted = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1 AND owner_id = $2
      `,
      [taskId, req.user.id],
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
      console.log(`Using Postgres via DATABASE_URL`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB:", err);
    process.exit(1);
  });
