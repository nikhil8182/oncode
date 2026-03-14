"use client";

import React, { useEffect, useRef } from "react";
import type { Message } from "@/types";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
  /** True after a user message is sent but before any streaming response arrives */
  isWaitingForResponse: boolean;
}

// Hoisted to module scope — no dependency on props, avoids re-creating on every render.
const markdownComponents = {
  code({ className, children, ...props }: React.ComponentPropsWithoutRef<"code"> & { className?: string }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    // Inline code
    if (!match) {
      return (
        <code
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "2px 6px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--accent)",
          }}
          {...props}
        >
          {children}
        </code>
      );
    }

    // Code block
    return (
      <div
        style={{
          margin: "8px 0",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            background: "var(--bg)",
            padding: "6px 12px",
            fontSize: 10,
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            borderBottom: "1px solid var(--border)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {match[1]}
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "12px 16px",
            background: "#0c0c0c",
            fontSize: 12,
            lineHeight: 1.5,
            borderRadius: 0,
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  },
  p({ children }: React.ComponentPropsWithoutRef<"p">) {
    return <p style={{ margin: "6px 0" }}>{children}</p>;
  },
  ul({ children }: React.ComponentPropsWithoutRef<"ul">) {
    return (
      <ul style={{ margin: "6px 0", paddingLeft: 20, listStyle: "disc" }}>
        {children}
      </ul>
    );
  },
  ol({ children }: React.ComponentPropsWithoutRef<"ol">) {
    return (
      <ol style={{ margin: "6px 0", paddingLeft: 20, listStyle: "decimal" }}>
        {children}
      </ol>
    );
  },
  a({ href, children }: React.ComponentPropsWithoutRef<"a">) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)" }}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: React.ComponentPropsWithoutRef<"blockquote">) {
    return (
      <blockquote
        style={{
          borderLeft: "2px solid var(--accent)",
          paddingLeft: 12,
          margin: "8px 0",
          color: "var(--text-muted)",
        }}
      >
        {children}
      </blockquote>
    );
  },
};

const MessageBubble = React.memo(function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isUser ? "var(--text-dim)" : "var(--accent)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {isUser ? "You" : "Oncode"}
      </span>

      {/* Content */}
      <div
        style={{
          background: isUser ? "var(--surface-alt)" : "var(--surface)",
          border: `1px solid ${isUser ? "var(--border-alt)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text)",
          overflowWrap: "break-word",
        }}
      >
        <div className="markdown-body">
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

export default function ChatMessages({ messages, isStreaming, isWaitingForResponse }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, isWaitingForResponse]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 12,
          color: "var(--text-dim)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--accent-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
          }}
        >
          O
        </div>
        <span style={{ fontSize: 13 }}>Start a conversation with Oncode</span>
      </div>
    );
  }

  // Show the thinking indicator when:
  // 1. User sent a message and we're waiting for any response (before streaming starts), OR
  // 2. Streaming has started but no assistant message text has arrived yet
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isWaitingForResponse ||
    (isStreaming && (!lastMessage || lastMessage.role === "user"));

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {showThinking && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--accent)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Oncode
          </span>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="streaming-dot" />
            <span className="streaming-dot" style={{ animationDelay: "0.2s" }} />
            <span className="streaming-dot" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
