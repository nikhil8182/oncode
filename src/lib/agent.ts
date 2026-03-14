import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { createAnthropicClient, runCLIProvider } from "./providers";
import type { ProviderConfig } from "./providers";

const execAsync = promisify(exec);

// --- Path validation to prevent path traversal ---

function validatePath(filePath: string, projectPath: string): void {
  const resolved = path.resolve(filePath);
  const resolvedProject = path.resolve(projectPath);
  if (!resolved.startsWith(resolvedProject + path.sep) && resolved !== resolvedProject) {
    throw new Error(
      `Path '${filePath}' is outside the project directory. Access denied.`
    );
  }
}

// --- Tool definitions for the Anthropic API ---

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Reads a file from the filesystem and returns its contents. Use an absolute path.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "The absolute path to the file to read",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "write_file",
    description:
      "Writes content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories as needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "The absolute path to the file to write",
        },
        content: {
          type: "string",
          description: "The content to write to the file",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Performs an exact string replacement in a file. Replaces old_string with new_string. The old_string must be unique in the file.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "The absolute path to the file to edit",
        },
        old_string: {
          type: "string",
          description: "The exact string to find and replace",
        },
        new_string: {
          type: "string",
          description: "The string to replace old_string with",
        },
      },
      required: ["file_path", "old_string", "new_string"],
    },
  },
  {
    name: "bash",
    description:
      "Executes a bash command and returns its stdout and stderr. The command runs in the project directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "glob",
    description:
      "Finds files matching a glob pattern in a directory. Returns a list of matching file paths.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description:
            'The glob pattern to match (e.g. "**/*.ts", "src/**/*.js")',
        },
        directory: {
          type: "string",
          description:
            "The directory to search in. Defaults to the project directory.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description:
      "Searches for a regex pattern in files. Returns matching file paths and optionally matching lines.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "The regex pattern to search for",
        },
        path: {
          type: "string",
          description:
            "The file or directory to search in. Defaults to the project directory.",
        },
        include: {
          type: "string",
          description:
            'Glob pattern to filter which files to search (e.g. "*.ts")',
        },
      },
      required: ["pattern"],
    },
  },
];

// --- Tool execution functions ---

async function executeReadFile(
  filePath: string
): Promise<{ output: string; isError: boolean }> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return { output: content, isError: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error reading file: ${message}`, isError: true };
  }
}

async function executeWriteFile(
  filePath: string,
  content: string
): Promise<{ output: string; isError: boolean }> {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf-8");
    return { output: `Successfully wrote to ${filePath}`, isError: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error writing file: ${message}`, isError: true };
  }
}

