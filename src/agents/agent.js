/**
 * Agent Spawning Logic
 *
 * Handles spawning Claude CLI subprocesses with event streaming.
 * Each agent invocation gets fresh context (no conversation history).
 */

import { parseEventStream } from "../utils/events.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of this module for resolving role files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Valid role names that can be spawned
 */
const VALID_ROLES = ["manage", "plan", "code", "document"];

/**
 * Loads a role meta-prompt from the appropriate file
 *
 * @param {string} role - Role name (manage, plan, code, document)
 * @returns {Promise<string>} - The role meta-prompt content
 * @throws {Error} If role is invalid or file cannot be read
 */
async function loadRolePrompt(role) {
  const normalizedRole = role.toLowerCase();

  if (!VALID_ROLES.includes(normalizedRole)) {
    throw new Error(`Invalid role: ${role}. Valid roles are: ${VALID_ROLES.join(", ")}`);
  }

  // Try to load from src/roles/{role}.js first (new structure)
  const newRolePath = join(__dirname, "..", "roles", `${normalizedRole}.js`);

  try {
    const roleModule = await import(newRolePath);
    if (roleModule.default && typeof roleModule.default === "string") {
      return roleModule.default;
    }
    if (roleModule.metaPrompt && typeof roleModule.metaPrompt === "string") {
      return roleModule.metaPrompt;
    }
  } catch (error) {
    // New role file doesn't exist or failed to load, fall back to legacy .md files
    throw new Error(`Failed to load role prompt for '${role}': ${error.message}`);
  }
}

/**
 * Reads the TASKS.md file content
 *
 * @param {string} tasksFile - Path to TASKS.md file
 * @returns {Promise<string>} - The tasks file content
 */
async function readTasksFile(tasksFile) {
  try {
    const file = Bun.file(tasksFile);
    const content = await file.text();
    return content;
  } catch (error) {
    // If file doesn't exist, return empty string
    // The agent can handle this case
    console.warn(`Warning: Could not read tasks file ${tasksFile}: ${error.message}`);
    return "";
  }
}

/**
 * Constructs the full prompt for the agent
 * Combines role meta-prompt with TASKS.md content and configuration
 *
 * @param {string} rolePrompt - The role meta-prompt
 * @param {string} tasksContent - Content of TASKS.md
 * @param {object} config - Configuration object
 * @returns {string} - The complete prompt
 */
function buildPrompt(rolePrompt, tasksContent, config) {
  // Replace variables in the role prompt
  let prompt = rolePrompt;
  prompt = prompt.replace(/\$TASKS_FILE/g, config.tasksFile || "TASKS.md");
  prompt = prompt.replace(/\$MAX_ITERATIONS/g, String(config.maxIterations || 10));
  prompt = prompt.replace(/\$CURRENT_ITERATION/g, String(config.currentIteration || 1));

  // Add TASKS.md content if available
  if (tasksContent.trim()) {
    prompt += `\n\nTASK_FILE_NAME=${config.tasksFile || "TASKS.md"}\n\n`;
    prompt += `--- CURRENT CONTENTS OF ${config.tasksFile || "TASKS.md"} ---\n`;
    prompt += tasksContent;
    prompt += `\n--- END CURRENT CONTENTS ---\n`;
  }

  // Add continuation prompt if this is a resumed conversation
  if (config.continuationPrompt) {
    prompt += config.continuationPrompt;
  }

  return prompt;
}

/**
 * Spawns a Claude CLI subprocess for the given role
 *
 * @param {string} role - Role name (manage, plan, code, document)
 * @param {object} config - Configuration object
 * @param {string} config.claudeCommand - Claude CLI command (default: "claude")
 * @param {string} config.model - Model to use
 * @param {string} config.tasksFile - Path to TASKS.md
 * @param {number} config.maxIterations - Max iterations allowed
 * @param {number} [config.timeout] - Optional timeout in milliseconds
 * @returns {Promise<object>} - Result object with exitCode, output, events, and optional timedOut
 */
export async function spawnAgent(role, config) {
  const normalizedRole = role.toLowerCase();

  // Load the role prompt
  const rolePrompt = await loadRolePrompt(normalizedRole);

  // Read TASKS.md
  const tasksContent = await readTasksFile(config.tasksFile || "TASKS.md");

  // Build the complete prompt
  const fullPrompt = buildPrompt(rolePrompt, tasksContent, config);

  // Prepare Claude CLI command
  const claudeCommand = config.claudeCommand || "claude";
  const args = [];

  // Add model if specified
  if (config.model) {
    args.push("--model", config.model);
  }

  // Spawn the process with the prompt as stdin
  let proc;
  try {
    proc = Bun.spawn([claudeCommand, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe"
    });
  } catch (error) {
    // Check if this is a "command not found" error
    if (error.code === "ENOENT" || error.message.includes("not found") || error.message.includes("No such file")) {
      throw new Error(
        `Claude CLI not found. The command '${claudeCommand}' is not available.\n\n` +
        `To install Claude CLI:\n` +
        `  1. Visit https://claude.ai/download\n` +
        `  2. Follow the installation instructions for your platform\n` +
        `  3. Ensure 'claude' is in your PATH\n\n` +
        `Alternatively, you can specify a custom claude command with:\n` +
        `  RTF_CLAUDE_COMMAND environment variable, or\n` +
        `  "claudeCommand" in your .rtfrc.json config file`
      );
    }
    // Re-throw other errors
    throw error;
  }

  // Write the prompt to stdin and close it
  proc.stdin.write(fullPrompt);
  proc.stdin.end();

  // Collect output and events
  const output = [];
  const events = [];
  const stderrLines = [];

  // Process stdout
  const stdoutReader = async () => {
    const decoder = new TextDecoder();
    for await (const chunk of proc.stdout) {
      const text = decoder.decode(chunk);
      output.push(text);
    }
  };

  // Process stderr (contains events)
  const stderrReader = async () => {
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of proc.stderr) {
      buffer += decoder.decode(chunk);

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the incomplete line in buffer

      for (const line of lines) {
        stderrLines.push(line);

        // Try to parse as event
        const event = parseEventStream(line);
        if (event) {
          events.push(event);
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      stderrLines.push(buffer);
      const event = parseEventStream(buffer);
      if (event) {
        events.push(event);
      }
    }
  };

  // Handle timeout if configured
  let timeoutId;
  let timedOut = false;

  const readers = [stdoutReader(), stderrReader()];

  if (config.timeout) {
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill();
        resolve(); // Resolve to stop waiting
      }, config.timeout);
    });

    // Wait for either completion or timeout
    await Promise.race([
      Promise.all([...readers, proc.exited]),
      timeoutPromise
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  } else {
    // No timeout - just wait for completion
    await Promise.all([...readers, proc.exited]);
  }

  // Get exit code (may still be pending if timed out)
  let exitCode;
  try {
    exitCode = await Promise.race([
      proc.exited,
      new Promise((resolve) => setTimeout(() => resolve(-1), 100))
    ]);
  } catch (e) {
    exitCode = -1;
  }

  // Prepare result
  const result = {
    exitCode,
    output: output.join(""),
    events
  };

  if (timedOut) {
    result.timedOut = true;
  }

  return result;
}
