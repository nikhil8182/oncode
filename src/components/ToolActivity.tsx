"use client";

import { useMemo } from "react";
import { formatRelativeTime } from "@/lib/utils";
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

function statusColor(status: ToolCall["status"]): string {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "running":
      return "#eab308";
    case "error":
      return "var(--danger)";
    case "pending":
    default:
      return "var(--text-dim)";
  }
}

export default function ToolActivity({ toolCalls }: ToolActivityProps) {
  // Newest first
  const sorted = useMemo(
    () => [...toolCalls].sort((a, b) => b.timestamp - a.timestamp),
    [toolCalls]
  );

  return (
    <div className="panel-card">
      <div className="panel-card-header">Tool Activity</div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 8,
        }}
      >
        {sorted.length === 0 ? (
          <div className="panel-empty">No activity yet</div>
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
                      ? "skeleton-pulse 1.5s ease-in-out infinite"
                      : "none",
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily:
                    call.name === "bash" || call.name === "Bash"
                      ? "var(--font-mono)"
                      : "inherit",
                }}
              >
                {formatToolName(call)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {formatRelativeTime(call.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
