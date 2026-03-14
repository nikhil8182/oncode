import { NextRequest, NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
  saveConversation,
} from "@/lib/conversations";
import { validateAuth, unauthorizedResponse } from "@/lib/api-auth";

/**
 * GET /api/conversations — list all conversations sorted by updatedAt desc.
 */
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const conversations = await listConversations();
    return NextResponse.json(conversations);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to list conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/conversations — create a new conversation.
 * Body: { projectPath: string }
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const projectPath = body?.projectPath;

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "Missing required field: projectPath" },
        { status: 400 }
      );
    }

    const conv = createConversation(projectPath);
    await saveConversation(conv);
    return NextResponse.json(conv, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
