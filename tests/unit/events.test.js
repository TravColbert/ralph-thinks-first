import { describe, test, expect, beforeEach, afterEach } from "bun:test";

/**
 * Unit tests for Event Protocol
 *
 * These tests cover:
 * 1. Event emission (emitEvent function)
 * 2. Event parsing (parseEventStream function)
 *
 * Note: These tests are written BEFORE implementation (TDD approach)
 * and will initially fail until src/utils/events.js is implemented.
 */

// Import the functions to test (will be implemented in Task 2.3)
// For now, these imports will fail - that's expected in TDD
let emitEvent, parseEventStream;

try {
  const events = await import("../../src/utils/events.js");
  emitEvent = events.emitEvent;
  parseEventStream = events.parseEventStream;
} catch (e) {
  // Module doesn't exist yet - tests will fail as expected
  console.log("Note: src/utils/events.js not yet implemented - tests will fail");
}

describe("Event Emission", () => {
  let stderrOutput = [];
  let originalStderrWrite;

  beforeEach(() => {
    // Capture stderr output for testing
    stderrOutput = [];
    originalStderrWrite = process.stderr.write;
    process.stderr.write = (chunk) => {
      stderrOutput.push(chunk.toString());
      return true;
    };
  });

  afterEach(() => {
    // Restore original stderr
    process.stderr.write = originalStderrWrite;
  });

  test("should emit status event with correct format", () => {
    emitEvent("status", "code", { status: "running" });

    expect(stderrOutput.length).toBe(1);
    const line = stderrOutput[0].trim();
    const parsed = JSON.parse(line);

    expect(parsed).toEqual({
      type: "status",
      agent: "code",
      status: "running"
    });
  });

  test("should emit output event with correct format", () => {
    emitEvent("output", "plan", { message: "Analyzing requirements..." });

    expect(stderrOutput.length).toBe(1);
    const line = stderrOutput[0].trim();
    const parsed = JSON.parse(line);

    expect(parsed).toEqual({
      type: "output",
      agent: "plan",
      message: "Analyzing requirements..."
    });
  });

  test("should emit error event with correct format", () => {
    emitEvent("error", "document", { error: "File not found: README.md" });

    expect(stderrOutput.length).toBe(1);
    const line = stderrOutput[0].trim();
    const parsed = JSON.parse(line);

    expect(parsed).toEqual({
      type: "error",
      agent: "document",
      error: "File not found: README.md"
    });
  });

  test("should emit all status values correctly", () => {
    const statuses = ["starting", "running", "completed", "error"];

    statuses.forEach(status => {
      stderrOutput = []; // Reset
      emitEvent("status", "manage", { status });

      const line = stderrOutput[0].trim();
      const parsed = JSON.parse(line);

      expect(parsed.status).toBe(status);
    });
  });

  test("should produce single-line JSON output", () => {
    emitEvent("output", "code", { message: "Multi\nline\nmessage" });

    expect(stderrOutput.length).toBe(1);
    const line = stderrOutput[0];

    // Should be valid JSON on a single line (ending with newline)
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trim().split("\n").length).toBe(1);
  });

  test("should handle special characters in messages", () => {
    const specialMessage = 'Message with "quotes" and \\backslashes\\ and \ttabs';
    emitEvent("output", "plan", { message: specialMessage });

    const line = stderrOutput[0].trim();
    const parsed = JSON.parse(line);

    expect(parsed.message).toBe(specialMessage);
  });
});