async function executeEditFile(
  filePath: string,
  oldString: string,
  newString: string
): Promise<{ output: string; isError: boolean }> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const occurrences = content.split(oldString).length - 1;

    if (occurrences === 0) {
      return {
        output: `Error: old_string not found in ${filePath}`,
        isError: true,
      };
    }
    if (occurrences > 1) {
      return {
        output: `Error: old_string found ${occurrences} times in ${filePath}. It must be unique. Provide more surrounding context to make it unique.`,
        isError: true,
      };
    }

    const newContent = content.replace(oldString, newString);
    await fs.promises.writeFile(filePath, newContent, "utf-8");
    return {
      output: `Successfully edited ${filePath}`,
      isError: false,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error editing file: ${message}`, isError: true };
  }
}

async function executeBash(
  command: string,
  cwd: string
): Promise<{ output: string; exitCode: number; isError: boolean }> {
  // TODO: Add sandboxing for production (e.g., restrict commands, use containers)
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n");
    return { output: output || "(no output)", exitCode: 0, isError: false };
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    const output = [execErr.stdout, execErr.stderr]
      .filter(Boolean)
      .join("\n");
    return {
      output: output || execErr.message || "Command failed",
      exitCode: typeof execErr.code === "number" ? execErr.code : 1,
      isError: true,
    };
  }
}

// Directories to skip when globbing
const GLOB_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

/**
 * Simple glob pattern matching against a file path.
 * Supports *, **, and ? wildcards.
 */
function matchGlobPattern(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  let regexStr = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** matches any number of directories
        if (pattern[i + 2] === "/") {
          regexStr += "(?:.+/)?";
          i += 3;
        } else {
          regexStr += ".*";
          i += 2;
        }
      } else {
        // * matches anything except /
        regexStr += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      regexStr += "[^/]";
      i++;
    } else if (ch === ".") {
      regexStr += "\\.";
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }
  regexStr += "$";
  return new RegExp(regexStr).test(filePath);
}

/**
 * Recursively reads a directory and returns file paths matching a glob pattern.
 * Does not shell out — uses Node's fs API directly to avoid command injection.
 */
async function walkDir(
  dir: string,
  baseDir: string,
  maxResults: number
): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    if (results.length >= maxResults) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;

      if (entry.isDirectory()) {
        if (GLOB_SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(currentDir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        results.push(relativePath);
      }
    }
  }

  await walk(dir);
  return results;
}

async function executeGlob(
  pattern: string,
  directory: string
): Promise<{ output: string; isError: boolean }> {
  try {
    const resolvedDir = path.resolve(directory);
    const allFiles = await walkDir(resolvedDir, resolvedDir, 10000);
    const matched = allFiles.filter((f) => matchGlobPattern(pattern, f));
    const limited = matched.slice(0, 500);

    if (limited.length === 0) {
      return { output: "No files found matching the pattern.", isError: false };
    }
    return { output: limited.join("\n"), isError: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error running glob: ${message}`, isError: true };
  }
}

