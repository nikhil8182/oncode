import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { Project } from "@/types";

// Project marker files — if any of these exist in a directory, it's a project
const PROJECT_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pubspec.yaml",
  ".git",
];

export async function GET() {
  try {
    const homeDir = os.homedir();
    const entries = fs.readdirSync(homeDir, { withFileTypes: true });

    const projects: (Project & { mtime: number })[] = [];

    for (const entry of entries) {
      // Skip hidden directories (except .git check is on children)
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(homeDir, entry.name);

      try {
        const hasMarker = PROJECT_MARKERS.some((marker) => {
          try {
            fs.accessSync(path.join(dirPath, marker));
            return true;
          } catch {
            return false;
          }
        });

        if (hasMarker) {
          const stats = fs.statSync(dirPath);
          projects.push({
            name: entry.name,
            path: dirPath,
            mtime: stats.mtimeMs,
          });
        }
      } catch {
        // Skip directories we can't access
        continue;
      }
    }

    // Sort by most recently modified and take top 20
    projects.sort((a, b) => b.mtime - a.mtime);
    const result: Project[] = projects.slice(0, 20).map(({ name, path }) => ({
      name,
      path,
    }));

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
