// Import React hooks:
// - useState: store component state (token, form fields, tasks, filters, etc.)
// - useEffect: run side effects (e.g., load tasks when token changes)
// - useMemo: compute derived values efficiently (filtered/sorted task list)
import { useEffect, useMemo, useState } from "react";

// Import CSS styling for this component/app UI
import "./App.css";

// Base URL for your backend API.
// - In production (Render), VITE_API_URL comes from Render Environment Variables on the frontend service.
// - Locally, it falls back to http://localhost:3001
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

// This is the main TaskApp component
export default function TaskApp() {
  // ----------------------------
  // AUTH STATE
  // ----------------------------

  // token stores the JWT token used for authenticated requests.
  // We initialize it from localStorage so the user stays logged in after refresh.
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  // mode decides which auth screen we are on: "login" or "register"
  const [mode, setMode] = useState("login"); // "login" | "register"

  // Controlled inputs for email + password fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ----------------------------
  // TASK CREATION / TASK DATA STATE
  // ----------------------------

  // tasks array holds all tasks loaded from the backend for the logged-in user
  const [tasks, setTasks] = useState([]);

  // Controlled input for the "Task title..." field
  const [title, setTitle] = useState("");

  // These states represent extra task metadata selected in the form.
  // NOTE: Your backend *must support these fields* (priority/status/dueDate),
  // otherwise they won't be stored or returned. (Your current server code earlier
  // only stores title/completed/owner_id unless you add columns.)
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");

  // ----------------------------
  // FILTER / SORT UI STATE
  // ----------------------------

  // filterStatus controls which tasks appear (all/todo/in_progress/done)
  const [filterStatus, setFilterStatus] = useState("all");

  // sortBy controls ordering (newest/priority/due_date)
  const [sortBy, setSortBy] = useState("newest");

  // ----------------------------
  // EDITING STATE
  // ----------------------------

  // editingId holds the task id currently being edited (or null if none)
  const [editingId, setEditingId] = useState(null);

  // editingTitle holds the temporary edited text for the selected task
  const [editingTitle, setEditingTitle] = useState("");

  // ----------------------------
  // ERROR STATE
  // ----------------------------

  // error is a string used to display API errors in the UI
  const [error, setError] = useState("");

  // isAuthed is true if token exists (truthy)
  // Used to switch UI between "auth screen" and "task screen"
  const isAuthed = !!token;

  // ----------------------------
  // HELPERS
  // ----------------------------

  // Build the Authorization header for protected routes
  // Format required by your backend: "Authorization: Bearer <token>"
  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  // ----------------------------
  // API: LOAD TASKS
  // ----------------------------

  // Fetch tasks for the current user (requires token)
  async function loadTasks() {
    // If no token, don't request tasks (user not logged in)
    if (!token) return;

    // Clear any previous error
    setError("");

    // Make GET request to backend endpoint
    const res = await fetch(`${API}/api/tasks`, {
      headers: authHeaders(), // include Bearer token
    });

    // Parse JSON response (your backend always returns JSON)
    const data = await res.json();

    // If request failed, show error message and stop
    if (!res.ok) {
      setError(data.error || "Failed to load tasks");
      return;
    }

    // If successful, store tasks in state (triggers UI re-render)
    setTasks(data);
  }

  // ----------------------------
  // SIDE EFFECT: AUTO-LOAD TASKS WHEN TOKEN CHANGES
  // ----------------------------

  useEffect(() => {
    // Whenever token changes (login/logout), load tasks again
    loadTasks();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    // This comment disables lint warnings because loadTasks is declared inside
    // the component and would normally be added as a dependency.
    // Here, you're intentionally only re-running when token changes.
  }, [token]);

  // ----------------------------
  // API: LOGIN / REGISTER
  // ----------------------------

  async function submitAuth(e) {
    // Prevent the page from refreshing when form is submitted
    e.preventDefault();

    // Clear old errors
    setError("");

    // Decide endpoint based on current mode:
    // - register -> /api/auth/register
    // - login -> /api/auth/login
    const endpoint = mode === "register" ? "register" : "login";

    // Send POST request with email/password
    const res = await fetch(`${API}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // Parse JSON response
    const data = await res.json();

    // If auth fails (wrong password, email exists, etc.)
    if (!res.ok) {
      setError(data.error || "Auth failed");
      return;
    }

    // Extract JWT token from response
    const t = data.token;

    // Save token into localStorage (persists across refresh)
    localStorage.setItem("token", t);

    // Save token into React state (immediately updates UI to authed state)
    setToken(t);

    // Clear form fields after success
    setEmail("");
    setPassword("");
  }

  // ----------------------------
  // LOGOUT
  // ----------------------------

  function logout() {
    // Remove token from localStorage
    localStorage.removeItem("token");

    // Clear token from state (this will switch UI back to login screen)
    setToken("");

    // Clear tasks from memory
    setTasks([]);

    // Clear edit mode state
    setEditingId(null);
    setEditingTitle("");

    // Clear any error messages
    setError("");
  }

  // ----------------------------
  // API: ADD TASK
  // ----------------------------

  async function addTask(e) {
    // Prevent form submit refresh
    e.preventDefault();

    // Trim input title to remove extra spaces
    const trimmed = title.trim();

    // Simple validation: require at least 2 characters
    if (trimmed.length < 2) return;

    // Clear errors before request
    setError("");

    // Send POST request to create new task
    const res = await fetch(`${API}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        // Task title
        title: trimmed,

        // Extra fields included in request body (priority/status/dueDate)
        // IMPORTANT: backend must support these, or they will be ignored.
        priority,
        status,
        dueDate: dueDate || null, // send null if empty
      }),
    });

    // Parse response JSON
    const data = await res.json();

    // If create failed, show error
    if (!res.ok) {
      setError(data.error || "Failed to add task");
      return;
    }

    // Update UI immediately by adding new task at the top of the list
    // This avoids having to reload all tasks
    setTasks((prev) => [data, ...prev]);

    // Reset form fields to defaults
    setTitle("");
    setPriority("medium");
    setStatus("todo");
    setDueDate("");
  }

  // ----------------------------
  // API: DELETE TASK
  // ----------------------------

  async function deleteTask(id) {
    // Clear errors
    setError("");

    // Send DELETE request for that task
    const res = await fetch(`${API}/api/tasks/${id}`, {
      method: "DELETE",
      headers: authHeaders(), // Bearer token required
    });

    // Parse JSON response
    const data = await res.json();

    // If delete failed
    if (!res.ok) {
      setError(data.error || "Failed to delete task");
      return;
    }

    // Remove deleted task from UI state
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ----------------------------
  // API: TOGGLE COMPLETED
  // ----------------------------

  async function toggleCompleted(task) {
    // Clear errors
    setError("");

    // Send PUT request with new completed status
    const res = await fetch(`${API}/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ completed: !task.completed }),
    });

    // Parse JSON response
    const data = await res.json();

    // If update failed
    if (!res.ok) {
      setError(data.error || "Failed to update task");
      return;
    }

    // Update the task in UI state (without reloading all tasks)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    );
  }

  // ----------------------------
  // EDIT MODE HELPERS
  // ----------------------------

  // Start editing: set which task is being edited and load its title into input
  function startEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
  }

  // Cancel editing: reset edit state
  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
  }

  // ----------------------------
  // API: SAVE EDITED TITLE
  // ----------------------------

  async function saveEdit(taskId) {
    // Validate edited title
    const trimmed = editingTitle.trim();
    if (trimmed.length < 2) {
      setError("Title must be at least 2 characters.");
      return;
    }

    // Clear errors
    setError("");

    // Send PUT request to update title
    const res = await fetch(`${API}/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title: trimmed }),
    });

    // Parse JSON
    const data = await res.json();

    // If update failed
    if (!res.ok) {
      setError(data.error || "Failed to update title");
      return;
    }

    // Update task title locally in state
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
    );

    // Exit edit mode
    cancelEdit();
  }

  // ----------------------------
  // DERIVED DATA: FILTERED + SORTED TASKS
  // ----------------------------

  // useMemo recalculates visibleTasks only when tasks/filterStatus/sortBy change.
  // This prevents unnecessary filtering/sorting on every render.
  const visibleTasks = useMemo(() => {
    // Convert priority into numeric rank for sorting
    const priorityRank = { high: 3, medium: 2, low: 1 };

    return (tasks ?? [])
      // Filter tasks by status (or show all)
      .filter((t) => {
        // Support different task shapes by using fallback status
        const s = t.status ?? "todo";
        return filterStatus === "all" ? true : s === filterStatus;
      })
      // Sort tasks based on selected option
      .sort((a, b) => {
        // Sort by priority high->low
        if (sortBy === "priority") {
          const ap = priorityRank[a.priority ?? "medium"] ?? 2;
          const bp = priorityRank[b.priority ?? "medium"] ?? 2;
          return bp - ap;
        }

        // Sort by due date (earlier first)
        if (sortBy === "due_date") {
          // Try both camelCase and snake_case field names
          const ad = a.dueDate ?? a.due_date ?? "";
          const bd = b.dueDate ?? b.due_date ?? "";

          // Handle empty due dates so ones with a date appear first
          if (!ad && !bd) return 0;
          if (!ad) return 1;
          if (!bd) return -1;

          // Compare ISO date strings (YYYY-MM-DD) lexicographically
          return ad.localeCompare(bd);
        }

        // Default sort: newest first by id (assuming higher id means newer)
        return (b.id ?? 0) - (a.id ?? 0);
      });
  }, [tasks, filterStatus, sortBy]);

  // ----------------------------
  // UI RENDER
  // ----------------------------

  return (
    // Outer page wrapper
    <div className="task-page">
      <div className="task-container">
        <div className="wrap">
          {/* TOP BAR */}
          <div className="topbar">
            <h1>TaskApp</h1>

            {/* Only show Refresh/Logout if logged in */}
            {isAuthed ? (
              <div className="actions">
                {/* Refresh manually reloads tasks from backend */}
                <button className="btn btn-soft" type="button" onClick={loadTasks}>
                  Refresh
                </button>

                {/* Logout clears token and returns to login UI */}
                <button className="btn btn-danger" type="button" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          {/* ERROR BOX (only renders if error string exists) */}
          {error ? <div className="error">{error}</div> : null}

          {/* AUTH VIEW: shown when not logged in */}
          {!isAuthed ? (
            <div className="card">
              {/* Tabs to switch between Login and Register mode */}
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

              {/* Auth form (submit triggers submitAuth) */}
              <form className="col" onSubmit={submitAuth}>
                {/* Email field */}
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  required
                />

                {/* Password field */}
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

                {/* Submit button changes label depending on mode */}
                <div className="row">
                  <button className="btn btn-primary" type="submit">
                    {mode === "register" ? "Create account" : "Login"}
                  </button>
                </div>

                {/* You removed the API label here (good for production UI) */}
              </form>
            </div>
          ) : (
            // TASK VIEW: shown when logged in
            <>
              {/* ADD TASK FORM */}
              <div className="card">
                <form className="col" onSubmit={addTask}>
                  <div className="row">
                    {/* Task title input */}
                    <input
                      style={{ flex: 1, minWidth: 240 }}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Task title..."
                    />

                    {/* Priority dropdown */}
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>

                    {/* Status dropdown */}
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>

                    {/* Due date input */}
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />

                    {/* Add task submit */}
                    <button className="btn btn-primary" type="submit">
                      Add
                    </button>
                  </div>

                  {/* FILTERS + SORT */}
                  <div className="row">
                    {/* Filter tasks by status */}
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">all</option>
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>

                    {/* Sort tasks */}
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="newest">newest</option>
                      <option value="priority">priority</option>
                      <option value="due_date">due_date</option>
                    </select>
                  </div>
                </form>
              </div>

              {/* TASK LIST */}
              <ul className="list">
                {visibleTasks.map((t) => {
                  // Safely read possible field names (camelCase vs snake_case)
                  const due = t.dueDate ?? t.due_date ?? "";
                  const s = t.status ?? "todo";
                  const p = t.priority ?? "medium";

                  // Convert completed into true/false
                  const completed = !!t.completed;

                  return (
                    <li className="item" key={t.id}>
                      <div className="left">
                        {/* Checkbox toggles completed status */}
                        <input
                          type="checkbox"
                          checked={completed}
                          onChange={() => toggleCompleted(t)}
                          title="Toggle completed"
                        />

                        {/* If this task is being edited, show input box */}
                        {editingId === t.id ? (
                          <input
                            className="editInput"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              // Enter saves
                              if (e.key === "Enter") saveEdit(t.id);
                              // Escape cancels
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                          />
                        ) : (
                          // Otherwise show normal display
                          <div>
                            {/* Title (line-through if completed) */}
                            <div className={completed ? "done" : ""}>
                              <strong>{t.title}</strong>
                            </div>

                            {/* Small metadata line */}
                            <div className="hint">
                              {p} • {s}
                              {due ? ` • due ${due}` : ""}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ACTION BUTTONS (Edit/Save/Cancel/Delete) */}
                      <div className="actions">
                        {editingId === t.id ? (
                          <>
                            {/* Save edited title */}
                            <button
                              className="btn btn-soft"
                              type="button"
                              onClick={() => saveEdit(t.id)}
                            >
                              Save
                            </button>

                            {/* Cancel editing */}
                            <button
                              className="btn btn-soft"
                              type="button"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          // If not editing, show Edit button
                          <button
                            className="btn btn-soft"
                            type="button"
                            onClick={() => startEdit(t)}
                          >
                            Edit
                          </button>
                        )}

                        {/* Delete the task */}
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
