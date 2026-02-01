# Ralph-Thinks-First

**An agentic AI framework for task orchestration using Claude**

Ralph-Thinks-First is a Bun-based CLI application that orchestrates AI agents to accomplish complex tasks through structured planning, coding, and documentation workflows. Built for developers who want to automate multi-step development tasks using Claude AI.

## Features

- **Multi-Agent Orchestration**: Manager agents coordinate planning, coding, and documentation
- **Task-Driven Workflow**: Works from markdown task files (TASKS.md)
- **Zero Dependencies**: Built entirely on Bun's standard library
- **Event Streaming**: Real-time monitoring via JSON-based event protocol
- **Flexible Configuration**: CLI flags, environment variables, and config files
- **Backwards Compatible**: Reads existing TASKS.md files from bash-based predecessors
- **Simple Architecture**: Process-based agents with clean context isolation

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Claude CLI](https://github.com/anthropics/claude-code) installed and configured

### Installation

Install globally via npm:

```bash
npm install -g ralph-thinks-first
```

Or use directly with npx (no installation required):

```bash
npx ralph-thinks-first
```

### Basic Usage

Launch the manager agent in your project directory:

```bash
npx ralph-thinks-first
```

The manager will:
1. Read your `TASKS.md` file
2. Analyze the tasks
3. Orchestrate planning, coding, and documentation agents
4. Execute tasks until completion or max iterations reached

Run a specific role directly:

```bash
# Run only the planning agent
npx ralph-thinks-first --role plan

# Run only the coding agent
npx ralph-thinks-first --role code

# Run only the documentation agent
npx ralph-thinks-first --role document
```

## Roles

Ralph-Thinks-First has four built-in agent roles:

### Manager (`manage`)
The orchestrator role. Reads TASKS.md, analyzes what needs to be done, and spawns the appropriate sub-agents (planner, coder, documentor) to accomplish the work. Manages iteration limits and completion detection.

**When to use**: This is the default role. Use it when starting a new workflow or when you want the system to decide what agents are needed.

### Architect (`plan`)
The planning role. Reads TASKS.md and project requirements, then creates or updates the task list with detailed implementation steps and success parameters.

**When to use**: When you need to break down a high-level goal into concrete, actionable tasks.

### Coder (`code`)
The implementation role. Reads TASKS.md, finds the first unchecked task, implements it, and marks it complete. Focuses on one task at a time.

**When to use**: When you have a well-defined task list and want to execute tasks sequentially.

### Documentor (`document`)
The documentation role. Reads the codebase and TASKS.md, then generates or updates documentation (README, API docs, code comments).

**When to use**: When you need to document completed features or explain complex code.

## CLI Arguments

```bash
npx ralph-thinks-first [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--role <name>` | Specify which agent role to run | `manage` |
| `--tasks <path>` | Path to tasks file | `TASKS.md` |
| `--model <model>` | Claude model to use | `claude-sonnet-4-5` |
| `--max-iterations <n>` | Maximum agent iterations | `10` |
| `--config <path>` | Path to config file | `.rtfrc.json` |

### Examples

```bash
# Use a different tasks file
npx ralph-thinks-first --tasks ./project-tasks.md

# Override the Claude model
npx ralph-thinks-first --model claude-opus-4-5

# Set a higher iteration limit
npx ralph-thinks-first --max-iterations 20

# Run architect role with custom config
npx ralph-thinks-first --role plan --config ./my-config.json
```

## Configuration

Configuration can be set through multiple sources with the following priority:

**CLI flags > Environment variables > Config file > Defaults**

### Config File (`.rtfrc.json`)

Create a `.rtfrc.json` file in your project directory:

```json
{
  "model": "claude-sonnet-4-5",
  "maxIterations": 15,
  "tasksFile": "TASKS.md",
  "claudeCommand": "claude"
}
```

The config file is optional. All settings have sensible defaults.

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `RTF_MODEL` | Claude model to use | `claude-sonnet-4-5` |
| `RTF_MAX_ITERATIONS` | Max iterations | `10` |
| `RTF_TASKS_FILE` | Tasks file path | `TASKS.md` |
| `RTF_CONFIG_FILE` | Config file path | `.rtfrc.json` |
| `RTF_CLAUDE_COMMAND` | Claude CLI command | `claude` |

Example:

```bash
export RTF_MODEL=claude-opus-4-5
export RTF_MAX_ITERATIONS=20
npx ralph-thinks-first
```

### Default Configuration

```javascript
{
  model: "claude-sonnet-4-5",
  maxIterations: 10,
  tasksFile: "TASKS.md",
  configFile: ".rtfrc.json",
  claudeCommand: "claude"
}
```

## Task File Format

Ralph-Thinks-First reads tasks from a markdown file (default: `TASKS.md`). Tasks use standard markdown checkbox syntax:

```markdown
# Migration Project

## Phase 1: Setup

### Task 1.1: Initialize Project
**Description**: Set up the project structure

**Success Parameters**:
- [ ] Directory structure created
- [ ] package.json configured
- [ ] Dependencies installed

### Task 1.2: Configure Build
**Description**: Set up build pipeline

**Success Parameters**:
- [ ] Build script added
- [ ] Tests passing
```

### Checkbox Format

- `- [ ]` = Unchecked task (pending)
- `- [x]` = Checked task (completed)

Agents will:
1. Find the first unchecked task
2. Complete the work
3. Mark it as checked by changing `[ ]` to `[x]`
4. Move to the next unchecked task

## Event Protocol

Ralph-Thinks-First uses a simple JSON-based event protocol for inter-process communication. Events are emitted to stderr in JSON Lines format.

### Event Types

**Status Event** - Agent status updates:
```json
{"type":"status","agent":"code","status":"running"}
```

**Output Event** - Progress messages:
```json
{"type":"output","agent":"plan","message":"Analyzing requirements..."}
```

**Error Event** - Error information:
```json
{"type":"error","agent":"document","error":"File not found"}
```

See [docs/EVENT_PROTOCOL.md](docs/EVENT_PROTOCOL.md) for complete specification.

### Event Streaming

Events enable real-time monitoring and lay the foundation for a future web-based UI. All events are written to stderr, allowing stdout to remain clean for agent output.

## How It Works

### Workflow Overview

1. **Launch**: User runs `npx ralph-thinks-first` (defaults to manager role)
2. **Configuration**: System merges CLI flags, env vars, config file, and defaults
3. **Task Loading**: Manager reads TASKS.md to understand what needs to be done
4. **Orchestration**: Manager spawns appropriate sub-agents:
   - **Architect** (plan): If tasks need refinement or planning
   - **Coder** (code): To implement tasks
   - **Documentor** (document): To generate documentation
5. **Execution**: Each agent runs with fresh context (no history, only prompt + TASKS.md)
6. **Completion**: Manager detects completion signals and exits

### Context Isolation

Each agent invocation gets a **fresh context**:
- Reads only the role's meta-prompt and current TASKS.md content
- No conversation history from previous agents
- Clean slate for every subprocess

This ensures consistent, predictable behavior and prevents context pollution.

### Recursive Sub-Agents

The manager role can spawn sub-agents using special directives in its output:

```
**INVOKE**: ralph-thinks-first --role plan
```

When the manager emits this directive, Ralph-Thinks-First:
1. Spawns the plan agent as a subprocess
2. Waits for completion
3. Resumes the manager with the result
4. Manager decides next steps

This enables flexible, dynamic workflows without hardcoded orchestration logic.

## Architecture

### Process Model

```
ralph-thinks-first (manager)
  ├─> ralph-thinks-first --role plan (architect)
  ├─> ralph-thinks-first --role code (coder)
  └─> ralph-thinks-first --role document (documentor)
```

- Each agent is a separate process
- Agents communicate via exit codes and output
- Events stream via stderr for monitoring
- No shared state between agents (reads TASKS.md for coordination)

### File Structure

```
ralph-thinks-first/
├── src/
│   ├── index.js           # CLI entry point
│   ├── config.js          # Configuration loading
│   ├── agents/
│   │   └── agent.js       # Agent spawning logic
│   ├── roles/
│   │   ├── manage.js      # Manager meta-prompt
│   │   ├── plan.js        # Architect meta-prompt
│   │   ├── code.js        # Coder meta-prompt
│   │   └── document.js    # Documentor meta-prompt
│   └── utils/
│       ├── cli.js         # CLI argument parser
│       ├── tasks.js       # TASKS.md reader
│       ├── roles.js       # Role loader
│       └── events.js      # Event protocol
├── tests/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── docs/
│   └── EVENT_PROTOCOL.md  # Event specification
└── package.json
```

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run only unit tests
bun test tests/unit/

# Run only integration tests
bun test tests/integration/
```

### Local Development

```bash
# Clone the repository
git clone <repo-url>
cd ralph-thinks-first

# Install dependencies (none for runtime, but needed for testing)
bun install

# Link for local testing
bun link

# Now you can run locally
ralph-thinks-first
```

### Making the CLI Executable

The entry point (`src/index.js`) includes a shebang and must be executable:

```bash
chmod +x src/index.js
```

This is automatically handled during npm installation.

## Backwards Compatibility

Ralph-Thinks-First maintains backwards compatibility with TASKS.md files created by the original bash-based implementation. You can:

- Use existing TASKS.md files without modification
- Migrate gradually from bash scripts to the Bun CLI
- Mix and match old and new workflows during transition

## Troubleshooting

### Claude CLI Not Found

```
Error: spawn claude ENOENT
```

**Solution**: Install and configure the [Claude CLI](https://github.com/anthropics/claude-code)

### TASKS.md Not Found

```
Warning: Failed to read tasks file: ENOENT: no such file or directory
```

**Solution**: Create a `TASKS.md` file in your project directory, or specify a different path with `--tasks`

### Invalid Role Name

```
Error: Unknown role 'xyz'. Available roles: manage, plan, code, document
```

**Solution**: Use one of the valid role names (case-insensitive)

### Max Iterations Reached

```
Reached maximum iterations (10). Stopping.
```

**Solution**: Increase the limit with `--max-iterations` or via config file. This may indicate:
- Tasks are too complex for automatic completion
- Tasks need manual intervention
- The agent is stuck in a loop (review TASKS.md for clarity)

## Future Roadmap

- **Web-based UI**: Real-time monitoring dashboard using event streaming
- **Custom Roles**: Plugin system for user-defined agent roles
- **Parallel Execution**: Run independent tasks concurrently
- **Rich Terminal UI**: Enhanced console display with progress indicators
- **Task Templates**: Pre-built task structures for common workflows
- **Multi-Model Support**: Use different Claude models for different roles

## Contributing

Contributions are welcome. Please ensure:

- All tests pass (`bun test`)
- Code follows existing style and patterns
- No external dependencies added without discussion
- Event protocol changes are backwards-compatible

## License

MIT

## Acknowledgments

Built on [Bun](https://bun.sh) and powered by [Claude](https://www.anthropic.com/claude).

Inspired by the need for structured, repeatable AI-assisted development workflows.
