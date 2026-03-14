import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime, getErrorMessage, generateId } from "../utils";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "now" for timestamps less than 2 seconds ago', () => {
    const timestamp = Date.now() - 1000;
    expect(formatRelativeTime(timestamp)).toBe("now");
  });

  it("returns seconds ago for timestamps under a minute", () => {
    const timestamp = Date.now() - 30000; // 30 seconds ago
    expect(formatRelativeTime(timestamp)).toBe("30s ago");
  });

  it("returns minutes ago for timestamps under an hour", () => {
    const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    expect(formatRelativeTime(timestamp)).toBe("5m ago");
  });

  it("returns hours ago for timestamps under a day", () => {
    const timestamp = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
    expect(formatRelativeTime(timestamp)).toBe("3h ago");
  });

  it('returns "Yesterday" for timestamps 1 day ago', () => {
    const timestamp = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
    expect(formatRelativeTime(timestamp)).toBe("Yesterday");
  });

  it("returns month and day for older dates in the same year", () => {
    // Jan 10 of the same year (2026)
    const timestamp = new Date("2026-01-10T12:00:00Z").getTime();
    const result = formatRelativeTime(timestamp);
    expect(result).toContain("Jan");
    expect(result).toContain("10");
  });

  it("returns month, day, and year for dates in a different year", () => {
    const timestamp = new Date("2024-06-15T12:00:00Z").getTime();
    const result = formatRelativeTime(timestamp);
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from an Error object", () => {
    const error = new Error("Something went wrong");
    expect(getErrorMessage(error)).toBe("Something went wrong");
  });

  it("converts a string to itself", () => {
    expect(getErrorMessage("plain string error")).toBe("plain string error");
  });

  it("converts a number to a string", () => {
    expect(getErrorMessage(404)).toBe("404");
  });

  it("handles null", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("handles undefined", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });
});

describe("generateId", () => {
  it("starts with the given prefix", () => {
    const id = generateId("msg");
    expect(id.startsWith("msg_")).toBe(true);
  });

  it("contains a timestamp segment", () => {
    const before = Date.now();
    const id = generateId("test");
    const after = Date.now();

    const parts = id.split("_");
    // Parts: prefix, timestamp, random
    expect(parts.length).toBe(3);
    const ts = parseInt(parts[1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("u")));
    expect(ids.size).toBe(100);
  });

  it("uses different prefixes correctly", () => {
    expect(generateId("tc").startsWith("tc_")).toBe(true);
    expect(generateId("conv").startsWith("conv_")).toBe(true);
  });
});
