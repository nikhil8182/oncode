"use client";

import type { ToolCall } from "@/types";

interface ToolActivityProps {
  toolCalls: ToolCall[];
}

function formatToolName(call: ToolCall): string {
  const name = call.name;
  const input = call.input;

  if (name === "bash" || name === "Bash") {
    const cmd = (input.command as string) || "";
    const short = cmd.length > 40 ? cmd.slice(0, 40) + "..." : cmd;
    return `$ ${short}`;
  }

  if (name === "read_file" || name === "Read") {
    const filePath = (input.file_path as string) || (input.path as string) || "";
    const fileName = filePath.split("/").pop() || filePath;
    return `Read ${fileName}`;
  }

  if (name === "write_file" || name === "Write") {
    const filePath = (input.file_path as string) || (input.path as string) || "";
    const fileName = filePath.split("/").pop() || filePath;
    return `Write ${fileName}`;
  }

  if (name === "edit_file" || name === "Edit") {
    const filePath = (input.file_path as string) || (input.path as string) || "";
    const fileName = filePath.split("/").pop() || filePath;
    return `Edit ${fileName}`;
  }

  if (name === "grep" || name === "Grep") {
    const pattern = (input.pattern as string) || "";
    const short = pattern.length > 30 ? pattern.slice(0, 30) + "..." : pattern;
    return `Grep '${short}'`;
  }

  if (name === "glob" || name === "Glob") {
    const pattern = (input.pattern as string) || "";
    return `Glob ${pattern}`;
  }

  // Generic: convert snake_case to title case
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 2000) return "now";

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: ToolCall["status"]): string {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "running":
      return "#eab308";
    case "error":
      return "#ef4444";
    case "pending":
    default:
      return "#555";
  }
}

export default function ToolActivity({ toolCalls }: ToolActivityProps) {
  // Newest first
  const sorted = [...toolCalls].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div
      style={{
        background: "#0f0f0f",
        borderRadius: 8,
        border: "1px solid #1a1a1a",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "10px 12px 6px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#555",
          textTransform: "uppercase",
        }}
      >
        Tool Activity
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 8,
        }}
      >
        {sorted.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              fontSize: 13,
              color: "#555",
              textAlign: "center",
            }}
          >
            No activity yet
          </div>
        ) : (
          sorted.map((call) => (
            <div
              key={call.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 12px",
                gap: 8,
                minHeight: 28,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: statusColor(call.status),
                  flexShrink: 0,
                  animation:
                    call.status === "running"
                      ? "ta-pulse 1.5s ease-in-out infinite"
                      : "none",
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#ccc",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily:
                    call.name === "bash" || call.name === "Bash"
                      ? "'SF Mono', 'Fira Code', 'Cascadia Code', monospace"
                      : "inherit",
                }}
              >
                {formatToolName(call)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#555",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {relativeTime(call.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
      <style>{`
        @keyframes ta-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