describe("Event Parsing", () => {
  test("should parse valid status event", () => {
    const line = '{"type":"status","agent":"code","status":"running"}';
    const result = parseEventStream(line);

    expect(result).toEqual({
      type: "status",
      agent: "code",
      status: "running"
    });
  });

  test("should parse valid output event", () => {
    const line = '{"type":"output","agent":"plan","message":"Working on task..."}';
    const result = parseEventStream(line);

    expect(result).toEqual({
      type: "output",
      agent: "plan",
      message: "Working on task..."
    });
  });

  test("should parse valid error event", () => {
    const line = '{"type":"error","agent":"document","error":"ENOENT: file not found"}';
    const result = parseEventStream(line);

    expect(result).toEqual({
      type: "error",
      agent: "document",
      error: "ENOENT: file not found"
    });
  });

  test("should return null for malformed JSON", () => {
    const invalidLines = [
      "not json at all",
      "{incomplete json",
      '{"missing": "closing brace"',
      "",
      "   ",
    ];

    invalidLines.forEach(line => {
      const result = parseEventStream(line);
      expect(result).toBeNull();
    });
  });

  test("should return null for valid JSON that is not an event", () => {
    const nonEventLines = [
      '{"foo":"bar"}',  // Missing type and agent
      '{"type":"status"}',  // Missing agent
      '{"agent":"code"}',  // Missing type
      '{"type":"unknown","agent":"code"}',  // Unknown type (should still parse, but could be filtered)
      '[]',  // Array, not object
      '"just a string"',
      '123',
      'null',
    ];

    nonEventLines.forEach(line => {
      const result = parseEventStream(line);
      // Should return null for objects missing required fields
      if (line.includes('"type"') && line.includes('"agent"')) {
        expect(result).not.toBeNull();
      } else {
        expect(result).toBeNull();
      }
    });
  });

  test("should handle non-event stderr output gracefully", () => {
    const stderrLines = [
      "Regular error message",
      "Warning: something happened",
      "Debug output",
      "",
    ];

    stderrLines.forEach(line => {
      const result = parseEventStream(line);
      expect(result).toBeNull();
    });
  });

  test("should parse events with extra whitespace", () => {
    const lines = [
      '  {"type":"status","agent":"code","status":"running"}  ',
      '\n{"type":"status","agent":"code","status":"running"}\n',
      '\t{"type":"status","agent":"code","status":"running"}\t',
    ];

    lines.forEach(line => {
      const result = parseEventStream(line);
      expect(result).toEqual({
        type: "status",
        agent: "code",
        status: "running"
      });
    });
  });

  test("should handle events with additional fields", () => {
    // Future-proofing: events might have extra fields
    const line = '{"type":"status","agent":"code","status":"running","timestamp":"2026-01-31T12:00:00Z"}';
    const result = parseEventStream(line);

    expect(result).toBeDefined();
    expect(result.type).toBe("status");
    expect(result.agent).toBe("code");
    expect(result.status).toBe("running");
    // Extra field should be preserved
    expect(result.timestamp).toBe("2026-01-31T12:00:00Z");
  });

  test("should handle escaped characters in JSON", () => {
    const line = '{"type":"output","agent":"plan","message":"Line 1\\nLine 2\\tTabbed"}';
    const result = parseEventStream(line);

    expect(result).toBeDefined();
    expect(result.message).toBe("Line 1\nLine 2\tTabbed");
  });

  test("should handle unicode characters", () => {
    const line = '{"type":"output","agent":"code","message":"Unicode: 你好 🚀 ñ"}';
    const result = parseEventStream(line);

    expect(result).toBeDefined();
    expect(result.message).toBe("Unicode: 你好 🚀 ñ");
  });
});

describe("Event Roundtrip (Emit + Parse)", () => {
  let stderrOutput = [];
  let originalStderrWrite;

  beforeEach(() => {
    stderrOutput = [];
    originalStderrWrite = process.stderr.write;
    process.stderr.write = (chunk) => {
      stderrOutput.push(chunk.toString());
      return true;
    };
  });

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
  });

  test("should successfully roundtrip status event", () => {
    emitEvent("status", "manage", { status: "completed" });

    const emittedLine = stderrOutput[0].trim();
    const parsed = parseEventStream(emittedLine);

    expect(parsed).toEqual({
      type: "status",
      agent: "manage",
      status: "completed"
    });
  });

  test("should successfully roundtrip output event", () => {
    const message = "Complex message with \"quotes\" and\nnewlines";
    emitEvent("output", "code", { message });

    const emittedLine = stderrOutput[0].trim();
    const parsed = parseEventStream(emittedLine);

    expect(parsed).toEqual({
      type: "output",
      agent: "code",
      message
    });
  });

  test("should successfully roundtrip error event", () => {
    const errorMsg = "Error: ENOENT /path/to/file.txt";
    emitEvent("error", "document", { error: errorMsg });

    const emittedLine = stderrOutput[0].trim();
    const parsed = parseEventStream(emittedLine);

    expect(parsed).toEqual({
      type: "error",
      agent: "document",
      error: errorMsg
    });
  });
});

describe("Edge Cases", () => {
  test("parseEventStream should handle empty string", () => {
    expect(parseEventStream("")).toBeNull();
  });

  test("parseEventStream should handle null input", () => {
    expect(parseEventStream(null)).toBeNull();
  });

  test("parseEventStream should handle undefined input", () => {
    expect(parseEventStream(undefined)).toBeNull();
  });

  test("parseEventStream should handle very long messages", () => {
    const longMessage = "x".repeat(10000);
    const line = JSON.stringify({
      type: "output",
      agent: "code",
      message: longMessage
    });

    const result = parseEventStream(line);
    expect(result).toBeDefined();
    expect(result.message).toBe(longMessage);
  });
});
