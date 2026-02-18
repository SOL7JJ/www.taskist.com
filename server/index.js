import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;

// IMPORTANT: change this in real projects (use env var)
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

// ---- DB init (Postgres) ----
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ---- Auth helpers ----
function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization; // "Bearer <token>"
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing token" });

  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, iat, exp }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---- Routes ----

// AUTH: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!email.includes("@"))
      return res.status(400).json({ error: "Enter a valid email." });
    if (password.length < 4)
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters." });

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1;",
      [email],
    );
    if (existing.rows[0])
      return res.status(409).json({ error: "Email already registered." });

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

// AUTH: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
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

// TASKS: READ (protected)
app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, title, completed
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

// TASKS: CREATE (protected)
app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    if (title.length < 2)
      return res
        .status(400)
        .json({ error: "Title must be at least 2 characters." });

    const created = await pool.query(
      `
      INSERT INTO tasks (owner_id, title, completed)
      VALUES ($1, $2, FALSE)
      RETURNING id, title, completed;
      `,
      [req.user.id, title],
    );

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// TASKS: UPDATE (protected)
app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { title, completed } = req.body;

    let changed = 0;

    if (typeof title === "string") {
      const trimmed = title.trim();
      if (trimmed.length < 2)
        return res
          .status(400)
          .json({ error: "Title must be at least 2 characters." });

      const r = await pool.query(
        `
        UPDATE tasks
        SET title = $1
        WHERE id = $2 AND owner_id = $3
        `,
        [trimmed, taskId, req.user.id],
      );
      changed += r.rowCount;
    }

    if (typeof completed === "boolean") {
      const r = await pool.query(
        `
        UPDATE tasks
        SET completed = $1
        WHERE id = $2 AND owner_id = $3
        `,
        [completed, taskId, req.user.id],
      );
      changed += r.rowCount;
    }

    if (changed === 0)
      return res.status(404).json({ error: "Task not found." });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// TASKS: DELETE (protected)
app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);

    const r = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1 AND owner_id = $2
      `,
      [taskId, req.user.id],
    );

    if (r.rowCount === 0)
      return res.status(404).json({ error: "Task not found." });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server only after DB is ready
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
