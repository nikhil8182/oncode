import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import { validateAuth, unauthorizedResponse } from "@/lib/api-auth";

const execAsync = promisify(exec);

/**
 * POST /api/config/test
 * Tests a provider connection to verify the API key or CLI is working.
 *
 * Body: { provider: string, apiKey?: string, sessionKey?: string }
 * Returns: { success: boolean, message: string, model?: string }
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { provider, apiKey, sessionKey } = body;

    if (!provider) {
      return NextResponse.json(
        { success: false, message: "Missing required field: provider" },
        { status: 400 }
      );
    }

    switch (provider) {
      case "api-key":
      case "max-api": {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return NextResponse.json({
            success: false,
            message:
              "No API key provided. Enter an API key or set the ANTHROPIC_API_KEY environment variable.",
          });
        }

        try {
          const client = new Anthropic({ apiKey: key });
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 16,
            messages: [{ role: "user", content: "Say ok" }],
          });

          // Extract model from response
          const text =
            response.content[0]?.type === "text"
              ? response.content[0].text
              : "";

          return NextResponse.json({
            success: true,
            message: `Connected successfully. Response: "${text.slice(0, 50)}"`,
            model: response.model,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          // Provide user-friendly messages for common errors
          if (message.includes("401") || message.includes("authentication")) {
            return NextResponse.json({
              success: false,
              message: "Invalid API key. Please check your key and try again.",
            });
          }
          if (message.includes("429")) {
            return NextResponse.json({
              success: false,
              message:
                "Rate limited. The API key is valid but you've exceeded your rate limit.",
            });
          }
          if (message.includes("insufficient") || message.includes("billing")) {
            return NextResponse.json({
              success: false,
              message:
                "API key is valid but has billing issues. Check your Anthropic account.",
            });
          }
          return NextResponse.json({
            success: false,
            message: `API error: ${message}`,
          });
        }
      }

      case "session-key": {
        if (!sessionKey) {
          return NextResponse.json({
            success: false,
            message: "No session key provided.",
          });
        }

        try {
          const client = new Anthropic({ apiKey: sessionKey });
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 16,
            messages: [{ role: "user", content: "Say ok" }],
          });

          const text =
            response.content[0]?.type === "text"
              ? response.content[0].text
              : "";

          return NextResponse.json({
            success: true,
            message: `Connected successfully. Response: "${text.slice(0, 50)}"`,
            model: response.model,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return NextResponse.json({
            success: false,
            message: `Session key error: ${message}`,
          });
        }
      }

      case "claude-cli": {
        try {
          const { stdout } = await execAsync("claude --version", {
            timeout: 10000,
          });
          const version = stdout.trim();
          return NextResponse.json({
            success: true,
            message: `Claude CLI is available. Version: ${version}`,
          });
        } catch {
          return NextResponse.json({
            success: false,
            message:
              "Claude CLI not found. Install it from https://docs.anthropic.com/claude-code",
          });
        }
      }

      default:
        return NextResponse.json(
          {
            success: false,
            message: `Unknown provider: "${provider}"`,
          },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: `Server error: ${message}` },
      { status: 500 }
    );
  }
}
