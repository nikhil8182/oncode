import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { runAgent } from "./src/lib/agent";
import type { ToolCall, TerminalOutput } from "./src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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

  // Track active conversation histories per socket
  const conversationHistories = new Map<
    string,
    { role: "user" | "assistant"; content: string }[]
  >();

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Initialize conversation history for this socket
    conversationHistories.set(socket.id, []);

    socket.on(
      "chat:message",
      async (data: {
        content: string;
        projectPath: string;
        conversationId?: string;
      }) => {
        const { content, projectPath, conversationId } = data;

        console.log(
          `[Socket.io] chat:message from ${socket.id}: "${content.slice(0, 80)}..." | project: ${projectPath}`
        );

        // Use conversationId-based key if provided, otherwise socket id
        const historyKey = conversationId
          ? `${socket.id}:${conversationId}`
          : socket.id;

        if (!conversationHistories.has(historyKey)) {
          conversationHistories.set(historyKey, []);
        }
        const history = conversationHistories.get(historyKey)!;

        try {
          const agentStream = runAgent(content, history, projectPath);
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

              case "done":
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
                socket.emit("chat:stream-end", {
                  messageId: event.data.messageId,
                });
                break;
            }
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "An unknown error occurred";
          console.error(`[Socket.io] Error processing message:`, err);
          socket.emit("chat:error", { error: message });
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket.io] Client disconnected: ${socket.id} (${reason})`
      );
      // Clean up conversation histories for this socket
      for (const key of conversationHistories.keys()) {
        if (key.startsWith(socket.id)) {
          conversationHistories.delete(key);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Oncode server ready on http://${hostname}:${port}`);
    console.log(`> Socket.io WebSocket attached`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
