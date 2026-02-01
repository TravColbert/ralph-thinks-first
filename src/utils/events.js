/**
 * Event Protocol Utilities
 *
 * Provides functions for emitting and parsing events according to the
 * Ralph-Thinks-First event protocol specification (see docs/EVENT_PROTOCOL.md)
 *
 * Event Format (JSON Lines):
 * - Status: {"type":"status","agent":"<role>","status":"starting|running|completed|error"}
 * - Output: {"type":"output","agent":"<role>","message":"<text>"}
 * - Error:  {"type":"error","agent":"<role>","error":"<error message>"}
 */

/**
 * Emits an event to stderr in JSON Lines format
 *
 * @param {string} type - Event type: "status", "output", or "error"
 * @param {string} agent - Agent role name (e.g., "manage", "plan", "code", "document")
 * @param {Object} data - Event-specific data
 *   - For "status": { status: "starting|running|completed|error" }
 *   - For "output": { message: "<text>" }
 *   - For "error":  { error: "<error message>" }
 *
 * @example
 * emitEvent("status", "code", { status: "running" });
 * emitEvent("output", "plan", { message: "Analyzing requirements..." });
 * emitEvent("error", "document", { error: "File not found" });
 */
export function emitEvent(type, agent, data) {
  // Construct the event object
  const event = {
    type,
    agent,
    ...data
  };

  // Serialize to JSON and write to stderr with newline
  // Using process.stderr.write directly for better testability
  process.stderr.write(JSON.stringify(event) + '\n');
}

/**
 * Parses a line from stderr as a potential event
 *
 * @param {string} stderrLine - A single line from stderr output
 * @returns {Object|null} - Parsed event object if valid, null otherwise
 *
 * Returns null in the following cases:
 * - Line is not valid JSON
 * - Parsed JSON is missing required "type" field
 * - Parsed JSON is missing required "agent" field
 * - Line is empty, null, or undefined
 *
 * If parsing succeeds and required fields are present, returns the full
 * parsed object including any additional fields (for future extensibility).
 *
 * @example
 * parseEventStream('{"type":"status","agent":"code","status":"running"}')
 * // Returns: { type: "status", agent: "code", status: "running" }
 *
 * parseEventStream("Regular error message")
 * // Returns: null
 */
export function parseEventStream(stderrLine) {
  // Handle null, undefined, or empty input
  if (!stderrLine || typeof stderrLine !== 'string') {
    return null;
  }

  // Trim whitespace (including leading/trailing newlines and tabs)
  const trimmed = stderrLine.trim();

  // Empty string after trimming
  if (trimmed === '') {
    return null;
  }

  // Attempt to parse as JSON
  try {
    const parsed = JSON.parse(trimmed);

    // Validate that it's an object (not array, string, number, etc.)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Validate required fields: "type" and "agent"
    if (!parsed.type || !parsed.agent) {
      return null;
    }

    // Valid event - return the entire parsed object
    // (This preserves any additional fields for future extensibility)
    return parsed;

  } catch (e) {
    // Not valid JSON - return null for graceful degradation
    return null;
  }
}
