import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the config and providers modules
vi.mock("@/lib/config", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getMaskedConfig: vi.fn(),
  isValidProvider: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  PROVIDER_INFO: {
    "api-key": {
      type: "api-key",
      label: "Anthropic API Key",
      description: "Connect directly with your Anthropic API key.",
      requiresKey: true,
    },
    "max-api": {
      type: "max-api",
      label: "Claude Max API",
      description: "For Claude Max subscribers.",
      requiresKey: true,
    },
    "session-key": {
      type: "session-key",
      label: "Session Key",
      description: "Use your claude.ai session cookie.",
      requiresKey: true,
      experimental: true,
    },
    "claude-cli": {
      type: "claude-cli",
      label: "Claude Code CLI",
      description: "Uses your existing Claude Code installation.",
      requiresKey: false,
    },
  },
}));

// Mock api-auth to always pass authentication
vi.mock("@/lib/api-auth", () => ({
  validateAuth: vi.fn(() => true),
  unauthorizedResponse: vi.fn(() => ({
    data: { error: "Unauthorized" },
    status: 401,
  })),
}));

// Mock next/server with headers support
vi.mock("next/server", () => {
  class MockNextRequest {
    nextUrl: URL;
    headers: Map<string, string>;
    private _body: unknown;
    constructor(url: string, init?: { method?: string; body?: string }) {
      this.nextUrl = new URL(url, "http://localhost:3000");
      this.headers = new Map();
      if (init?.body) {
        this._body = JSON.parse(init.body);
      }
    }
    async json() {
      return this._body;
    }
  }
  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: vi.fn((data: unknown, init?: { status?: number }) => ({
        data,
        status: init?.status || 200,
      })),
    },
  };
});

import { GET, POST } from "../../api/config/route";
import { loadConfig, saveConfig, getMaskedConfig, isValidProvider } from "@/lib/config";
import { NextRequest } from "next/server";

describe("GET /api/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns config with masked keys and provider info", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: "api-key",
      apiKey: "sk-ant-1234567890abcdef",
    });
    vi.mocked(getMaskedConfig).mockReturnValue({
      provider: "api-key",
      apiKey: "**************cdef",
      sessionKey: undefined,
      hasApiKey: true,
      hasSessionKey: false,
    });

    const req = new NextRequest("http://localhost:3000/api/config");
    const response = (await GET(req)) as { data: unknown; status: number };

    expect(response.status).toBe(200);
    const data = response.data as Record<string, unknown>;
    expect(data.provider).toBe("api-key");
    expect(data.apiKey).toBe("**************cdef");
    expect(data.hasApiKey).toBe(true);
    expect(data.providers).toBeDefined();
  });
});

describe("POST /api/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves config successfully with a valid provider", async () => {
    vi.mocked(isValidProvider).mockReturnValue(true);
    vi.mocked(saveConfig).mockImplementation(() => {});
    vi.mocked(getMaskedConfig).mockReturnValue({
      provider: "claude-cli",
      apiKey: undefined,
      sessionKey: undefined,
      hasApiKey: false,
      hasSessionKey: false,
    });

    const req = new NextRequest("http://localhost:3000/api/config", {
      method: "POST",
      body: JSON.stringify({ provider: "claude-cli" }),
    });
    const response = (await POST(req)) as { data: unknown; status: number };

    expect(response.status).toBe(200);
    const data = response.data as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.provider).toBe("claude-cli");
    expect(saveConfig).toHaveBeenCalledOnce();
  });

  it("returns 400 when provider is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/config", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = (await POST(req)) as { data: unknown; status: number };

    expect(response.status).toBe(400);
    expect((response.data as { error: string }).error).toContain("provider");
  });

  it("returns 400 for an invalid provider", async () => {
    vi.mocked(isValidProvider).mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/config", {
      method: "POST",
      body: JSON.stringify({ provider: "invalid-provider" }),
    });
    const response = (await POST(req)) as { data: unknown; status: number };

    expect(response.status).toBe(400);
    expect((response.data as { error: string }).error).toContain("Invalid provider");
  });
});
