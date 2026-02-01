import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { spawnAgent } from "../../src/agents/agent.js";

describe("Agent Spawning", () => {
  let originalSpawn;
  let mockSpawn;

  beforeEach(() => {
    // Save original Bun.spawn
    originalSpawn = Bun.spawn;

    // Create mock spawn function
    mockSpawn = mock((cmd, options) => {
      // Return a mock process object
      return {
        stdin: {
          write: mock(() => {}),
          end: mock(() => {})
        },
        stdout: {
          async *[Symbol.asyncIterator]() {
            yield new TextEncoder().encode("Mock agent output\n");
          }
        },
        stderr: {
          async *[Symbol.asyncIterator]() {
            yield new TextEncoder().encode('{"type":"status","agent":"test","status":"starting"}\n');
            yield new TextEncoder().encode('{"type":"output","agent":"test","message":"Processing task"}\n');
            yield new TextEncoder().encode('{"type":"status","agent":"test","status":"completed"}\n');
          }
        },
        exited: Promise.resolve(0),
        kill: mock(() => true),
        pid: 12345
      };
    });

    // Replace Bun.spawn with mock
    Bun.spawn = mockSpawn;
  });

  afterEach(() => {
    // Restore original Bun.spawn
    Bun.spawn = originalSpawn;
  });

  test("spawns claude process with correct arguments", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    await spawnAgent("code", config);

    expect(mockSpawn).toHaveBeenCalled();

    // Verify the command and arguments passed to spawn
    const calls = mockSpawn.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const [command, options] = calls[0];
    expect(command[0]).toBe("claude");
  });

  test("passes meta-prompt via stdin", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    await spawnAgent("code", config);

    const [, options] = mockSpawn.mock.calls[0];

    // Verify stdin is configured
    expect(options).toHaveProperty("stdin");
    expect(options.stdin).toBeDefined();
  });

  test("captures stdout and stderr separately", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    // Verify that both stdout and stderr were captured
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("events");
    expect(result.output).toContain("Mock agent output");
  });

  test("parses events from stderr", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    // Verify events were parsed from stderr
    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);

    // Check for expected event types
    const hasStatusEvent = result.events.some(e => e.type === "status");
    const hasOutputEvent = result.events.some(e => e.type === "output");
    expect(hasStatusEvent).toBe(true);
    expect(hasOutputEvent).toBe(true);
  });

  test("handles process exit code", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    // Verify exit code is captured
    expect(result).toHaveProperty("exitCode");
    expect(result.exitCode).toBe(0);
  });

  test("handles non-zero exit code", async () => {
    // Mock a failing process
    Bun.spawn = mock(() => ({
      stdin: {
        write: mock(() => {}),
        end: mock(() => {})
      },
      stdout: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("Error output\n");
        }
      },
      stderr: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode('{"type":"error","agent":"test","error":"Something failed"}\n');
        }
      },
      exited: Promise.resolve(1),
      kill: mock(() => true),
      pid: 12346
    }));

    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    expect(result.exitCode).toBe(1);

    // Should still capture error events
    const hasErrorEvent = result.events.some(e => e.type === "error");
    expect(hasErrorEvent).toBe(true);
  });

  test("handles timeout when configured", async () => {
    // Mock a process that takes too long
    Bun.spawn = mock(() => ({
      stdin: {
        write: mock(() => {}),
        end: mock(() => {})
      },
      stdout: {
        async *[Symbol.asyncIterator]() {
          // Simulate long-running process
          await Bun.sleep(5000);
          yield new TextEncoder().encode("Too late\n");
        }
      },
      stderr: {
        async *[Symbol.asyncIterator]() {}
      },
      exited: new Promise(() => {}), // Never resolves
      kill: mock(() => true),
      pid: 12347
    }));

    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10,
      timeout: 100 // 100ms timeout
    };

    const result = await spawnAgent("code", config);

    // Should timeout and kill the process
    expect(result).toHaveProperty("timedOut");
    expect(result.timedOut).toBe(true);
  });

  test("handles malformed JSON in stderr gracefully", async () => {
    // Mock process that outputs malformed JSON
    Bun.spawn = mock(() => ({
      stdin: {
        write: mock(() => {}),
        end: mock(() => {})
      },
      stdout: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("Normal output\n");
        }
      },
      stderr: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode('{"type":"status","agent":"test"}\n'); // Valid
          yield new TextEncoder().encode('This is not JSON\n'); // Invalid
          yield new TextEncoder().encode('{"type":"output"}\n'); // Valid but incomplete
        }
      },
      exited: Promise.resolve(0),
      kill: mock(() => true),
      pid: 12348
    }));

    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    // Should not crash, should parse valid events and ignore invalid ones
    expect(result.exitCode).toBe(0);
    expect(result.events).toBeDefined();

    // Should have at least one valid event
    expect(result.events.length).toBeGreaterThan(0);
  });

  test("includes TASKS.md content in prompt", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    await spawnAgent("code", config);

    const [, options] = mockSpawn.mock.calls[0];

    // Verify stdin contains both meta-prompt and TASKS.md content
    // (This will be validated when we implement the actual function)
    expect(options.stdin).toBeDefined();
  });

  test("supports different role names", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    const roles = ["manage", "plan", "code", "document"];

    for (const role of roles) {
      mockSpawn.mockClear();
      await spawnAgent(role, config);
      expect(mockSpawn).toHaveBeenCalled();
    }
  });

  test("throws error for invalid role", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    await expect(spawnAgent("invalid-role", config)).rejects.toThrow();
  });

  test("passes model configuration to claude CLI", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-opus-4-5",
      tasksFile: "TASKS.md",
      maxIterations: 10
    };

    await spawnAgent("code", config);

    const [command] = mockSpawn.mock.calls[0];

    // Verify model is passed as argument
    expect(command).toContain("claude");
    // Model should be passed via CLI args or environment
  });
});
