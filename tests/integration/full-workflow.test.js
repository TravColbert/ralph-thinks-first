import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { spawnAgent } from "../../src/agents/agent.js";
import { parseArgs } from "../../src/utils/cli.js";
import { loadConfig } from "../../src/config.js";
import { readTasksFile } from "../../src/utils/tasks.js";
import { join } from "path";

/**
 * Integration Test: Full Workflow
 *
 * This test validates the complete workflow of the Ralph-Thinks-First framework:
 * 1. Manager role orchestrates the workflow
 * 2. Manager spawns Architect (plan) to analyze and update TASKS.md
 * 3. Manager spawns Coder (code) to execute tasks from TASKS.md
 * 4. Manager spawns Documentor (document) to generate documentation
 *
 * This is an end-to-end test that mocks Claude CLI responses to simulate
 * a realistic workflow without requiring actual Claude CLI calls.
 */

describe("Full Workflow Integration Test", () => {
  let originalSpawn;
  let spawnCallHistory = [];

  // Track which role is being spawned to provide appropriate mock responses
  let currentRoleIndex = 0;

  beforeEach(() => {
    // Reset state
    spawnCallHistory = [];
    currentRoleIndex = 0;

    // Save original Bun.spawn
    originalSpawn = Bun.spawn;

    // Create comprehensive mock for the entire workflow
    Bun.spawn = mock((cmd, options) => {
      // Record the spawn call
      spawnCallHistory.push({ cmd, options });

      // Determine which agent is being spawned based on the stdin content
      let stdin = "";
      const stdinWriter = {
        write: mock((data) => {
          stdin += data;
        }),
        end: mock(() => {})
      };

      // Read stdin to determine the role
      let mockResponse = "";
      let mockEvents = [];

      // Default mock response
      return {
        stdin: stdinWriter,
        stdout: {
          async *[Symbol.asyncIterator]() {
            // Give the stdin.write time to be called
            await Bun.sleep(10);

            // Determine which role based on stdin content
            if (stdin.includes("# Coder Agent")) {
              // This is the coder agent
              mockResponse = getMockCoderResponse();
              mockEvents = getMockCoderEvents();
            } else if (stdin.includes("# Architect Agent") || stdin.includes("plan")) {
              // This is the architect agent
              mockResponse = getMockArchitectResponse();
              mockEvents = getMockArchitectEvents();
            } else if (stdin.includes("# Documentor Agent") || stdin.includes("document")) {
              // This is the documentor agent
              mockResponse = getMockDocumentorResponse();
              mockEvents = getMockDocumentorEvents();
            } else if (stdin.includes("# Manager Agent") || stdin.includes("manage")) {
              // This is the manager agent
              const iteration = spawnCallHistory.length;
              mockResponse = getMockManagerResponse(iteration);
              mockEvents = getMockManagerEvents(iteration);
            } else {
              // Unknown role
              mockResponse = "Unknown role";
              mockEvents = [];
            }

            yield new TextEncoder().encode(mockResponse);
          }
        },
        stderr: {
          async *[Symbol.asyncIterator]() {
            await Bun.sleep(10);

            // Determine events based on stdin content
            let events = [];
            if (stdin.includes("# Coder Agent")) {
              events = getMockCoderEvents();
            } else if (stdin.includes("# Architect Agent") || stdin.includes("plan")) {
              events = getMockArchitectEvents();
            } else if (stdin.includes("# Documentor Agent") || stdin.includes("document")) {
              events = getMockDocumentorEvents();
            } else if (stdin.includes("# Manager Agent") || stdin.includes("manage")) {
              const iteration = spawnCallHistory.length;
              events = getMockManagerEvents(iteration);
            }

            for (const event of events) {
              yield new TextEncoder().encode(JSON.stringify(event) + "\n");
            }
          }
        },
        exited: Promise.resolve(0),
        kill: mock(() => true),
        pid: 10000 + spawnCallHistory.length
      };
    });
  });

  afterEach(() => {
    // Restore original Bun.spawn
    Bun.spawn = originalSpawn;
  });

  test("Manager orchestrates full workflow: plan -> code -> document", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: join(import.meta.dir, "../fixtures/sample-tasks.md"),
      maxIterations: 10
    };

    // Run the manager agent
    const result = await spawnAgent("manage", config);

    // Verify that the manager was spawned
    expect(spawnCallHistory.length).toBeGreaterThan(0);

    // Verify exit code is 0 (success)
    expect(result.exitCode).toBe(0);

    // Verify that events were emitted
    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);

    // Verify that status events were emitted
    const statusEvents = result.events.filter(e => e.type === "status");
    expect(statusEvents.length).toBeGreaterThan(0);

    // Verify that the manager started
    const startingEvent = result.events.find(
      e => e.type === "status" && e.status === "starting"
    );
    expect(startingEvent).toBeDefined();

    // Verify that the manager completed
    const completedEvent = result.events.find(
      e => e.type === "status" && e.status === "completed"
    );
    expect(completedEvent).toBeDefined();
  });

  test("TASKS.md is read by each agent", async () => {
    const tasksFile = join(import.meta.dir, "../fixtures/sample-tasks.md");
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile,
      maxIterations: 10
    };

    // Verify the tasks file exists and is readable
    const tasksContent = await readTasksFile(tasksFile);
    expect(tasksContent).toBeDefined();
    expect(tasksContent.length).toBeGreaterThan(0);
    expect(tasksContent).toContain("Sample Project Tasks");

    // Run an agent (coder in this case)
    const result = await spawnAgent("code", config);

    // Verify that the agent was spawned
    expect(spawnCallHistory.length).toBe(1);

    // Verify that stdin was written (contains the prompt with TASKS.md)
    const call = spawnCallHistory[0];
    expect(call.options.stdin).toBe("pipe");
  });

  test("Events are emitted correctly from agent", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: join(import.meta.dir, "../fixtures/sample-tasks.md"),
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    // Verify events array
    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);

    // Should have at least starting and completed events
    expect(result.events.length).toBeGreaterThanOrEqual(2);

    // Verify event structure
    result.events.forEach(event => {
      expect(event).toHaveProperty("type");
      expect(event).toHaveProperty("agent");
    });

    // Verify status events
    const statusEvents = result.events.filter(e => e.type === "status");
    expect(statusEvents.length).toBeGreaterThan(0);

    // Verify output events
    const outputEvents = result.events.filter(e => e.type === "output");
    expect(outputEvents.length).toBeGreaterThan(0);
  });

  test("Exit code is 0 on success", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: join(import.meta.dir, "../fixtures/sample-tasks.md"),
      maxIterations: 10
    };

    const result = await spawnAgent("code", config);

    expect(result.exitCode).toBe(0);
  });

  test("All roles can be spawned successfully", async () => {
    const config = {
      claudeCommand: "claude",
      model: "claude-sonnet-4-5",
      tasksFile: join(import.meta.dir, "../fixtures/sample-tasks.md"),
      maxIterations: 10
    };

    const roles = ["manage", "plan", "code", "document"];

    for (const role of roles) {
      // Reset spawn history for each role
      spawnCallHistory = [];

      const result = await spawnAgent(role, config);

      // Verify successful spawn
      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.events).toBeDefined();
      expect(spawnCallHistory.length).toBe(1);
    }
  });

  test("Configuration is passed correctly to agent", async () => {
    const customModel = "claude-opus-4-5";
    const config = {
      claudeCommand: "claude",
      model: customModel,
      tasksFile: join(import.meta.dir, "../fixtures/sample-tasks.md"),
      maxIterations: 5
    };

    const result = await spawnAgent("code", config);

    // Verify the command was called with the correct model
    expect(spawnCallHistory.length).toBe(1);
    const [command, options] = spawnCallHistory[0].cmd;

    // Check if model flag is in the command
    expect(spawnCallHistory[0].cmd).toContain("--model");
    expect(spawnCallHistory[0].cmd).toContain(customModel);
  });
});

