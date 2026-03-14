import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";

// Mock fs and os before importing the route
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

vi.mock("os", () => ({
  homedir: vi.fn(() => "/mock/home"),
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
    constructor(url: string) {
      this.nextUrl = new URL(url, "http://localhost:3000");
      this.headers = new Map();
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

import { GET } from "../../api/files/route";
import { NextRequest } from "next/server";

describe("GET /api/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue("/mock/home");
  });

  it("returns 400 when path query parameter is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/files");
    const response = (await GET(req)) as { data: unknown; status: number };

    expect(response.status).toBe(400);
    expect((response.data as { error: string }).error).toBe(
      "Missing required query parameter: path"
    );
  });

  it("returns a FileNode array for a valid path", async () => {
    // Mock stat to say it's a directory
    vi.mocked(fs.promises.stat).mockResolvedValue({
      isDirectory: () => true,
    } as fs.Stats);

    // Mock readdir to return some entries
    vi.mocked(fs.promises.readdir).mockResolvedValue([
      { name: "src", isDirectory: () => true, isFile: () => false },
      { name: "README.md", isDirectory: () => false, isFile: () => true },
    ] as unknown as fs.Dirent[]);

    const req = new NextRequest(
      "http://localhost:3000/api/files?path=/mock/home/myproject"
    );
    const response = (await GET(req)) as { data: unknown; status: number };

    expect(response.status).toBe(200);
    const nodes = response.data as Array<{ name: string; type: string }>;
    expect(Array.isArray(nodes)).toBe(true);
    // Directories should come first (sorted)
    expect(nodes[0].name).toBe("src");
    expect(nodes[0].type).toBe("directory");
    expect(nodes[1].name).toBe("README.md");
    expect(nodes[1].type).toBe("file");
  });

  it("returns 403 when path is outside the home directory", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/files?path=/etc/passwd"
    );
    const response = (await GET(req)) as { data: unknown; status: number };

    expect(response.status).toBe(403);
    expect((response.data as { error: string }).error).toContain(
      "Access denied"
    );
  });

  it("returns 404 when path does not exist", async () => {
    vi.mocked(fs.promises.stat).mockRejectedValue(new Error("ENOENT"));

    const req = new NextRequest(
      "http://localhost:3000/api/files?path=/mock/home/nonexistent"
    );
    const response = (await GET(req)) as { data: unknown; status: number };

    expect(response.status).toBe(404);
    expect((response.data as { error: string }).error).toContain(
      "does not exist"
    );
  });
});
