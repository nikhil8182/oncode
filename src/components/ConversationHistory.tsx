"use client";

import { Plus } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
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
    <div className="panel-card">
      <div className="panel-card-header">History</div>
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
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-md)",
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-dim)";
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
          <div className="panel-empty">No conversations yet</div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                className="list-item"
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
                  background: isActive ? "var(--surface-alt)" : undefined,
                  borderLeft: isActive
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isActive ? "var(--text)" : "var(--text-muted)",
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
                    color: "var(--text-dim)",
                    marginTop: 2,
                    lineHeight: "14px",
                  }}
                >
                  {formatRelativeTime(conv.updatedAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
