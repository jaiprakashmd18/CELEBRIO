"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAF8F3", color: "#20201F", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif" }}>Celebrio is having trouble loading</h1>
          <p>Please refresh the page. Your saved work is safe.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#20201F", color: "#FAF8F3" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
