"use client";

import { MessageSquare, FolderTree, Terminal, Clock, Settings } from "lucide-react";
import type { PanelId } from "@/app/page";

interface SidebarProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  hasUnreadChat?: boolean;
}

interface SidebarItem {
  id: PanelId;
  icon: React.ReactNode;
  label: string;
}

const topItems: SidebarItem[] = [
  { id: "chat", icon: <MessageSquare size={20} />, label: "Chat" },
  { id: "files", icon: <FolderTree size={20} />, label: "Files" },
  { id: "terminal", icon: <Terminal size={20} />, label: "Terminal" },
  { id: "history", icon: <Clock size={20} />, label: "History" },
];

const bottomItems: SidebarItem[] = [
  { id: "settings", icon: <Settings size={20} />, label: "Settings" },
];

export default function Sidebar({ activePanel, onPanelChange, hasUnreadChat }: SidebarProps) {
  return (
    <div
      style={{
        width: 52,
        minWidth: 52,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        paddingTop: 8,
        paddingBottom: 8,
        gap: 2,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
          color: "#fff",
          fontFamily: "var(--font-mono)",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        O
      </div>

      {/* Top icons */}
      {topItems.map((item) => (
        <SidebarButton
          key={item.id}
          item={item}
          isActive={activePanel === item.id}
          onClick={() => onPanelChange(item.id)}
          showDot={item.id === "chat" && !!hasUnreadChat}
        />
      ))}

      {/* Push settings to bottom */}
      <div style={{ marginTop: "auto" }} />

      {/* Bottom icons */}
      {bottomItems.map((item) => (
        <SidebarButton
          key={item.id}
          item={item}
          isActive={activePanel === item.id}
          onClick={() => onPanelChange(item.id)}
        />
      ))}
    </div>
  );
}

function SidebarButton({
  item,
  isActive,
  onClick,
  showDot,
}: {
  item: SidebarItem;
  isActive: boolean;
  onClick: () => void;
  showDot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      style={{
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-md)",
        color: isActive ? "var(--accent)" : "var(--text-dim)",
        background: isActive ? "var(--accent-dim)" : "transparent",
        transition: "color 0.15s, background 0.15s",
        flexShrink: 0,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--text-dim)";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {item.icon}
      {showDot && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "1.5px solid var(--surface)",
          }}
        />
      )}
    </button>
  );
}
