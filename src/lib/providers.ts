import Anthropic from "@anthropic-ai/sdk";
import { spawn, ChildProcess, exec } from "child_process";
import { promisify } from "util";
import type { AgentEvent } from "./agent";

const execAsync = promisify(exec);

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
  // Nested message format from --include-partial-messages
  message?: {
    content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>;
  };
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
 * Uses exec to run the CLI and parses the complete output, then also
 * supports streaming via spawn for real-time output.
 */
export async function* runCLIProvider(
  userMessage: string,
  projectPath: string,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Escape single quotes in the message
  const safeMessage = userMessage.replace(/'/g, "'\\''");
  const cmd = `claude -p '${safeMessage}' --output-format json --dangerously-skip-permissions`;

  console.log("[CLI] Running:", cmd.slice(0, 120) + "...");

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectPath || undefined,
      timeout: 300000, // 5 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      env: { ...process.env },
    });

    if (stderr) {
      console.error("[CLI stderr]", stderr.slice(0, 200));
    }

    // --output-format json returns a single JSON object with a "result" field
    const trimmed = stdout.trim();
    console.log("[CLI] Got output:", trimmed.slice(0, 200));

    try {
      const result = JSON.parse(trimmed);
      // The JSON format returns: { result: "text response", ... }
      const text = result.result || result.text || trimmed;
      yield {
        type: "text",
        data: { delta: text, messageId },
      };
    } catch {
      // If not valid JSON, use raw output as text
      if (trimmed) {
        yield {
          type: "text",
          data: { delta: trimmed, messageId },
        };
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      // Silently end
    } else {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      // If we got stdout despite the error, try to extract the result
      if (execErr.stdout) {
        const text = execErr.stdout.trim();
        try {
          const result = JSON.parse(text);
          yield { type: "text", data: { delta: result.result || text, messageId } };
        } catch {
          if (text) {
            yield { type: "text", data: { delta: text, messageId } };
          }
        }
      } else {
        const message = execErr.message || String(err);
        throw new Error(`Claude CLI error: ${message}`);
      }
    }
  }

  yield { type: "done", data: { messageId } };
}
