# Event Protocol Specification

## Overview

The Ralph-Thinks-First CLI uses a simple JSON-based event protocol for inter-process communication between the parent process and child agent processes. This protocol enables real-time monitoring of agent status and activity, laying the foundation for a future web-based UI.

## Protocol Format

Events are transmitted using the **JSON Lines** format (also known as newline-delimited JSON):
- Each event is a single JSON object
- Each JSON object is written on a single line
- Events are separated by newline characters (`\n`)
- All events are written to **stderr** (standard error stream)

This approach allows stdout to remain clean for agent output while stderr carries structured event data.

## Event Types

The protocol defines exactly **three event types**:

### 1. Status Event

Indicates the current status of an agent.

```json
{
  "type": "status",
  "agent": "<role>",
  "status": "starting|running|completed|error"
}
```

**Fields:**
- `type`: Always `"status"`
- `agent`: The role name (`"manage"`, `"plan"`, `"code"`, `"document"`)
- `status`: One of:
  - `"starting"` - Agent process has been spawned
  - `"running"` - Agent is actively processing
  - `"completed"` - Agent finished successfully
  - `"error"` - Agent encountered an error

**Example:**
```json
{"type":"status","agent":"code","status":"running"}
```

### 2. Output Event

Captures informational messages or progress updates from an agent.

```json
{
  "type": "output",
  "agent": "<role>",
  "message": "<text>"
}
```

**Fields:**
- `type`: Always `"output"`
- `agent`: The role name
- `message`: Free-form text message from the agent

**Example:**
```json
{"type":"output","agent":"plan","message":"Analyzing task requirements..."}
```

### 3. Error Event

Communicates error information from an agent.

```json
{
  "type": "error",
  "agent": "<role>",
  "error": "<error message>"
}
```

**Fields:**
- `type`: Always `"error"`
- `agent`: The role name
- `error`: Description of the error that occurred

**Example:**
```json
{"type":"error","agent":"document","error":"Failed to read source file: ENOENT"}
```

## Emitting Events (Agent Side)

Agent subprocesses emit events by writing JSON to stderr:

```javascript
// Example: Emit a status event
const event = {
  type: "status",
  agent: "code",
  status: "running"
};
console.error(JSON.stringify(event));
```

**Implementation notes:**
- Use `console.error()` to write to stderr
- Use `JSON.stringify()` to serialize the event object
- Each event must be on its own line (automatically handled by `console.error()`)
- Events should be emitted at meaningful points in agent execution

## Consuming Events (Parent Side)

The parent process consumes events by parsing stderr line-by-line:

```javascript
// Pseudocode for event consumption
for (const line of stderrLines) {
  try {
    const event = JSON.parse(line);
    if (event.type && event.agent) {
      // Valid event - handle it
      handleEvent(event);
    }
  } catch (e) {
    // Not valid JSON or not an event - pass through as raw stderr
    console.error(line);
  }
}
```

**Implementation notes:**
- Attempt to parse each stderr line as JSON
- If parsing succeeds and has `type` + `agent` fields, treat as event
- If parsing fails or fields missing, treat as regular stderr output
- This allows mixing structured events with unstructured error messages
- Parent process should gracefully handle malformed events (log but don't crash)

## Design Principles

1. **Simplicity**: Only three event types to minimize complexity
2. **Human-readable**: JSON format is easy to debug and inspect
3. **Streaming-friendly**: Line-delimited format works well with stream processing
4. **Graceful degradation**: Non-event stderr output passes through unchanged
5. **Future-proof**: Simple structure is easy to extend without breaking changes
6. **Zero dependencies**: Uses only standard JSON serialization/parsing

## Future Extensions

While the current protocol is intentionally minimal, potential future additions could include:

- `timestamp` field on all events
- `progress` event type with percentage completion
- `metadata` field for arbitrary key-value data
- `correlation_id` for tracking related events across agent spawns

Any extensions should maintain backwards compatibility with this core specification.

## Example Event Stream

Here's what a typical stderr event stream might look like:

```
{"type":"status","agent":"manage","status":"starting"}
{"type":"output","agent":"manage","message":"Reading TASKS.md..."}
{"type":"status","agent":"manage","status":"running"}
{"type":"output","agent":"manage","message":"Spawning architect agent..."}
{"type":"status","agent":"plan","status":"starting"}
{"type":"status","agent":"plan","status":"running"}
{"type":"output","agent":"plan","message":"Analyzing project requirements..."}
{"type":"status","agent":"plan","status":"completed"}
{"type":"output","agent":"manage","message":"Architect completed successfully"}
{"type":"status","agent":"manage","status":"completed"}
```

This stream shows the manager starting, spawning the plan agent, and both completing successfully.
