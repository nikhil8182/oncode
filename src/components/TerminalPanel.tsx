"use client";

import { useEffect, useRef } from "react";
import type { TerminalOutput } from "@/types";

interface TerminalPanelProps {
  outputs: TerminalOutput[];
}

const monoFont =
  "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace";

export default function TerminalPanel({ outputs }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs]);

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
        fontFamily: monoFont,
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
          fontFamily: "inherit",
        }}
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
            style={{
              padding: "20px 12px",
              fontSize: 13,
              color: "#555",
              textAlign: "center",
              fontFamily: monoFont,
            }}
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
                    background: "#1a1a1a",
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
                      color: "#0d9488",
                      fontWeight: 600,
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    $
                  </span>
                  <span
                    style={{
                      color: "#ccc",
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
                      color: "#888",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      fontFamily: monoFont,
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
                      color: "#ef4444",
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
