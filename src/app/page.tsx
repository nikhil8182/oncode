"use client";

import { useState, useCallback } from "react";
import type { Project } from "@/types";
import { useSocket } from "@/hooks/useSocket";
import Sidebar from "@/components/Sidebar";
import FileExplorer from "@/components/FileExplorer";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ToolActivity from "@/components/ToolActivity";
import TerminalPanel from "@/components/TerminalPanel";
import ProjectPicker from "@/components/ProjectPicker";
import Settings from "@/components/Settings";

export type PanelId = "chat" | "files" | "terminal" | "history" | "settings";

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelId>("chat");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);

  const {
    connected,
    sendMessage,
    messages,
    toolCalls,
    terminalOutputs,
    isStreaming,
  } = useSocket();

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content, selectedProject?.path ?? "");
    },
    [sendMessage, selectedProject]
  );

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
    <div className="layout-root">
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
          <FileExplorer
            projectPath={selectedProject?.path ?? ""}
            onFileSelect={handleFileSelect}
          />
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
            <span>Chat</span>
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
            <ChatMessages messages={messages} isStreaming={isStreaming} />
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
  );
}
