import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "./auth";

/**
 * Validate authentication for an API request.
 *
 * Checks for the auth token in:
 *   1. Authorization header: "Bearer <token>"
 *   2. Query parameter: ?token=<token>
 *
 * Returns true if valid, false otherwise.
 */
export function validateAuth(request: NextRequest): boolean {
  // Check Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      const token = parts[1];
      if (validateToken(token)) {
        return true;
      }
    }
  }

  // Fall back to query parameter
  const tokenParam = request.nextUrl.searchParams.get("token");
  if (tokenParam) {
    return validateToken(tokenParam);
  }

  return false;
}

/**
 * Return a 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized. Provide a valid auth token via Authorization header or ?token= query parameter." },
    { status: 401 }
  );
}