async function executeGrep(
  pattern: string,
  searchPath: string,
  include?: string
): Promise<{ output: string; isError: boolean }> {
  try {
    // Escape single quotes in all user-provided parameters
    const safePattern = pattern.replace(/'/g, "'\\''");
    const safePath = searchPath.replace(/'/g, "'\\''");
    const safeInclude = (include || "*").replace(/'/g, "'\\''");

    // Use grep -rn for recursive search with line numbers
    let cmd = `grep -rn --include='${safeInclude}' -E '${safePattern}' '${safePath}'`;
    // Exclude common directories
    cmd += " --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=dist --exclude-dir=build";
    // Limit output to avoid overwhelming results
    cmd += " | head -100";

    const { stdout } = await execAsync(cmd, {
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { output: stdout || "No matches found.", isError: false };
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; message?: string };
    // grep returns exit code 1 when no matches found
    if (execErr.code === 1) {
      return { output: "No matches found.", isError: false };
    }
    const message = execErr.message || String(err);
    return { output: `Error running grep: ${message}`, isError: true };
  }
}

// --- Execute a single tool call ---

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  projectPath: string
): Promise<{ output: string; isError: boolean; exitCode?: number }> {
  switch (toolName) {
    case "read_file": {
      const filePath = toolInput.file_path as string;
      validatePath(filePath, projectPath);
      return executeReadFile(filePath);
    }

    case "write_file": {
      const filePath = toolInput.file_path as string;
      validatePath(filePath, projectPath);
      return executeWriteFile(filePath, toolInput.content as string);
    }

    case "edit_file": {
      const filePath = toolInput.file_path as string;
      validatePath(filePath, projectPath);
      return executeEditFile(
        filePath,
        toolInput.old_string as string,
        toolInput.new_string as string
      );
    }

    case "bash":
      // TODO: Add sandboxing for production (e.g., restrict commands, use containers)
      return executeBash(toolInput.command as string, projectPath);

    case "glob":
      return executeGlob(
        toolInput.pattern as string,
        (toolInput.directory as string) || projectPath
      );

    case "grep":
      return executeGrep(
        toolInput.pattern as string,
        (toolInput.path as string) || projectPath,
        toolInput.include as string | undefined
      );

    default:
      return { output: `Unknown tool: ${toolName}`, isError: true };
  }
}

// --- Event types yielded by the agent ---

export type AgentEvent =
  | { type: "text"; data: { delta: string; messageId: string } }
  | {
      type: "tool_start";
      data: {
        id: string;
        name: string;
        input: Record<string, unknown>;
        timestamp: number;
      };
    }
  | {
      type: "tool_end";
      data: {
        id: string;
        name: string;
        input: Record<string, unknown>;
        output: string;
        status: "completed" | "error";
        timestamp: number;
      };
    }
  | {
      type: "terminal";
      data: {
        id: string;
        command: string;
        output: string;
        exitCode: number;
        timestamp: number;
      };
    }
  | { type: "done"; data: { messageId: string } };

// --- Options for the agent runner ---

export interface RunAgentOptions {
  provider?: ProviderConfig;
  signal?: AbortSignal;
}

// --- Main agent runner (API-based providers: api-key, max-api, session-key) ---

async function* runAPIAgent(
  userMessage: string,
  conversationHistory: Anthropic.MessageParam[],
  projectPath: string,
  providerConfig: ProviderConfig
): AsyncGenerator<AgentEvent> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const client = createAnthropicClient(providerConfig);

  const systemPrompt = `You are Oncode, an AI coding assistant. You have access to the user's filesystem and can read, write, edit files, run commands, and search code. Work in the project directory: ${projectPath}`;

  // Build the messages array: existing history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Agentic loop — keep calling Claude until it stops using tools
  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect assistant response content blocks for the conversation history
    const assistantContentBlocks: Anthropic.ContentBlockParam[] = [];
    // Track tool use blocks for execution after stream ends
    const pendingToolUses: {
      id: string;
      name: string;
      input: Record<string, unknown>;
    }[] = [];

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield {
            type: "text",
            data: { delta: event.delta.text, messageId },
          };
        }
      }
    }

    // Get the final message to extract the full content blocks
    const finalMessage = await stream.finalMessage();

    for (const block of finalMessage.content) {
      if (block.type === "text") {
        assistantContentBlocks.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        assistantContentBlocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
        pendingToolUses.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Add assistant message to conversation history
    messages.push({ role: "assistant", content: assistantContentBlocks });

    // Execute tool calls if any
    if (pendingToolUses.length > 0) {
      continueLoop = true;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of pendingToolUses) {
        const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Emit tool_start
        yield {
          type: "tool_start",
          data: {
            id: toolCallId,
            name: toolUse.name,
            input: toolUse.input,
            timestamp: Date.now(),
          },
        };

        // Execute the tool
        const result = await executeTool(
          toolUse.name,
          toolUse.input,
          projectPath
        );

        // Emit terminal output for bash commands
        if (toolUse.name === "bash") {
          yield {
            type: "terminal",
            data: {
              id: `term_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              command: toolUse.input.command as string,
              output: result.output,
              exitCode: result.exitCode ?? (result.isError ? 1 : 0),
              timestamp: Date.now(),
            },
          };
        }

        // Emit tool_end
        yield {
          type: "tool_end",
          data: {
            id: toolCallId,
            name: toolUse.name,
            input: toolUse.input,
            output: result.output,
            status: result.isError ? "error" : "completed",
            timestamp: Date.now(),
          },
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.output,
          is_error: result.isError,
        });
      }

      // Add tool results to messages for the next loop iteration
      messages.push({ role: "user", content: toolResults });
    }

    // If stop_reason is "end_turn" and no tools, we're done
    if (finalMessage.stop_reason === "end_turn" && pendingToolUses.length === 0) {
      continueLoop = false;
    }
  }

  yield { type: "done", data: { messageId } };
}

// --- Main agent runner (dispatches to the correct provider) ---

export async function* runAgent(
  userMessage: string,
  conversationHistory: Anthropic.MessageParam[],
  projectPath: string,
  options?: RunAgentOptions
): AsyncGenerator<AgentEvent> {
  const providerConfig: ProviderConfig = options?.provider || {
    type: "api-key",
  };

  // Claude CLI provider — delegates everything to the claude CLI process
  if (providerConfig.type === "claude-cli") {
    yield* runCLIProvider(userMessage, projectPath, options?.signal);
    return;
  }

  // API-based providers: api-key, max-api, session-key
  yield* runAPIAgent(
    userMessage,
    conversationHistory,
    projectPath,
    providerConfig
  );
}
