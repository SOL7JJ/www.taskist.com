import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function TaskApp() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");

  const isAuthed = !!token;

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  async function loadTasks() {
    if (!token) return;

    setError("");

    const res = await fetch(`${API}/api/tasks`, {
      headers: authHeaders(),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to load tasks");
      return;
    }

    setTasks(data);
  }

  useEffect(() => {
    if (!token) return;

    async function syncTasks() {
      setError("");

      const res = await fetch(`${API}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load tasks");
        return;
      }

      setTasks(data);
    }

    void syncTasks();
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault();
    setError("");

    const endpoint = mode === "register" ? "register" : "login";
    const res = await fetch(`${API}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Auth failed");
      return;
    }

    localStorage.setItem("token", data.token);
    setToken(data.token);
    setEmail("");
    setPassword("");
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setTasks([]);
    setEditingId(null);
    setEditingTitle("");
    setError("");
  }

  async function addTask(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 2) return;

    setError("");

    const res = await fetch(`${API}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: trimmed,
        priority,
        status,
        dueDate: dueDate || null,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to add task");
      return;
    }

    setTasks((prev) => [data, ...prev]);
    setTitle("");
    setPriority("medium");
    setStatus("todo");
    setDueDate("");
  }

  async function deleteTask(id) {
    setError("");

    const res = await fetch(`${API}/api/tasks/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete task");
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  async function toggleCompleted(task) {
    setError("");

    const res = await fetch(`${API}/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ completed: !task.completed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to update task");
      return;
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
  }

  async function saveEdit(taskId) {
    const trimmed = editingTitle.trim();
    if (trimmed.length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }

    setError("");

    const res = await fetch(`${API}/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to update title");
      return;
    }

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, title: trimmed } : task)),
    );
    cancelEdit();
  }

  const visibleTasks = useMemo(() => {
    const priorityRank = { high: 3, medium: 2, low: 1 };

    return (tasks ?? [])
      .filter((task) => {
        const taskStatus = task.status ?? "todo";
        return filterStatus === "all" ? true : taskStatus === filterStatus;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const aPriority = priorityRank[a.priority ?? "medium"] ?? 2;
          const bPriority = priorityRank[b.priority ?? "medium"] ?? 2;
          return bPriority - aPriority;
        }

        if (sortBy === "due_date") {
          const aDue = a.dueDate ?? a.due_date ?? "";
          const bDue = b.dueDate ?? b.due_date ?? "";
          if (!aDue && !bDue) return 0;
          if (!aDue) return 1;
          if (!bDue) return -1;
          return aDue.localeCompare(bDue);
        }

        return (b.id ?? 0) - (a.id ?? 0);
      });
  }, [tasks, filterStatus, sortBy]);

  const stats = useMemo(() => {
    const allTasks = tasks ?? [];
    const completedCount = allTasks.filter((task) => task.completed).length;
    const activeCount = allTasks.length - completedCount;
    const dueSoonCount = allTasks.filter((task) => {
      const due = task.dueDate ?? task.due_date;
      if (!due) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDateValue = new Date(`${due}T00:00:00`);
      const diffDays = Math.round((dueDateValue - today) / 86400000);
      return diffDays >= 0 && diffDays <= 3;
    }).length;

    return {
      total: allTasks.length,
      completed: completedCount,
      active: activeCount,
      dueSoon: dueSoonCount,
    };
  }, [tasks]);

  return (
    <div className="task-page">
      <div className="task-container">
        <div className={`wrap ${isAuthed ? "is-dashboard" : "is-auth-shell"}`}>
          <div className="app-shell-header">
            <div>
              <Link className="home-link" to="/">
                ← Back to home
              </Link>
              <p className="eyebrow">Personal command center</p>
              <h1>{isAuthed ? "Focus on what moves today." : "A calmer way to run your day."}</h1>
            </div>

            {isAuthed ? (
              <div className="actions">
                <button className="btn btn-soft" type="button" onClick={loadTasks}>
                  Refresh
                </button>
                <button className="btn btn-danger" type="button" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          {error ? <div className="error">{error}</div> : null}

          {!isAuthed ? (
            <div className="auth-layout">
              <div className="auth-copy">
                <div className="auth-copy-card">
                  <span className="auth-badge">Built for deliberate work</span>
                  <h2>Plan less frantically. Execute more clearly.</h2>
                  <p>
                    Capture tasks, set real priorities, and keep due dates visible without
                    drowning in clutter.
                  </p>
                  <div className="auth-points">
                    <div>
                      <strong>Priority aware</strong>
                      <span>See what deserves attention first.</span>
                    </div>
                    <div>
                      <strong>Fast updates</strong>
                      <span>Edit, complete, and clean up in place.</span>
                    </div>
                    <div>
                      <strong>Private by default</strong>
                      <span>Your tasks stay scoped to your account.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card auth-card">
                <div className="tabs">
                  <button
                    type="button"
                    className={`tab ${mode === "login" ? "active" : ""}`}
                    onClick={() => setMode("login")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={`tab ${mode === "register" ? "active" : ""}`}
                    onClick={() => setMode("register")}
                  >
                    Register
                  </button>
                </div>

                <div className="auth-card-copy">
                  <h3>{mode === "register" ? "Create your workspace" : "Welcome back"}</h3>
                  <p>
                    {mode === "register"
                      ? "Start with a clean system for tasks, deadlines, and momentum."
                      : "Pick up where you left off and keep the day under control."}
                  </p>
                </div>

                <form className="col" onSubmit={submitAuth}>
                  <label className="field">
                    <span>Email</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Password</span>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="Minimum 6 characters"
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      required
                      minLength={6}
                    />
                  </label>

                  <div className="row">
                    <button className="btn btn-primary btn-wide" type="submit">
                      {mode === "register" ? "Create account" : "Login"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <>
              <section className="hero-panel">
                <div className="hero-panel-copy">
                  <span className="section-kicker">Today at a glance</span>
                  <h2>{stats.active} active tasks, {stats.dueSoon} due soon.</h2>
                  <p>
                    Use the board below to capture new work, sort by urgency, and keep completed
                    items from stealing attention.
                  </p>
                </div>
                <div className="stats-grid">
                  <div className="stat-card accent-coral">
                    <span>Total</span>
                    <strong>{stats.total}</strong>
                  </div>
                  <div className="stat-card accent-ink">
                    <span>Active</span>
                    <strong>{stats.active}</strong>
                  </div>
                  <div className="stat-card accent-gold">
                    <span>Due soon</span>
                    <strong>{stats.dueSoon}</strong>
                  </div>
                  <div className="stat-card accent-mint">
                    <span>Completed</span>
                    <strong>{stats.completed}</strong>
                  </div>
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="card composer-card">
                  <div className="card-heading">
                    <div>
                      <p className="card-kicker">Create</p>
                      <h3>Add a focused task</h3>
                    </div>
                  </div>

                  <form className="col" onSubmit={addTask}>
                    <label className="field">
                      <span>Task title</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Prepare client proposal"
                      />
                    </label>

                    <div className="control-grid">
                      <label className="field">
                        <span>Priority</span>
                        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Status</span>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                          <option value="todo">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Due date</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="row">
                      <button className="btn btn-primary btn-wide" type="submit">
                        Add task
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card filter-card">
                  <div className="card-heading">
                    <div>
                      <p className="card-kicker">View</p>
                      <h3>Shape the list</h3>
                    </div>
                  </div>

                  <div className="control-grid">
                    <label className="field">
                      <span>Status filter</span>
                      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="all">All</option>
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Sort by</span>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="newest">Newest</option>
                        <option value="priority">Priority</option>
                        <option value="due_date">Due date</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="list-shell">
                <div className="list-header">
                  <div>
                    <p className="card-kicker">Tasks</p>
                    <h3>Your current queue</h3>
                  </div>
                  <span className="list-count">
                    {visibleTasks.length} item{visibleTasks.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ul className="list">
                  {visibleTasks.map((task) => {
                    const due = task.dueDate ?? task.due_date ?? "";
                    const taskStatus = task.status ?? "todo";
                    const taskPriority = task.priority ?? "medium";
                    const completed = !!task.completed;

                    return (
                      <li className={`item priority-${taskPriority}`} key={task.id}>
                        <div className="left">
                          <input
                            type="checkbox"
                            checked={completed}
                            onChange={() => toggleCompleted(task)}
                            title="Toggle completed"
                          />

                          {editingId === task.id ? (
                            <input
                              className="editInput"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(task.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                            />
                          ) : (
                            <div className="task-copy">
                              <div className={completed ? "done" : ""}>
                                <strong>{task.title}</strong>
                              </div>
                              <div className="meta-row">
                                <span className={`pill pill-${taskPriority}`}>{taskPriority}</span>
                                <span className="pill pill-neutral">
                                  {taskStatus.replace("_", " ")}
                                </span>
                                {due ? <span className="pill pill-neutral">due {due}</span> : null}
                              </div>
                              <div className="hint">
                                {completed
                                  ? "Completed task"
                                  : taskStatus === "in_progress"
                                    ? "In progress"
                                    : "Ready to start"}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="actions">
                          {editingId === task.id ? (
                            <>
                              <button
                                className="btn btn-soft"
                                type="button"
                                onClick={() => saveEdit(task.id)}
                              >
                                Save
                              </button>
                              <button className="btn btn-soft" type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-soft"
                              type="button"
                              onClick={() => startEdit(task)}
                            >
                              Edit
                            </button>
                          )}

                          <button
                            className="btn btn-danger"
                            type="button"
                            onClick={() => deleteTask(task.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
