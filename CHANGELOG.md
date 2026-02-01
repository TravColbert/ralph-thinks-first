# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-31

### Added
- Initial release of Ralph-Thinks-First agentic AI framework
- Migration from bash scripts to Bun-based CLI application
- Support for `npx ralph-thinks-first` invocation
- Simplified role names: `manage`, `plan`, `code`, `document` (case-insensitive)
- Event streaming protocol for agent communication (JSON Lines format)
- Configuration system with priority: CLI flags > Env vars > Config file > Defaults
- Support for `.rtfrc.json` configuration file
- CLI arguments: `--config`, `--model`, `--max-iterations`, `--tasks`, `--role`
- Environment variables: `RTF_MODEL`, `RTF_MAX_ITERATIONS`, `RTF_TASKS_FILE`, `RTF_CONFIG_FILE`
- Four core agent roles:
  - **Manager** (`manage`): Orchestrates workflow and delegates to other agents
  - **Architect** (`plan`): Designs implementation plans and structures tasks
  - **Coder** (`code`): Executes development tasks from TASKS.md
  - **Documentor** (`document`): Generates project documentation
- Recursive sub-process architecture for agent isolation
- IPC event streaming for future web-based monitoring UI
- Comprehensive unit and integration tests using Bun's test runner

### Changed
- Replaced bash-based orchestration (`principal.sh`, `ralph.sh`, `agent.sh`) with JavaScript
- Switched from Claude API to Claude CLI commands for agent execution
- Simplified workflow: single entry point replaces multiple bash scripts
- Fresh context per agent invocation (no conversation history)

### Maintained
- Backwards compatibility with existing TASKS.md files
- Support for markdown checkbox syntax (`- [ ]` and `- [x]`)
- Integration with Claude CLI (no direct API usage)
- Zero external dependencies (Bun built-ins only)

### Deprecated
- `principal.sh` - replaced by `ralph-thinks-first` CLI
- `ralph.sh` - replaced by `ralph-thinks-first --role <role>`
- `agent.sh` - replaced by internal agent spawning logic

## [Unreleased]

### Planned
- `--help` flag for usage information
- `--version` flag for version display
- Improved error messages for common issues
- Web-based chat interface for monitoring agent activity
- Real-time event streaming to web UI
- Enhanced logging and debugging options
- Support for additional agent roles
- Plugin system for custom agent types

---

[0.1.0]: https://github.com/yourusername/ralph-thinks-first/releases/tag/v0.1.0
