import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Check if claude CLI is available
    const { stdout: whichOutput } = await execAsync("which claude");
    const cliPath = whichOutput.trim();

    if (!cliPath) {
      return NextResponse.json({ available: false });
    }

    // Try to get the version
    let version: string | undefined;
    try {
      const { stdout: versionOutput } = await execAsync("claude --version");
      version = versionOutput.trim();
    } catch {
      // CLI exists but --version failed; still report as available
    }

    return NextResponse.json({ available: true, version });
  } catch {
    return NextResponse.json({ available: false });
  }
}
