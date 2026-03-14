"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Project, Conversation } from "@/types";
import { useSocket } from "@/hooks/useSocket";
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

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelId>("chat");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);

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
      const res = await fetch("/api/conversations");
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

  const handleResizeExplorer = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    [explorerWidth]
  );

  const handleResizeRightPanel = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    [rightPanelWidth]
  );

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
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* File explorer */}
      <div
        className="panel"
        style={{
          width: explorerWidth,
          minWidth: explorerWidth,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
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
      </div>

      {/* Resize handle: explorer */}
      <div className="divider-v" onMouseDown={handleResizeExplorer} />

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
                title="New Chat"
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
      <div className="divider-v" onMouseDown={handleResizeRightPanel} />

      {/* Right panel: Tool Activity + Terminal */}
      <div
        className="panel"
        style={{
          width: rightPanelWidth,
          minWidth: rightPanelWidth,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
        }}
      >
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
      </div>
    </div>
    </ErrorBoundary>
  );
}
