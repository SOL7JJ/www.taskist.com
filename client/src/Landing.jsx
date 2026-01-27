import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    const onDocClick = (e) => {
      if (!menuOpen) return;

      const menu = document.getElementById("mobileMenu");
      const btn = document.getElementById("menuBtn");
      if (!menu || !btn) return;

      const clickedInside = menu.contains(e.target) || btn.contains(e.target);
      if (!clickedInside) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onDocClick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocClick);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="site-header">
        <div className="container nav">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true">
              ✓
            </span>
            <span className="brand-name">Taskist</span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#" className="nav-link has-caret">
              Made For
            </a>
            <a href="#" className="nav-link has-caret">
              Resources
            </a>
            <a href="#" className="nav-link">
              Pricing
            </a>
          </nav>

          <div className="nav-actions">
            <Link className="nav-link subtle" to="/app">
              Log in
            </Link>

            <Link className="btn btn-primary" to="/app">
              Start for free
            </Link>

            <button
              className="icon-btn"
              id="menuBtn"
              aria-label="Open menu"
              aria-expanded={menuOpen ? "true" : "false"}
              aria-controls="mobileMenu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="icon-btn-bar" />
              <span className="icon-btn-bar" />
              <span className="icon-btn-bar" />
            </button>
          </div>
        </div>

        <div
          className={`mobile-menu ${menuOpen ? "is-open" : ""}`}
          id="mobileMenu"
          aria-hidden={menuOpen ? "false" : "true"}
        >
          <div className="container mobile-menu-inner">
            <a href="#" className="mobile-link" onClick={() => setMenuOpen(false)}>
              Made For
            </a>
            <a href="#" className="mobile-link" onClick={() => setMenuOpen(false)}>
              Resources
            </a>
            <a href="#" className="mobile-link" onClick={() => setMenuOpen(false)}>
              Pricing
            </a>
            <div className="mobile-divider" />

            <Link className="mobile-link" to="/app" onClick={() => setMenuOpen(false)}>
              Log in
            </Link>
            <Link className="btn btn-primary btn-block" to="/app" onClick={() => setMenuOpen(false)}>
              Start for free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">Clarity, finally.</h1>
              <p className="hero-subtitle">
                Join 50+ million professionals who simplify work and life with the world’s #1 to-do
                list app.
              </p>

              <div className="hero-badges">
                <div className="badge" role="group" aria-label="Platform badges">
                  <span className="badge-pill" title="Apple">
                    
                  </span>
                  <span className="badge-pill" title="Android">
                    🤖
                  </span>
                  <span className="badge-pill badge-reviews">
                    <strong>374K+</strong>
                    <span className="stars" aria-label="Rating">
                      ★★★★★
                    </span>
                    <span className="muted">reviews</span>
                  </span>
                </div>
              </div>

              <div className="hero-cta">
                <Link className="btn btn-primary btn-xl" to="/app">
                  Start for free
                </Link>
              </div>
            </div>

            <div className="hero-visual">
              <div className="visual-card">
                <div className="visual-glow" aria-hidden="true" />

                <div className="visual-frame">
                  <div className="fake-app">
                    <div className="fake-sidebar">
                      <div className="fake-user">
                        <div className="avatar" />
                        <div className="fake-user-meta">
                          <div className="line line-strong" />
                          <div className="line line-soft" />
                        </div>
                      </div>

                      <div className="fake-nav">
                        <div className="fake-nav-item active" />
                        <div className="fake-nav-item" />
                        <div className="fake-nav-item" />
                        <div className="fake-nav-item" />
                      </div>
                    </div>

                    <div className="fake-main">
                      <div className="fake-main-top">
                        <div className="line line-title" />
                        <div className="chips">
                          <span className="chip" />
                          <span className="chip" />
                        </div>
                      </div>

                      <div className="fake-list">
                        {[1, 2, 3, 4].map((n) => (
                          <div className="fake-task" key={n}>
                            <span className="dot" />
                            <div>
                              <div className="line line-strong" />
                              <div className="line line-soft" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="fake-phone" aria-hidden="true">
                      <div className="phone-notch" />
                      <div className="phone-card" />
                      <div className="phone-card" />
                      <div className="phone-card" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="press-band">
            <div className="container press-grid">
              <blockquote className="press-quote">
                “Simple, straightforward, and super powerful”
                <span className="press-logo">THE VERGE</span>
              </blockquote>

              <blockquote className="press-quote bordered">
                “The best to-do list app on the market”
                <span className="press-logo">PC MAG</span>
              </blockquote>

              <blockquote className="press-quote">
                “Nothing short of stellar”
                <span className="press-logo">techradar</span>
              </blockquote>
            </div>
          </div>
        </section>

        <section className="section features">
          <div className="container">
            <h2 className="section-title">Everything you need to stay organised</h2>

            <div className="feature-grid">
              <div className="feature-card">
                <h3>Plan your day</h3>
                <p>Create tasks in seconds and organise them by priority and due date.</p>
              </div>

              <div className="feature-card">
                <h3>Track progress</h3>
                <p>Move tasks through stages and always know what’s done.</p>
              </div>

              <div className="feature-card">
                <h3>Stay focused</h3>
                <p>See only what matters today and reduce mental clutter.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section how">
          <div className="container how-grid">
            <div>
              <h2 className="section-title">How it works</h2>
              <p className="section-text">
                Capture tasks, organise them into projects, and complete your work with clarity and
                confidence.
              </p>
              <ul className="how-list">
                <li>Add a task</li>
                <li>Set a due date</li>
                <li>Mark it complete</li>
              </ul>
            </div>

            <div className="how-visual">
              <div className="visual-placeholder">Your App Screenshot</div>
            </div>
          </div>
        </section>

        <section className="section cta">
          <div className="container cta-box">
            <h2>Get started for free</h2>
            <p>No credit card required. Start organising your work today.</p>
            <Link className="btn btn-primary btn-xl" to="/app">
              Start for free
            </Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <strong>Taskist</strong>
            <p className="muted">Simple task management for modern work.</p>
          </div>

          <div className="footer-links">
            <a href="#">Product</a>
            <a href="#">Pricing</a>
            <a href="#">Resources</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
