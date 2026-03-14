import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { FileNode } from "@/types";

// Directories to skip when building the file tree
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".dart_tool",
  ".idea",
  "__pycache__",
  ".vscode",
  "target",
  ".svn",
]);

const MAX_DEPTH = 3;

function buildFileTree(dirPath: string, depth: number): FileNode[] {
  if (depth > MAX_DEPTH) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  // Sort: directories first, then files, both alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip hidden files/directories at depth > 0 (show them at root)
    if (depth > 0 && entry.name.startsWith(".")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const children = buildFileTree(fullPath, depth + 1);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "directory",
        children,
      });
    } else if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
      });
    }
  }

  return nodes;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get("path");

  if (!dirPath) {
    return NextResponse.json(
      { error: "Missing required query parameter: path" },
      { status: 400 }
    );
  }

  // Validate the path exists and is a directory
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { error: "The specified path is not a directory" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "The specified path does not exist or is not accessible" },
      { status: 404 }
    );
  }

  try {
    const tree = buildFileTree(dirPath, 0);
    return NextResponse.json(tree);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to build file tree";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