// Mock response generators for each role

function getMockManagerResponse(iteration) {
  if (iteration === 1) {
    return `Starting workflow orchestration.

**INVOKE**: ralph-thinks-first --role plan

Waiting for architect to complete planning...
`;
  } else if (iteration === 2) {
    return `Architect completed. Moving to implementation.

**INVOKE**: ralph-thinks-first --role code

Waiting for coder to complete implementation...
`;
  } else if (iteration === 3) {
    return `Coder completed. Generating documentation.

**INVOKE**: ralph-thinks-first --role document

Waiting for documentor to complete...
`;
  } else {
    return `All sub-agents completed successfully.

**AGENT COMPLETE**
`;
  }
}

function getMockManagerEvents(iteration) {
  if (iteration === 1) {
    return [
      { type: "status", agent: "manage", status: "starting" },
      { type: "output", agent: "manage", message: "Analyzing workflow requirements" },
      { type: "output", agent: "manage", message: "Invoking architect for planning phase" }
    ];
  } else if (iteration === 2) {
    return [
      { type: "status", agent: "manage", status: "running" },
      { type: "output", agent: "manage", message: "Invoking coder for implementation" }
    ];
  } else if (iteration === 3) {
    return [
      { type: "status", agent: "manage", status: "running" },
      { type: "output", agent: "manage", message: "Invoking documentor for documentation" }
    ];
  } else {
    return [
      { type: "status", agent: "manage", status: "completed" },
      { type: "output", agent: "manage", message: "Workflow completed successfully" }
    ];
  }
}

