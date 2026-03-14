"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Message, ToolCall, TerminalOutput } from "@/types";

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  sendMessage: (content: string, projectPath: string) => void;
  messages: Message[];
  toolCalls: ToolCall[];
  terminalOutputs: TerminalOutput[];
  isStreaming: boolean;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [terminalOutputs, setTerminalOutputs] = useState<TerminalOutput[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Track the current streaming message id so we can accumulate deltas
  const streamingMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Streaming deltas from the assistant
    socket.on("chat:stream", (data: { delta: string; messageId: string }) => {
      const { delta, messageId } = data;

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === messageId);
        if (existing) {
          // Append delta to existing message
          return prev.map((m) =>
            m.id === messageId
              ? { ...m, content: m.content + delta }
              : m
          );
        } else {
          // Create new assistant message
          streamingMessageIdRef.current = messageId;
          return [
            ...prev,
            {
              id: messageId,
              role: "assistant" as const,
              content: delta,
              timestamp: Date.now(),
            },
          ];
        }
      });

      setIsStreaming(true);
    });

    // Stream ended
    socket.on("chat:stream-end", (data: { messageId: string }) => {
      streamingMessageIdRef.current = null;
      setIsStreaming(false);
    });

    // Chat errors
    socket.on("chat:error", (data: { error: string }) => {
      streamingMessageIdRef.current = null;
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          content: `**Error:** ${data.error}`,
          timestamp: Date.now(),
        },
      ]);
    });

    // Tool call started
    socket.on("tool:start", (data: ToolCall) => {
      setToolCalls((prev) => [...prev, data]);
    });

    // Tool call ended
    socket.on("tool:end", (data: ToolCall) => {
      setToolCalls((prev) =>
        prev.map((tc) => (tc.id === data.id ? { ...tc, ...data } : tc))
      );
    });

    // Terminal output
    socket.on("terminal:output", (data: TerminalOutput) => {
      setTerminalOutputs((prev) => [...prev, data]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(
    (content: string, projectPath: string) => {
      if (!socketRef.current || !content.trim()) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);

      socketRef.current.emit("chat:message", {
        content: content.trim(),
        projectPath,
      });
    },
    []
  );

  return {
    socket: socketRef.current,
    connected,
    sendMessage,
    messages,
    toolCalls,
    terminalOutputs,
    isStreaming,
  };
}
