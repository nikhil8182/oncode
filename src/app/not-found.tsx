import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#cccccc",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "#0d9488",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 800,
          color: "#fff",
          fontFamily:
            "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          marginBottom: 32,
        }}
      >
        O
      </div>

      <h1
        style={{
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#555555",
          marginBottom: 8,
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: 16,
          color: "#888888",
          marginBottom: 32,
        }}
      >
        Page not found
      </p>

      <Link
        href="/"
        style={{
          fontSize: 14,
          color: "#0d9488",
          padding: "10px 24px",
          borderRadius: 8,
          border: "1px solid rgba(13, 148, 136, 0.3)",
          background: "rgba(13, 148, 136, 0.08)",
          textDecoration: "none",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        Back to Oncode
      </Link>
    </div>
  );
}
