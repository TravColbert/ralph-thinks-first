#!/usr/bin/env bash
set -euo pipefail

# Defaults
MAX_ITERATIONS=10
TASKS_FILE="TASKS.md"
MODEL="sonnet"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    --tasks) TASKS_FILE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: ralph.sh [OPTIONS]"
      echo "  --max-iterations N   Max loop iterations (default: 10)"
      echo "  --tasks FILE         Task file path (default: TASKS.md)"
      echo "  --model MODEL        Claude model (default: sonnet)"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate
[[ ! -f "$TASKS_FILE" ]] && { echo "Error: $TASKS_FILE not found"; exit 1; }

# Build prompt
PROMPT="You are working through tasks in $TASKS_FILE.

Instructions:
1. Read $TASKS_FILE to see current tasks
2. Find the first unchecked task (- [ ])
3. Complete that task
4. Mark it complete by changing - [ ] to - [x]
5. If all tasks are complete, say 'ALL_TASKS_COMPLETE'

Work on ONE task per iteration. Be thorough but focused."

# Main loop
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo "=== Iteration $i/$MAX_ITERATIONS ==="

  # Check if all tasks complete
  if ! grep -q '^\s*- \[ \]' "$TASKS_FILE" 2>/dev/null; then
    echo "All tasks complete!"
    exit 0
  fi

  # Run Claude
  echo "$PROMPT" | claude -p --model "$MODEL" --dangerously-skip-permissions

  echo ""
done

echo "Max iterations reached. Check $TASKS_FILE for remaining tasks."
