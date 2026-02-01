#!/usr/bin/env bun

/**
 * Ralph-Thinks-First CLI Entry Point
 *
 * Main orchestrator for the Ralph-Thinks-First agentic AI framework.
 * Spawns Claude CLI agents with specific roles to accomplish tasks.
 */

import * as readline from 'readline';
import { parseArgs } from './utils/cli.js';
import { loadConfig } from './utils/config.js';
import { extractTasksContent, writeTasksFile } from './utils/tasks.js';
import { spawnAgent } from './agents/agent.js';
// import { parseEventStream } from './utils/events.js';
import packageJson from '../package.json' assert { type: 'json' };

/**
 * Prompts the user for an initial project description if not provided via CLI
 * @param {string|undefined} cliPrompt - Prompt provided via -p flag
 * @returns {Promise<string>} - The initial prompt from user
 */
async function getInitialPrompt(cliPrompt) {
  if (cliPrompt) {
    return cliPrompt;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('What would you like to build? ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Displays help text and exits
 */
function displayHelp() {
  console.log(`
Ralph-Thinks-First v${packageJson.version}
${packageJson.description}

USAGE:
  npx ralph-thinks-first [options]

OPTIONS:
  --help, -h                Show this help message
  --version, -v             Show version number
  --prompt, -p <text>       Initial project description (prompted if not provided)
  --config, -c <path>       Path to custom config file (default: .rtfrc.json)
  --model, -m <name>        Override Claude model to use
  --max-iterations <n>      Override maximum iterations per agent
  --tasks, -t <path>        Path to tasks file (default: TASKS.md)
  --role, -r <role>         Skip directly to a specific role

AVAILABLE ROLES:
  manage                    Manager/orchestrator role (default)
                            Coordinates other agents to complete tasks

  plan                      Architect role
                            Reads and plans tasks, updates TASKS.md

  code                      Coder role
                            Executes tasks from TASKS.md

  document                  Documentor role
                            Generates documentation for the codebase

CONFIGURATION:
  Configuration is loaded in the following priority order:
  1. CLI flags (highest priority)
  2. Environment variables (RTF_MODEL, RTF_MAX_ITERATIONS, etc.)
  3. Config file (.rtfrc.json in current directory)
  4. Built-in defaults (lowest priority)

EXAMPLES:
  # Launch with a project description
  npx ralph-thinks-first -p "Build a REST API for user management"

  # Launch interactively (prompts for project description)
  npx ralph-thinks-first

  # Run coder role directly
  npx ralph-thinks-first --role code

  # Use custom model and tasks file
  npx ralph-thinks-first --model claude-opus-4 --tasks my-tasks.md

  # Use custom config file
  npx ralph-thinks-first --config ./my-config.json

For more information, visit: ${packageJson.repository?.url || 'https://github.com/yourusername/ralph-thinks-first'}
`);
}

/**
 * Displays formatted output to the console
 */
function displayStatus(role, message) {
  console.log(`[${role.toUpperCase()}] ${message}`);
}

/**
 * Handles and displays events from agent subprocesses
 */
function handleEvent(event) {
  if (!event) return;

  switch (event.type) {
    case 'status':
      displayStatus(event.agent, `Status: ${event.status}`);
      break;
    case 'output':
      displayStatus(event.agent, event.message);
      break;
    case 'error':
      console.error(`[${event.agent.toUpperCase()}] ERROR: ${event.error}`);
      break;
    default:
      // Unknown event type - log as-is for debugging
      console.log(`[EVENT] ${JSON.stringify(event)}`);
  }
}

/**
 * Parses the output for **INVOKE** directives
 * Returns the invocation command if found, null otherwise
 */
function parseInvokeDirective(output) {
  if (!output) return null;

  // Match: **INVOKE**: ralph-thinks-first --role <role-name> [options...]
  const invokeRegex = /\*\*INVOKE\*\*:\s*ralph-thinks-first\s+--role\s+(\S+)(?:\s+(.*))?/i;
  const match = output.match(invokeRegex);

  if (match) {
    const role = match[1];
    const additionalArgs = match[2] || '';
    return { role, additionalArgs };
  }

  return null;
}

/**
 * Checks if the output contains a completion signal
 */
function hasCompletionSignal(output) {
  if (!output) return false;
  return output.includes('**AGENT COMPLETE**') || output.includes('ALL_TASKS_COMPLETE');
}

/**
 * Checks if the output contains a max iterations signal
 */
function hasMaxIterationsSignal(output) {
  if (!output) return false;
  return output.includes('REACHED MAX ITERATIONS');
}

/**
 * Recursively runs an agent with orchestration support
 * Handles **INVOKE** directives for manager role
 */
async function runAgentWithOrchestration(role, config, iteration = 1) {
  // Check iteration limit before running
  if (iteration > config.maxIterations) {
    console.error(`\nReached maximum iterations (${config.maxIterations}). Stopping.`);
    return {
      exitCode: 1,
      output: 'REACHED MAX ITERATIONS\nCannot continue',
      events: [],
      reachedMaxIterations: true
    };
  }

  // Update config with current iteration
  const agentConfig = {
    ...config,
    currentIteration: iteration
  };

  displayStatus(role, `Running (iteration ${iteration}/${config.maxIterations})...`);

  // Spawn the agent
  const result = await spawnAgent(role, agentConfig);

  // Display output
  if (result.output) {
    console.log(result.output);
  }

  // Check for completion signals
  if (hasCompletionSignal(result.output)) {
    displayStatus(role, 'Agent signaled completion');

    // If this was the plan role, extract and save TASKS.md content
    if (role.toLowerCase() === 'plan' && result.output) {
      const tasksContent = extractTasksContent(result.output);
      if (tasksContent) {
        try {
          await writeTasksFile(config.tasksFile || 'TASKS.md', tasksContent);
          displayStatus(role, `Saved tasks to ${config.tasksFile || 'TASKS.md'}`);
        } catch (writeError) {
          console.error(`Warning: Failed to save TASKS.md: ${writeError.message}`);
        }
      }
    }

    return result;
  }

  // Check for max iterations signal
  if (hasMaxIterationsSignal(result.output)) {
    displayStatus(role, 'Agent reached max iterations');
    return { ...result, reachedMaxIterations: true };
  }

  // Check for **INVOKE** directive (only for manager role)
  if (role.toLowerCase() === 'manage') {
    const invokeDirective = parseInvokeDirective(result.output);

    if (invokeDirective) {
      const subRole = invokeDirective.role.toLowerCase();
      displayStatus(role, `Invoking sub-agent: ${subRole}`);

      // Parse additional arguments from the invoke directive
      const subArgs = parseArgs(invokeDirective.additionalArgs.split(/\s+/));

      // Merge with current config, allowing sub-agent to override
      const subConfig = {
        ...config,
        ...subArgs,
        role: subRole
      };

      // Recursively run the sub-agent with fresh context
      const subResult = await runAgentWithOrchestration(subRole, subConfig, 1);

      // If this was the plan agent, extract and save TASKS.md content
      if (subRole === 'plan' && subResult.output) {
        const tasksContent = extractTasksContent(subResult.output);
        if (tasksContent) {
          try {
            await writeTasksFile(config.tasksFile || 'TASKS.md', tasksContent);
            displayStatus(role, `Saved tasks to ${config.tasksFile || 'TASKS.md'}`);
          } catch (writeError) {
            console.error(`Warning: Failed to save TASKS.md: ${writeError.message}`);
          }
        }
      }

      // Check if sub-agent failed or timed out
      if (subResult.exitCode !== 0) {
        displayStatus(role, `Sub-agent '${subRole}' exited with code ${subResult.exitCode}`);
      } else {
        displayStatus(role, `Sub-agent '${subRole}' completed successfully`);
      }

      // Resume the manager agent with continuation
      displayStatus(role, 'Resuming manager after sub-agent completion...');

      // Create a continuation prompt for the manager
      const continuationPrompt = `\n\n--- SUB-AGENT RESULT ---\nAgent: ${subRole}\nExit Code: ${subResult.exitCode}\nCompleted: ${hasCompletionSignal(subResult.output) ? 'Yes' : 'No'}\n--- END SUB-AGENT RESULT ---\n\nThe sub-agent has finished. What is the next step?\n`;

      // Recursively call manager again with updated iteration
      const managerConfig = {
        ...config,
        continuationPrompt
      };

      return await runAgentWithOrchestration(role, managerConfig, iteration + 1);
    }
  }

  // No special signals detected
  // If this was the plan role, still try to extract and save TASKS.md content
  if (role.toLowerCase() === 'plan' && result.output) {
    const tasksContent = extractTasksContent(result.output);
    if (tasksContent) {
      try {
        await writeTasksFile(config.tasksFile || 'TASKS.md', tasksContent);
        displayStatus(role, `Saved tasks to ${config.tasksFile || 'TASKS.md'}`);
      } catch (writeError) {
        console.error(`Warning: Failed to save TASKS.md: ${writeError.message}`);
      }
    }
  }

  return result;
}

/**
 * Main CLI function
 */
async function main() {
  try {
    // Step 1: Parse CLI arguments
    const cliArgs = parseArgs(Bun.argv);

    // Check for --help flag
    if (cliArgs.help) {
      displayHelp();
      process.exit(0);
    }

    // Check for --version flag
    if (cliArgs.version) {
      console.log(packageJson.version);
      process.exit(0);
    }

    // Step 2: Load configuration (merge defaults, config file, env vars, CLI flags)
    const config = await loadConfig(cliArgs);

    // Step 3: Determine role (from --role flag or default to 'manage')
    const role = config.role || 'manage';

    // Step 3.5: Get initial prompt for manage role
    // Only prompt for input when running the manage role (orchestrator)
    if (role === 'manage') {
      const initialPrompt = await getInitialPrompt(cliArgs.prompt);
      if (!initialPrompt) {
        console.error('Error: A project description is required to start.');
        console.error('Provide one with -p "your project description" or enter it when prompted.');
        process.exit(1);
      }
      config.initialPrompt = initialPrompt;
    }

    // // Step 4: Load role meta-prompt
    // let rolePrompt;
    // try {
    //   rolePrompt = loadRole(role);
    // } catch (error) {
    //   console.error(`Error: ${error.message}`);
    //   process.exit(1);
    // }

    // // Step 5: Read TASKS.md file
    // let tasksContent = '';
    // try {
    //   tasksContent = await readTasksFile(config.tasksFile);
    // } catch (error) {
    //   // If TASKS.md is not found, create a new one
    //   if (error.message.includes('not found')) {
    //     console.warn(`Warning: TASKS.md not found. Creating new file...`);

    //     // Create a new TASKS.md with basic template
    //     const defaultTasks = `# Tasks\n\n## Todo\n- [ ] Add your first task here\n`;

    //     try {
    //       await Bun.write(config.tasksFile, defaultTasks);
    //       tasksContent = defaultTasks;
    //       console.log(`Created new tasks file: ${config.tasksFile}`);
    //     } catch (writeError) {
    //       // If we can't create the file, just warn and continue
    //       console.warn(`Could not create tasks file: ${writeError.message}`);
    //     }
    //   } else {
    //     // Other errors - just warn and continue
    //     console.warn(`Warning: ${error.message}`);
    //   }
    // }

    // Display minimal UI
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Ralph-Thinks-First`);
    console.log(`  Role: ${role}`);
    console.log(`  Model: ${config.model}`);
    console.log(`  Tasks File: ${config.tasksFile}`);
    console.log(`  Max Iterations: ${config.maxIterations}`);
    if (config.initialPrompt) {
      // Truncate long prompts for display
      const displayPrompt = config.initialPrompt.length > 50
        ? config.initialPrompt.substring(0, 47) + '...'
        : config.initialPrompt;
      console.log(`  Project: ${displayPrompt}`);
    }
    console.log(`${'='.repeat(60)}\n`);

    displayStatus(role, 'Starting...');

    // Step 6: Run agent with orchestration support (handles recursive sub-agent calls)
    const result = await runAgentWithOrchestration(role, config);

    // Step 7 & 8: Output and events already handled by runAgentWithOrchestration

    // Display events summary if any
    if (result.events && result.events.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  Events Summary (${result.events.length} events)`);
      console.log(`${'='.repeat(60)}`);
      result.events.forEach(handleEvent);
    }

    // Handle timeout
    if (result.timedOut) {
      console.error('\nAgent execution timed out.');
      process.exit(124); // Standard timeout exit code
    }

    // Handle max iterations
    if (result.reachedMaxIterations) {
      console.error('\nReached maximum iterations limit.');
      process.exit(2); // Custom exit code for max iterations
    }

    // Display completion status
    console.log(`\n${'='.repeat(60)}`);
    if (result.exitCode === 0) {
      displayStatus(role, 'Completed successfully');
    } else {
      displayStatus(role, `Exited with code ${result.exitCode}`);
    }
    console.log(`${'='.repeat(60)}\n`);

    // Step 9: Exit with agent exit code
    process.exit(result.exitCode || 0);

  } catch (error) {
    // Handle unexpected errors gracefully
    console.error('\nFatal Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the CLI
main();
