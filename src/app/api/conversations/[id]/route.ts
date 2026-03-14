import { NextRequest, NextResponse } from "next/server";
import {
  loadConversation,
  saveConversation,
  deleteConversation,
} from "@/lib/conversations";
import type { Conversation } from "@/types";
import { validateAuth, unauthorizedResponse } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id] — load a specific conversation.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  if (!validateAuth(_request)) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  try {
    const conv = await loadConversation(id);
    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(conv);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/conversations/[id] — update a conversation (save messages, title, etc).
 * Body: Partial<Conversation> — at minimum { messages } is expected.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  try {
    const existing = await loadConversation(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updated: Conversation = {
      ...existing,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.messages !== undefined && { messages: body.messages }),
      updatedAt: Date.now(),
    };

    await saveConversation(updated);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id] — delete a conversation.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  if (!validateAuth(_request)) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  try {
    await deleteConversation(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