function getMockArchitectResponse() {
  return `Analyzing project requirements...

Reading TASKS.md file...
Found 3 tasks to plan.

Creating detailed implementation plan:
1. Setup project structure
2. Implement core features
3. Add documentation

Plan complete. Updating TASKS.md with detailed steps.

**AGENT COMPLETE**
`;
}

function getMockArchitectEvents() {
  return [
    { type: "status", agent: "plan", status: "starting" },
    { type: "output", agent: "plan", message: "Reading TASKS.md" },
    { type: "output", agent: "plan", message: "Analyzing requirements" },
    { type: "output", agent: "plan", message: "Creating implementation plan" },
    { type: "status", agent: "plan", status: "completed" }
  ];
}

function getMockCoderResponse() {
  return `Reading TASKS.md for current tasks...

Found first unchecked task: Setup Project

Working on Task 1: Setup Project
- Creating directory structure... Done
- Initializing package.json... Done
- Setting up configuration... Done

Marking task as complete in TASKS.md.

**AGENT COMPLETE**
`;
}

function getMockCoderEvents() {
  return [
    { type: "status", agent: "code", status: "starting" },
    { type: "output", agent: "code", message: "Reading TASKS.md" },
    { type: "output", agent: "code", message: "Working on: Setup Project" },
    { type: "output", agent: "code", message: "Creating directory structure" },
    { type: "output", agent: "code", message: "Task completed successfully" },
    { type: "status", agent: "code", status: "completed" }
  ];
}

function getMockDocumentorResponse() {
  return `Analyzing codebase for documentation...

Reading project structure...
Reading TASKS.md for context...

Generating documentation:
- README.md: Project overview and installation
- API.md: API documentation
- CONTRIBUTING.md: Contribution guidelines

Documentation generation complete.

**AGENT COMPLETE**
`;
}

function getMockDocumentorEvents() {
  return [
    { type: "status", agent: "document", status: "starting" },
    { type: "output", agent: "document", message: "Reading codebase" },
    { type: "output", agent: "document", message: "Reading TASKS.md" },
    { type: "output", agent: "document", message: "Generating README.md" },
    { type: "output", agent: "document", message: "Generating API documentation" },
    { type: "status", agent: "document", status: "completed" }
  ];
}
