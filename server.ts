import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { runAgent } from "./src/lib/agent";
import { loadConfig } from "./src/lib/config";
import { PROVIDER_INFO } from "./src/lib/providers";
import {
  createConversation,
  saveConversation,
  loadConversation,
} from "./src/lib/conversations";
import { getOrCreateAuthToken, validateToken } from "./src/lib/auth";
import type { ProviderConfig } from "./src/lib/providers";
import type { ToolCall, TerminalOutput, Message } from "./src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // --- Auth token ---
  const authToken = getOrCreateAuthToken();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : undefined,
      methods: ["GET", "POST"],
    },
    // Increase max buffer for large file contents
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  // --- Socket.io auth middleware ---
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required. Provide a valid auth token."));
    }

    if (!validateToken(token)) {
      return next(new Error("Invalid auth token."));
    }

    next();
  });

  // Track active conversation histories per socket
  const conversationHistories = new Map<
    string,
    { role: "user" | "assistant"; content: string }[]
  >();

  // Track per-socket provider config overrides (null = use global config)
  const socketProviderOverrides = new Map<string, ProviderConfig | null>();

  // Track active AbortControllers per socket for CLI process cleanup
  const activeAbortControllers = new Map<string, AbortController>();

  // --- Rate limiting ---
  // Track message timestamps per socket for rate limiting (10 msgs/min)
  const RATE_LIMIT_MAX = 10;
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const messageTimestamps = new Map<string, number[]>();

  /**
   * Resolve the provider config for a given socket.
   * Per-socket overrides take priority, then falls back to the global config file.
   */
  function getProviderForSocket(socketId: string): ProviderConfig {
    const override = socketProviderOverrides.get(socketId);
    if (override) return override;

    const config = loadConfig();
    return {
      type: config.provider,
      apiKey: config.apiKey,
      sessionKey: config.sessionKey,
    };
  }

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Initialize conversation history for this socket
    conversationHistories.set(socket.id, []);
    socketProviderOverrides.set(socket.id, null);

    // Load and emit the current provider config on connect
    const currentConfig = loadConfig();
    const providerInfo = PROVIDER_INFO[currentConfig.provider];
    socket.emit("config:current", {
      provider: currentConfig.provider,
      providerLabel: providerInfo?.label || currentConfig.provider,
      hasApiKey: !!currentConfig.apiKey,
      hasSessionKey: !!currentConfig.sessionKey,
    });

    // Handle config:update — reload the provider config
    socket.on(
      "config:update",
      (data?: { provider?: string; apiKey?: string; sessionKey?: string }) => {
        if (data && data.provider) {
          // Client is requesting a specific provider for this session
          socketProviderOverrides.set(socket.id, {
            type: data.provider as ProviderConfig["type"],
            apiKey: data.apiKey,
            sessionKey: data.sessionKey,
          });
          console.log(
            `[Socket.io] Provider override for ${socket.id}: ${data.provider}`
          );
        } else {
          // Reload from config file
          socketProviderOverrides.set(socket.id, null);
          console.log(
            `[Socket.io] Provider reset to global config for ${socket.id}`
          );
        }

        // Emit the resolved config back to the client
        const resolved = getProviderForSocket(socket.id);
        const info = PROVIDER_INFO[resolved.type];
        socket.emit("config:current", {
          provider: resolved.type,
          providerLabel: info?.label || resolved.type,
          hasApiKey: !!resolved.apiKey,
          hasSessionKey: !!resolved.sessionKey,
        });
      }
    );

    socket.on(
      "chat:message",
      async (data: {
        content: string;
        projectPath: string;
        conversationId?: string;
      }) => {
        // --- Input validation ---
        if (!data || typeof data.content !== "string" || data.content.trim().length === 0) {
          socket.emit("chat:error", { error: "Invalid input: content must be a non-empty string." });
          return;
        }
        if (data.content.length > 10000) {
          socket.emit("chat:error", { error: "Invalid input: content must not exceed 10000 characters." });
          return;
        }
        if (data.projectPath !== undefined && data.projectPath !== null) {
          if (typeof data.projectPath !== "string" || data.projectPath.trim().length === 0) {
            socket.emit("chat:error", { error: "Invalid input: projectPath must be a non-empty string." });
            return;
          }
        }

        // --- Rate limiting ---
        const now = Date.now();
        const timestamps = messageTimestamps.get(socket.id) || [];
        // Remove timestamps outside the window
        const recentTimestamps = timestamps.filter(
          (ts) => now - ts < RATE_LIMIT_WINDOW_MS
        );
        if (recentTimestamps.length >= RATE_LIMIT_MAX) {
          socket.emit("chat:error", { error: "Rate limit exceeded. Please wait." });
          return;
        }
        recentTimestamps.push(now);
        messageTimestamps.set(socket.id, recentTimestamps);

        const { content, projectPath, conversationId } = data;

        const providerConfig = getProviderForSocket(socket.id);
        console.log(
          `[Socket.io] chat:message from ${socket.id}: "${content.slice(0, 80)}..." | project: ${projectPath} | provider: ${providerConfig.type}`
        );

        // Use conversationId-based key if provided, otherwise socket id
        const historyKey = conversationId
          ? `${socket.id}:${conversationId}`
          : socket.id;

        if (!conversationHistories.has(historyKey)) {
          conversationHistories.set(historyKey, []);
        }
        const history = conversationHistories.get(historyKey)!;

        // Create an AbortController for this request (for CLI process cleanup)
        const abortController = new AbortController();
        activeAbortControllers.set(socket.id, abortController);

        try {
          const agentStream = runAgent(content, history, projectPath, {
            provider: providerConfig,
            signal: abortController.signal,
          });
          let fullAssistantText = "";

          for await (const event of agentStream) {
            switch (event.type) {
              case "text":
                fullAssistantText += event.data.delta;
                socket.emit("chat:stream", {
                  delta: event.data.delta,
                  messageId: event.data.messageId,
                });
                break;

              case "tool_start":
                socket.emit("tool:start", {
                  id: event.data.id,
                  name: event.data.name,
                  input: event.data.input,
                  status: "running",
                  timestamp: event.data.timestamp,
                } as ToolCall);
                break;

              case "tool_end":
                socket.emit("tool:end", {
                  id: event.data.id,
                  name: event.data.name,
                  input: event.data.input,
                  output: event.data.output,
                  status: event.data.status,
                  timestamp: event.data.timestamp,
                } as ToolCall);
                break;

              case "terminal":
                socket.emit("terminal:output", {
                  id: event.data.id,
                  command: event.data.command,
                  output: event.data.output,
                  exitCode: event.data.exitCode,
                  timestamp: event.data.timestamp,
                } as TerminalOutput);
                break;

              case "done": {
                // Update conversation history with the exchange
                history.push({ role: "user", content });
                if (fullAssistantText) {
                  history.push({
                    role: "assistant",
                    content: fullAssistantText,
                  });
                }
                // Cap conversation history to last 50 messages
                const MAX_HISTORY = 50;
                if (history.length > MAX_HISTORY) {
                  history.splice(0, history.length - MAX_HISTORY);
                }

                // --- Persist conversation to disk ---
                try {
                  let convId = conversationId;
                  let conv;

                  if (convId) {
                    conv = await loadConversation(convId);
                  }

                  if (!conv) {
                    // Create a new conversation
                    conv = createConversation(projectPath);
                    convId = conv.id;
                  }

                  // Build Message objects for the new exchange
                  const userMsg: Message = {
                    id: `user-${Date.now()}`,
                    role: "user",
                    content,
                    timestamp: Date.now(),
                  };

                  const msgs: Message[] = [...conv.messages, userMsg];

                  if (fullAssistantText) {
                    msgs.push({
                      id: event.data.messageId,
                      role: "assistant",
                      content: fullAssistantText,
                      timestamp: Date.now(),
                    });
                  }

                  // Derive title from the first user message if none set
                  if (!conv.title && msgs.length > 0) {
                    const firstUser = msgs.find((m) => m.role === "user");
                    if (firstUser) {
                      conv.title = firstUser.content.split("\n")[0].slice(0, 80);
                    }
                  }

                  conv.messages = msgs;
                  conv.updatedAt = Date.now();
                  await saveConversation(conv);

                  socket.emit("conversation:saved", { conversationId: convId });
                } catch (saveErr) {
                  console.error("[Socket.io] Failed to save conversation:", saveErr);
                }

                socket.emit("chat:stream-end", {
                  messageId: event.data.messageId,
                });
                break;
              }
            }
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "An unknown error occurred";
          console.error(`[Socket.io] Error processing message:`, err);
          socket.emit("chat:error", { error: message });
        } finally {
          activeAbortControllers.delete(socket.id);
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket.io] Client disconnected: ${socket.id} (${reason})`
      );

      // Abort any running CLI process for this socket
      const controller = activeAbortControllers.get(socket.id);
      if (controller) {
        controller.abort();
        activeAbortControllers.delete(socket.id);
      }

      // Clean up conversation histories for this socket
      for (const key of conversationHistories.keys()) {
        if (key.startsWith(socket.id)) {
          conversationHistories.delete(key);
        }
      }

      // Clean up provider overrides
      socketProviderOverrides.delete(socket.id);

      // Clean up rate limiting data
      messageTimestamps.delete(socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Oncode server ready on http://${hostname}:${port}`);
    console.log(`> Socket.io WebSocket attached`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
    const config = loadConfig();
    console.log(`> Default provider: ${config.provider}`);
    console.log(`> Auth token: ${authToken}`);
    console.log(`> Open: http://${hostname}:${port}?token=${authToken}`);
  });
});
