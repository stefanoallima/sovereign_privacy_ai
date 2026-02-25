import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", padding: "2rem",
          fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Sovereign AI crashed on startup
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1.5rem", textAlign: "center" }}>
            Please report this at{" "}
            <a href="https://github.com/stefanoallima/sovereign_privacy_ai/issues"
              style={{ color: "#6c63ff" }}>
              github.com/stefanoallima/sovereign_privacy_ai/issues
            </a>
          </p>
          <pre style={{
            background: "#f4f4f5", borderRadius: "6px", padding: "1rem",
            fontSize: "0.75rem", maxWidth: "600px", width: "100%",
            overflow: "auto", color: "#dc2626",
          }}>
            {err.message}
            {err.stack ? "\n\n" + err.stack : ""}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem", padding: "0.5rem 1.5rem", borderRadius: "6px",
              background: "#6c63ff", color: "#fff", border: "none",
              cursor: "pointer", fontSize: "0.875rem",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
