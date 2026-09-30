"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-PK">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f9f9ff", color: "#151c27", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#575e70" }}>Please try again.</p>
          <button onClick={reset} style={{ marginTop: 12, height: 44, padding: "0 20px", borderRadius: 8, border: 0, background: "#006948", color: "#fff", fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
