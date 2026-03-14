"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Message, ToolCall, TerminalOutput, Conversation } from "@/types";
import { getAuthToken, withAuthToken } from "@/lib/client-auth";

interface UseSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  sendMessage: (content: string, projectPath: string) => void;
  messages: Message[];
  toolCalls: ToolCall[];
  terminalOutputs: TerminalOutput[];
  isStreaming: boolean;
  clearMessages: () => void;
  activeConversationId: string | null;
  loadConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const MAX_MESSAGES = 200;
const MAX_TOOL_CALLS = 100;

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [terminalOutputs, setTerminalOutputs] = useState<TerminalOutput[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Track the current streaming message id so we can accumulate deltas
  const streamingMessageIdRef = useRef<string | null>(null);
  // Ref to hold the latest conversationId for the socket listener
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Read auth token from URL query parameter
    const token = getAuthToken();

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      // Clear stuck streaming state on reconnect
      setIsStreaming(false);
      streamingMessageIdRef.current = null;
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.io.on("reconnect_attempt", () => {
      setReconnecting(true);
    });

    socket.io.on("reconnect", () => {
      setReconnecting(false);
    });

    socket.io.on("reconnect_failed", () => {
      setReconnecting(false);
    });

    // Streaming deltas from the assistant
    // Performance note: consumers rendering streamed messages should use React.memo
    // on message components to avoid re-rendering the full list on every delta.
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
          const next = [
            ...prev,
            {
              id: messageId,
              role: "assistant" as const,
              content: delta,
              timestamp: Date.now(),
            },
          ];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
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
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant" as const,
            content: `**Error:** ${data.error}`,
            timestamp: Date.now(),
          },
        ];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    });

    // Tool call started
    socket.on("tool:start", (data: ToolCall) => {
      setToolCalls((prev) => {
        const next = [...prev, data];
        return next.length > MAX_TOOL_CALLS ? next.slice(-MAX_TOOL_CALLS) : next;
      });
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

    // Conversation saved — update the active ID
    socket.on(
      "conversation:saved",
      (data: { conversationId: string }) => {
        activeConversationIdRef.current = data.conversationId;
        setActiveConversationId(data.conversationId);
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
    setTerminalOutputs([]);
    setIsStreaming(false);
    streamingMessageIdRef.current = null;
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

      setMessages((prev) => {
        const next = [...prev, userMessage];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });

      socketRef.current.emit("chat:message", {
        content: content.trim(),
        projectPath,
        conversationId: activeConversationIdRef.current ?? undefined,
      });
    },
    []
  );

  /** Load a conversation by ID from the REST API and set its messages. */
  const loadConversationById = useCallback(async (id: string) => {
    try {
      const res = await fetch(withAuthToken(`/api/conversations/${id}`));
      if (!res.ok) return;
      const conv: Conversation = await res.json();
      setMessages(conv.messages);
      setToolCalls([]);
      setTerminalOutputs([]);
      setIsStreaming(false);
      streamingMessageIdRef.current = null;
      activeConversationIdRef.current = conv.id;
      setActiveConversationId(conv.id);
    } catch {
      // Silently fail — the UI will stay as-is
    }
  }, []);

  /** Start a brand-new conversation: clear messages and reset the ID. */
  const newConversation = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
    setTerminalOutputs([]);
    setIsStreaming(false);
    streamingMessageIdRef.current = null;
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
  }, []);

  return {
    connected,
    reconnecting,
    sendMessage,
    messages,
    toolCalls,
    terminalOutputs,
    isStreaming,
    clearMessages,
    activeConversationId,
    loadConversation: loadConversationById,
    newConversation,
    setMessages,
  };
}
