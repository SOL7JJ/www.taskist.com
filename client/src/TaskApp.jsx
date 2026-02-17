import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function TaskApp() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [mode, setMode] = useState("login"); // "login" | "register"
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
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const t = data.token;
    localStorage.setItem("token", t);
    setToken(t);

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

    setTasks((prev) => prev.filter((t) => t.id !== id));
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
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
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
      prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
    );

    cancelEdit();
  }

  const visibleTasks = useMemo(() => {
    const priorityRank = { high: 3, medium: 2, low: 1 };

    return (tasks ?? [])
      .filter((t) => {
        const s = t.status ?? "todo";
        return filterStatus === "all" ? true : s === filterStatus;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const ap = priorityRank[a.priority ?? "medium"] ?? 2;
          const bp = priorityRank[b.priority ?? "medium"] ?? 2;
          return bp - ap;
        }

        if (sortBy === "due_date") {
          const ad = a.dueDate ?? a.due_date ?? "";
          const bd = b.dueDate ?? b.due_date ?? "";
          if (!ad && !bd) return 0;
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }

        return (b.id ?? 0) - (a.id ?? 0);
      });
  }, [tasks, filterStatus, sortBy]);

  return (
    <div className="task-page">
      <div className="task-container">
        <div className="wrap">
          <div className="topbar">
            <h1>TaskApp</h1>

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
            <div className="card">
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

              <form className="col" onSubmit={submitAuth}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  required
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Password (min 6 chars)"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                />

                <div className="row">
                  <button className="btn btn-primary" type="submit">
                    {mode === "register" ? "Create account" : "Login"}
                  </button>
                </div>

               
              </form>
            </div>
          ) : (
            <>
              <div className="card">
                <form className="col" onSubmit={addTask}>
                  <div className="row">
                    <input
                      style={{ flex: 1, minWidth: 240 }}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Task title..."
                    />

                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>

                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>

                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />

                    <button className="btn btn-primary" type="submit">
                      Add
                    </button>
                  </div>

                  <div className="row">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">all</option>
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>

                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="newest">newest</option>
                      <option value="priority">priority</option>
                      <option value="due_date">due_date</option>
                    </select>
                  </div>
                </form>
              </div>

              <ul className="list">
                {visibleTasks.map((t) => {
                  const due = t.dueDate ?? t.due_date ?? "";
                  const s = t.status ?? "todo";
                  const p = t.priority ?? "medium";
                  const completed = !!t.completed;

                  return (
                    <li className="item" key={t.id}>
                      <div className="left">
                        <input
                          type="checkbox"
                          checked={completed}
                          onChange={() => toggleCompleted(t)}
                          title="Toggle completed"
                        />

                        {editingId === t.id ? (
                          <input
                            className="editInput"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(t.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                          />
                        ) : (
                          <div>
                            <div className={completed ? "done" : ""}>
                              <strong>{t.title}</strong>
                            </div>
                            <div className="hint">
                              {p} • {s}
                              {due ? ` • due ${due}` : ""}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="actions">
                        {editingId === t.id ? (
                          <>
                            <button
                              className="btn btn-soft"
                              type="button"
                              onClick={() => saveEdit(t.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-soft"
                              type="button"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-soft"
                            type="button"
                            onClick={() => startEdit(t)}
                          >
                            Edit
                          </button>
                        )}

                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
