import Anthropic from "@anthropic-ai/sdk";
import { spawn, ChildProcess } from "child_process";
import type { AgentEvent } from "./agent";

// --- Provider type definitions ---

export type ProviderType = "api-key" | "max-api" | "session-key" | "claude-cli";

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  sessionKey?: string;
}

export interface ProviderInfo {
  type: ProviderType;
  label: string;
  description: string;
  requiresKey: boolean;
  experimental?: boolean;
}

export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
  "api-key": {
    type: "api-key",
    label: "Anthropic API Key",
    description: "Connect directly with your Anthropic API key. Requires ANTHROPIC_API_KEY.",
    requiresKey: true,
  },
  "max-api": {
    type: "max-api",
    label: "Claude Max API",
    description: "For Claude Max subscribers — uses your included API credits with an API key.",
    requiresKey: true,
  },
  "session-key": {
    type: "session-key",
    label: "Session Key (claude.ai)",
    description:
      "Use your claude.ai session cookie as an auth token. Experimental — may break without notice.",
    requiresKey: true,
    experimental: true,
  },
  "claude-cli": {
    type: "claude-cli",
    label: "Claude Code CLI",
    description:
      "Uses your existing Claude Code installation. No API key needed — easiest setup.",
    requiresKey: false,
  },
};

// --- Anthropic SDK provider (used by api-key, max-api, session-key) ---

export function createAnthropicClient(config: ProviderConfig): Anthropic {
  let apiKey: string | undefined;

  switch (config.type) {
    case "api-key":
    case "max-api":
      apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      break;
    case "session-key":
      // Session key is used as the API key — experimental approach
      apiKey = config.sessionKey;
      break;
    default:
      throw new Error(`Cannot create Anthropic client for provider: ${config.type}`);
  }

  if (!apiKey) {
    throw new Error(
      `No API key configured for provider "${config.type}". ` +
        `Please set an API key in the Oncode settings or the ANTHROPIC_API_KEY environment variable.`
    );
  }

  return new Anthropic({ apiKey });
}

// --- Claude CLI provider ---

/**
 * Parsed JSON event from `claude -p --output-format stream-json`.
 * The CLI outputs newline-delimited JSON with various type fields.
 */
interface CLIStreamEvent {
  type: string;
  subtype?: string;
  text?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  result?: string;
  // result events
  cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
  session_id?: string;
}

export interface CLIProcess {
  process: ChildProcess;
  kill: () => void;
}

/**
 * Runs a message through the Claude Code CLI and yields AgentEvents.
 * Spawns `claude -p "message" --output-format stream-json -y` and parses the output.
 */
export async function* runCLIProvider(
  userMessage: string,
  projectPath: string,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const child = spawn(
    "claude",
    ["-p", userMessage, "--output-format", "stream-json", "--dangerously-skip-permissions"],
    {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  // Handle abort signal
  if (signal) {
    const onAbort = () => {
      child.kill("SIGTERM");
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }

  let currentToolId: string | null = null;
  let currentToolName: string | null = null;
  let currentToolInput: Record<string, unknown> | null = null;

  // Create a promise-based async iterator from the child process stdout
  const lines = createLineIterator(child);

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;

      let event: CLIStreamEvent;
      try {
        event = JSON.parse(line);
      } catch {
        // Not valid JSON, skip
        continue;
      }

      switch (event.type) {
        case "assistant": {
          if (event.subtype === "text" && event.text) {
            yield {
              type: "text",
              data: { delta: event.text, messageId },
            };
          }
          break;
        }

        case "tool_use": {
          // Claude CLI is about to use a tool
          const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          currentToolId = toolCallId;
          currentToolName = event.tool_name || "unknown";
          currentToolInput = event.tool_input || {};

          yield {
            type: "tool_start",
            data: {
              id: toolCallId,
              name: currentToolName,
              input: currentToolInput,
              timestamp: Date.now(),
            },
          };
          break;
        }

        case "tool_result": {
          // Tool finished executing
          if (currentToolId && currentToolName) {
            const output = event.content || event.text || "";

            // Emit terminal event for bash/command tools
            if (
              currentToolName === "bash" ||
              currentToolName === "execute_command"
            ) {
              yield {
                type: "terminal",
                data: {
                  id: `term_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                  command:
                    (currentToolInput?.command as string) || "command",
                  output,
                  exitCode: event.is_error ? 1 : 0,
                  timestamp: Date.now(),
                },
              };
            }

            yield {
              type: "tool_end",
              data: {
                id: currentToolId,
                name: currentToolName,
                input: currentToolInput || {},
                output,
                status: event.is_error ? "error" : "completed",
                timestamp: Date.now(),
              },
            };
          }

          currentToolId = null;
          currentToolName = null;
          currentToolInput = null;
          break;
        }

        case "result": {
          // Final result from the CLI — we're done
          if (event.result) {
            yield {
              type: "text",
              data: { delta: event.result, messageId },
            };
          }
          break;
        }
      }
    }
  } catch (err: unknown) {
    // If the process was killed via abort, don't throw
    if (signal?.aborted) {
      // Silently end
    } else {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Claude CLI error: ${message}`);
    }
  }

  yield { type: "done", data: { messageId } };
}

/**
 * Creates an async line iterator from a child process's stdout.
 * Buffers partial lines and yields complete newline-delimited lines.
 */
async function* createLineIterator(
  child: ChildProcess
): AsyncGenerator<string> {
  const { stdout, stderr } = child;
  if (!stdout) throw new Error("Claude CLI: no stdout available");

  let buffer = "";

  // Collect stderr for error reporting
  let stderrOutput = "";
  if (stderr) {
    stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });
  }

  // Create a promise that resolves when the process exits
  const exitPromise = new Promise<number | null>((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(null));
  });

  // Async iteration over stdout data chunks
  const chunks: Buffer[] = [];
  let resolveChunk: (() => void) | null = null;
  let done = false;

  stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  stdout.on("end", () => {
    done = true;
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  stdout.on("error", () => {
    done = true;
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  while (true) {
    // Process any available chunks
    while (chunks.length > 0) {
      const chunk = chunks.shift()!;
      buffer += chunk.toString();

      // Yield complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete last line in buffer
      for (const line of lines) {
        if (line.trim()) {
          yield line;
        }
      }
    }

    if (done) break;

    // Wait for more data
    await new Promise<void>((resolve) => {
      resolveChunk = resolve;
    });
  }

  // Yield any remaining buffer content
  if (buffer.trim()) {
    yield buffer;
  }

  // Wait for exit and check for errors
  const exitCode = await exitPromise;
  if (exitCode !== null && exitCode !== 0 && stderrOutput) {
    throw new Error(
      `Claude CLI exited with code ${exitCode}: ${stderrOutput.slice(0, 500)}`
    );
  }
}
