"use client";

import { useEffect, useRef } from "react";
import type { TerminalOutput } from "@/types";

interface TerminalPanelProps {
  outputs: TerminalOutput[];
}

export default function TerminalPanel({ outputs }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs]);

  return (
    <div
      className="panel-card"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <div
        className="panel-card-header"
        style={{ fontFamily: "inherit" }}
      >
        Terminal
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 0 8px",
        }}
      >
        {outputs.length === 0 ? (
          <div
            className="panel-empty"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            No commands executed
          </div>
        ) : (
          outputs.map((entry, index) => (
            <div key={entry.id}>
              {index > 0 && (
                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    margin: "6px 12px",
                  }}
                />
              )}
              <div style={{ padding: "6px 12px 2px" }}>
                {/* Command line */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    fontSize: 13,
                    lineHeight: "20px",
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent)",
                      fontWeight: 600,
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    $
                  </span>
                  <span
                    style={{
                      color: "var(--text)",
                      wordBreak: "break-all",
                    }}
                  >
                    {entry.command}
                  </span>
                </div>
                {/* Output */}
                {entry.output && (
                  <pre
                    style={{
                      margin: "4px 0 0",
                      padding: 0,
                      fontSize: 12,
                      lineHeight: "18px",
                      color: "var(--text-muted)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      fontFamily: "var(--font-mono)",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    {entry.output}
                  </pre>
                )}
                {/* Exit code */}
                {entry.exitCode !== undefined && entry.exitCode > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--danger)",
                      marginTop: 4,
                    }}
                  >
                    exit {entry.exitCode}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
