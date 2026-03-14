"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Project, Conversation } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { withAuthToken } from "@/lib/client-auth";
import Sidebar from "@/components/Sidebar";
import FileExplorer from "@/components/FileExplorer";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ToolActivity from "@/components/ToolActivity";
import TerminalPanel from "@/components/TerminalPanel";
import ProjectPicker from "@/components/ProjectPicker";
import ConversationHistory from "@/components/ConversationHistory";
import Settings from "@/components/Settings";
import ErrorBoundary from "@/components/ErrorBoundary";

export type PanelId = "chat" | "files" | "terminal" | "history" | "settings";

const PANEL_ORDER: PanelId[] = ["chat", "files", "terminal", "history", "settings"];

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelId>("chat");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);

  // --- Collapsible panel state ---
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const explorerWidthBeforeCollapse = useRef(240);
  const rightPanelWidthBeforeCollapse = useRef(280);

  // --- Unread chat state ---
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const activePanelRef = useRef(activePanel);
  activePanelRef.current = activePanel;

  const {
    connected,
    reconnecting,
    sendMessage,
    messages,
    toolCalls,
    terminalOutputs,
    isStreaming,
    activeConversationId,
    loadConversation,
    newConversation,
  } = useSocket();

  // --- Conversation history state ---
  const [conversations, setConversations] = useState<Conversation[]>([]);

  /** Fetch conversations from the API. */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(withAuthToken("/api/conversations"));
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Re-fetch conversations whenever the active conversation changes (i.e., after a save)
  useEffect(() => {
    if (activeConversationId) {
      fetchConversations();
    }
  }, [activeConversationId, fetchConversations]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      loadConversation(id);
    },
    [loadConversation]
  );

  // Track "waiting for response" state: true after user sends, false once streaming starts
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  const handleNewConversation = useCallback(() => {
    newConversation();
    setIsWaitingForResponse(false);
  }, [newConversation]);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    // When a new assistant message arrives (message count increased and last is assistant), clear waiting
    if (messages.length > prevMessageCountRef.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        setIsWaitingForResponse(false);
        // Mark unread if not on the chat panel
        if (activePanelRef.current !== "chat") {
          setHasUnreadChat(true);
        }
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // Also clear waiting when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setIsWaitingForResponse(false);
    }
  }, [isStreaming]);

  // Clear unread when switching to chat panel
  const handlePanelChange = useCallback((panel: PanelId) => {
    setActivePanel(panel);
    if (panel === "chat") {
      setHasUnreadChat(false);
    }
  }, []);

  // --- Task 4: Update document title based on selected project ---
  useEffect(() => {
    document.title = selectedProject
      ? `Oncode \u2014 ${selectedProject.name}`
      : "Oncode";
  }, [selectedProject]);

  // --- Task 1: Global keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K: Focus chat input
      if (mod && e.key === "k") {
        e.preventDefault();
        const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
        if (input) {
          input.focus();
          // Also switch to chat panel if not already there
          setActivePanel("chat");
          setHasUnreadChat(false);
        }
        return;
      }

      // Cmd+Shift+N / Ctrl+Shift+N: New chat
      if (mod && e.shiftKey && e.key === "N") {
        e.preventDefault();
        newConversation();
        setIsWaitingForResponse(false);
        setActivePanel("chat");
        setHasUnreadChat(false);
        return;
      }

      // Cmd+1-5 / Ctrl+1-5: Switch sidebar panels
      if (mod && !e.shiftKey && e.key >= "1" && e.key <= "5") {
        const idx = parseInt(e.key) - 1;
        if (idx < PANEL_ORDER.length) {
          e.preventDefault();
          const panel = PANEL_ORDER[idx];
          setActivePanel(panel);
          if (panel === "chat") {
            setHasUnreadChat(false);
          }
        }
        return;
      }

      // Escape: Unfocus chat input
      if (e.key === "Escape") {
        const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
        if (input && document.activeElement === input) {
          e.preventDefault();
          input.blur();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [newConversation]);

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content, selectedProject?.path ?? "");
      setIsWaitingForResponse(true);
    },
    [sendMessage, selectedProject]
  );

  const handleNewChat = useCallback(() => {
    newConversation();
    setIsWaitingForResponse(false);
  }, [newConversation]);

  const handleFileSelect = useCallback((path: string) => {
    // TODO: open file in editor / preview
    console.log("File selected:", path);
  }, []);

  // --- Task 6: Collapsible panels via double-click ---
  const handleDoubleClickExplorer = useCallback(() => {
    if (explorerCollapsed) {
      // Expand
      setExplorerCollapsed(false);
      setExplorerWidth(explorerWidthBeforeCollapse.current);
    } else {
      // Collapse
      explorerWidthBeforeCollapse.current = explorerWidth;
      setExplorerCollapsed(true);
      setExplorerWidth(0);
    }
  }, [explorerCollapsed, explorerWidth]);

  const handleDoubleClickRightPanel = useCallback(() => {
    if (rightPanelCollapsed) {
      // Expand
      setRightPanelCollapsed(false);
      setRightPanelWidth(rightPanelWidthBeforeCollapse.current);
    } else {
      // Collapse
      rightPanelWidthBeforeCollapse.current = rightPanelWidth;
      setRightPanelCollapsed(true);
      setRightPanelWidth(0);
    }
  }, [rightPanelCollapsed, rightPanelWidth]);

  const handleResizeExplorer = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // If collapsed, ignore drag (double-click to expand)
      if (explorerCollapsed) return;
      const startX = e.clientX;
      const startWidth = explorerWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(160, Math.min(400, startWidth + delta));
        setExplorerWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [explorerWidth, explorerCollapsed]
  );

  const handleResizeRightPanel = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // If collapsed, ignore drag (double-click to expand)
      if (rightPanelCollapsed) return;
      const startX = e.clientX;
      const startWidth = rightPanelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX;
        const newWidth = Math.max(200, Math.min(480, startWidth + delta));
        setRightPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [rightPanelWidth, rightPanelCollapsed]
  );

  const effectiveExplorerWidth = explorerCollapsed ? 0 : explorerWidth;
  const effectiveRightPanelWidth = rightPanelCollapsed ? 0 : rightPanelWidth;

  return (
    <ErrorBoundary>
    <div className="layout-root">
      {/* Disconnection banner */}
      {!connected && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            background: "var(--danger)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.03em",
            zIndex: 9999,
            fontFamily: "var(--font-sans)",
          }}
        >
          {reconnecting ? "Disconnected \u2014 Reconnecting..." : "Disconnected"}
        </div>
      )}

      {/* Left icon sidebar */}
      <Sidebar activePanel={activePanel} onPanelChange={handlePanelChange} hasUnreadChat={hasUnreadChat} />

      {/* File explorer */}
      <div
        className="panel"
        style={{
          width: effectiveExplorerWidth,
          minWidth: effectiveExplorerWidth,
          background: "var(--surface)",
          borderRight: explorerCollapsed ? "none" : "1px solid var(--border)",
          overflow: "hidden",
          transition: "width 0.2s ease, min-width 0.2s ease",
        }}
      >
        {!explorerCollapsed && (
          <>
            <div className="panel-content">
              {activePanel === "history" ? (
                <ConversationHistory
                  conversations={conversations}
                  activeId={activeConversationId}
                  onSelect={handleSelectConversation}
                  onNew={handleNewConversation}
                />
              ) : (
                <FileExplorer
                  projectPath={selectedProject?.path ?? ""}
                  onFileSelect={handleFileSelect}
                />
              )}
            </div>
            <div
              style={{
                borderTop: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <ProjectPicker
                selectedProject={selectedProject}
                onProjectSelect={setSelectedProject}
              />
            </div>
          </>
        )}
      </div>

      {/* Resize handle: explorer */}
      <div
        className="divider-v"
        onMouseDown={handleResizeExplorer}
        onDoubleClick={handleDoubleClickExplorer}
        title={explorerCollapsed ? "Double-click to expand" : "Drag to resize, double-click to collapse"}
      />

      {/* Center area: Settings or Chat */}
      {activePanel === "settings" ? (
        <div
          className="panel"
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--bg)",
          }}
        >
          <Settings />
        </div>
      ) : (
        <div
          className="panel"
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--bg)",
          }}
        >
          <div
            className="panel-header"
            style={{ justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Chat</span>
              <button
                onClick={handleNewChat}
                title="New Chat (Ctrl+Shift+N)"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: 0,
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                }}
              >
                +
              </button>
            </div>
            <span
              style={{
                fontSize: 10,
                color: connected ? "var(--accent)" : "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: connected ? "var(--accent)" : "var(--text-dim)",
                  display: "inline-block",
                }}
              />
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="panel-content">
            <ChatMessages messages={messages} isStreaming={isStreaming} isWaitingForResponse={isWaitingForResponse} />
          </div>

          <div
            style={{
              flexShrink: 0,
              borderTop: "1px solid var(--border)",
              padding: 12,
              background: "var(--surface)",
            }}
          >
            <ChatInput
              onSend={handleSendMessage}
              disabled={isStreaming || !connected}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      )}

      {/* Resize handle: right panel */}
      <div
        className="divider-v"
        onMouseDown={handleResizeRightPanel}
        onDoubleClick={handleDoubleClickRightPanel}
        title={rightPanelCollapsed ? "Double-click to expand" : "Drag to resize, double-click to collapse"}
      />

      {/* Right panel: Tool Activity + Terminal */}
      <div
        className="panel"
        style={{
          width: effectiveRightPanelWidth,
          minWidth: effectiveRightPanelWidth,
          background: "var(--surface)",
          borderLeft: rightPanelCollapsed ? "none" : "1px solid var(--border)",
          overflow: "hidden",
          transition: "width 0.2s ease, min-width 0.2s ease",
        }}
      >
        {!rightPanelCollapsed && (
          <>
            {/* Tool Activity (top half) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div className="panel-content">
                <ToolActivity toolCalls={toolCalls} />
              </div>
            </div>

            <div className="divider-h" />

            {/* Terminal Output (bottom half) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div className="panel-content">
                <TerminalPanel outputs={terminalOutputs} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
