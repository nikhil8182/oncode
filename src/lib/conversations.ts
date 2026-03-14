import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import type { Conversation } from "../types";

/**
 * Directory where conversation JSON files are stored,
 * relative to the oncode project root (process.cwd()).
 */
const DATA_DIR = path.join(
  process.cwd(),
  ".oncode-data",
  "conversations"
);

/** Ensure the conversations directory exists. */
async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** File path for a given conversation ID. */
function filePath(id: string): string {
  // Sanitise: only allow alphanumeric, hyphens, and underscores
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

/**
 * Create a new Conversation object (does NOT save it to disk).
 */
export function createConversation(projectPath: string): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "",
    projectPath,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Save a conversation to disk as `{id}.json`.
 */
export async function saveConversation(conv: Conversation): Promise<void> {
  await ensureDir();
  const data = JSON.stringify(conv, null, 2);
  await fs.writeFile(filePath(conv.id), data, "utf-8");
}

/**
 * Load a single conversation by ID.  Returns null if it doesn't exist.
 */
export async function loadConversation(
  id: string
): Promise<Conversation | null> {
  try {
    const data = await fs.readFile(filePath(id), "utf-8");
    return JSON.parse(data) as Conversation;
  } catch {
    return null;
  }
}

/**
 * List all conversations, sorted by updatedAt descending, limited to 50.
 */
export async function listConversations(): Promise<Conversation[]> {
  await ensureDir();

  let files: string[];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }

  const conversations: Conversation[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
      const conv = JSON.parse(data) as Conversation;
      conversations.push(conv);
    } catch {
      // Skip corrupt files
    }
  }

  // Sort by updatedAt descending
  conversations.sort((a, b) => b.updatedAt - a.updatedAt);

  // Return at most 50
  return conversations.slice(0, 50);
}

/**
 * Delete a conversation file by ID.
 */
export async function deleteConversation(id: string): Promise<void> {
  try {
    await fs.unlink(filePath(id));
  } catch {
    // Ignore if not found
  }
}
