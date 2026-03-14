"use client";

import { Plus } from "lucide-react";
import type { Conversation } from "@/types";

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";

  const date = new Date(ts);
  const nowDate = new Date(now);

  if (date.getFullYear() === nowDate.getFullYear()) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function getConversationTitle(conversation: Conversation): string {
  if (conversation.title) {
    return truncate(conversation.title, 40);
  }
  const firstUserMsg = conversation.messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    const firstLine = firstUserMsg.content.split("\n")[0];
    return truncate(firstLine, 40);
  }
  return "New conversation";
}

export default function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onNew,
}: ConversationHistoryProps) {
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
        History
      </div>
      {/* New Chat button */}
      <div style={{ padding: "4px 8px 8px" }}>
        <button
          onClick={onNew}
          style={{
            width: "100%",
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "transparent",
            border: "1px solid #0d9488",
            borderRadius: 6,
            color: "#0d9488",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#0d948815";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>
      {/* Conversation list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 8,
        }}
      >
        {conversations.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              fontSize: 13,
              color: "#555",
              textAlign: "center",
            }}
          >
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(conv.id);
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: isActive ? "#111" : "transparent",
                  borderLeft: isActive
                    ? "2px solid #0d9488"
                    : "2px solid transparent",
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = "#0a0a0a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "transparent";
                  }
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isActive ? "#ccc" : "#888",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: "18px",
                  }}
                >
                  {getConversationTitle(conv)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#555",
                    marginTop: 2,
                    lineHeight: "14px",
                  }}
                >
                  {formatTimestamp(conv.updatedAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
