"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            width: "100vw",
            background: "var(--bg)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              maxWidth: 400,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                color: "var(--danger)",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
              }}
            >
              !
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                Something went wrong
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {this.state.error?.message || "An unexpected error occurred in the application."}
              </p>
            </div>

            <button
              onClick={this.handleReset}
              style={{
                marginTop: 4,
                padding: "8px 20px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--bg)",
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.02em",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--accent)";
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
