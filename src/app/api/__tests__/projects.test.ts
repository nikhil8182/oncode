import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";

// Mock fs and os before importing the route
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    access: vi.fn(),
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

// Import the route handler after mocks are set up
import { GET } from "../../api/projects/route";
import { NextRequest } from "next/server";

function createRequest(url = "http://localhost:3000/api/projects") {
  return new NextRequest(url);
}

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue("/mock/home");
  });

  it("returns an array of projects sorted by mtime", async () => {
    // Mock readdir to return directories
    vi.mocked(fs.promises.readdir).mockResolvedValue([
      { name: "project-a", isDirectory: () => true, isFile: () => false },
      { name: "project-b", isDirectory: () => true, isFile: () => false },
      { name: ".hidden", isDirectory: () => true, isFile: () => false },
      { name: "readme.txt", isDirectory: () => false, isFile: () => true },
    ] as unknown as fs.Dirent[]);

    // Mock access to succeed for project markers
    vi.mocked(fs.promises.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (
        pathStr.includes("project-a/package.json") ||
        pathStr.includes("project-b/.git")
      ) {
        return undefined;
      }
      throw new Error("ENOENT");
    });

    // Mock stat for modification times
    vi.mocked(fs.promises.stat).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.includes("project-a")) {
        return { mtimeMs: 1000 } as fs.Stats;
      }
      return { mtimeMs: 2000 } as fs.Stats;
    });

    const response = (await GET(createRequest())) as { data: unknown; status: number };
    const projects = response.data as Array<{ name: string; path: string }>;

    expect(response.status).toBe(200);
    expect(Array.isArray(projects)).toBe(true);
    // project-b has higher mtime, so it should come first
    expect(projects[0].name).toBe("project-b");
    expect(projects[1].name).toBe("project-a");
  });

  it("returns an empty array when no projects are found", async () => {
    vi.mocked(fs.promises.readdir).mockResolvedValue([]);

    const response = (await GET(createRequest())) as { data: unknown; status: number };
    const projects = response.data as unknown[];

    expect(response.status).toBe(200);
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBe(0);
  });

  it("skips hidden directories", async () => {
    vi.mocked(fs.promises.readdir).mockResolvedValue([
      { name: ".config", isDirectory: () => true, isFile: () => false },
      { name: ".ssh", isDirectory: () => true, isFile: () => false },
    ] as unknown as fs.Dirent[]);

    const response = (await GET(createRequest())) as { data: unknown; status: number };
    const projects = response.data as unknown[];

    expect(response.status).toBe(200);
    expect(projects.length).toBe(0);
    // access should never be called since hidden dirs are skipped
    expect(fs.promises.access).not.toHaveBeenCalled();
  });

  it("returns error response on filesystem failure", async () => {
    vi.mocked(fs.promises.readdir).mockRejectedValue(
      new Error("Permission denied")
    );

    const response = (await GET(createRequest())) as { data: unknown; status: number };

    expect(response.status).toBe(500);
    expect((response.data as { error: string }).error).toBe(
      "Permission denied"
    );
  });
});
