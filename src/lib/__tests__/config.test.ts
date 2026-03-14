import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";

// Mock the fs module before importing config
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  promises: {},
}));

import { loadConfig, isValidProvider, maskKey } from "../config";

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default config when config file does not exist", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const config = loadConfig();
    expect(config.provider).toBe("claude-cli");
    expect(config.apiKey).toBeUndefined();
    expect(config.sessionKey).toBeUndefined();
  });

  it("returns default config when config file contains invalid JSON", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("not-valid-json{{{");

    const config = loadConfig();
    expect(config.provider).toBe("claude-cli");
  });

  it("reads provider from a valid config file", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ provider: "api-key", apiKey: "sk-test-123" })
    );

    const config = loadConfig();
    expect(config.provider).toBe("api-key");
    expect(config.apiKey).toBe("sk-test-123");
  });

  it("falls back to default provider when provider field is missing", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ apiKey: "sk-test-123" })
    );

    const config = loadConfig();
    expect(config.provider).toBe("claude-cli");
    expect(config.apiKey).toBe("sk-test-123");
  });
});

describe("isValidProvider", () => {
  it('returns true for "api-key"', () => {
    expect(isValidProvider("api-key")).toBe(true);
  });

  it('returns true for "max-api"', () => {
    expect(isValidProvider("max-api")).toBe(true);
  });

  it('returns true for "session-key"', () => {
    expect(isValidProvider("session-key")).toBe(true);
  });

  it('returns true for "claude-cli"', () => {
    expect(isValidProvider("claude-cli")).toBe(true);
  });

  it("returns false for unknown provider strings", () => {
    expect(isValidProvider("openai")).toBe(false);
    expect(isValidProvider("")).toBe(false);
    expect(isValidProvider("API-KEY")).toBe(false);
  });
});

describe("maskKey", () => {
  it("returns undefined for undefined input", () => {
    expect(maskKey(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(maskKey("")).toBeUndefined();
  });

  it('returns "****" for keys with 4 or fewer characters', () => {
    expect(maskKey("abcd")).toBe("****");
    expect(maskKey("ab")).toBe("****");
  });

  it("masks all but the last 4 characters for longer keys", () => {
    const result = maskKey("sk-ant-api03-abcdef1234");
    expect(result).toBeDefined();
    expect(result!.endsWith("1234")).toBe(true);
    expect(result!.startsWith("*")).toBe(true);
    // Total length should match original
    expect(result!.length).toBe("sk-ant-api03-abcdef1234".length);
  });

  it("shows only the last 4 characters unmasked", () => {
    const key = "12345678";
    const masked = maskKey(key)!;
    expect(masked).toBe("****5678");
  });
});
