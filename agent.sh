#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Default values for the script
TASK_FILE=""
MODEL="sonnet" # Default model, can be overridden
INITIAL_PROMPT=""
META_PROMPT_FILE="DOCUMENTOR.md"

# --- Argument Parsing ---
# Handles command-line options to customize the script's behavior
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--prompt)
      INITIAL_PROMPT="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -f|--file)
      META_PROMPT_FILE="$2"
      shift 2
      ;;
    -t|--task)
      if [[ -z "${2:-}" ]]; then
        echo "Error: -t, --task requires a filepath argument"
        exit 1
      fi
      TASK_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./principal.sh [OPTIONS]"
      echo "  -p, --prompt 'TEXT'   Invocation instructions."
      echo "  -m, --model 'MODEL'   Specify the Claude model to use (default: claude sonnet)."
      echo "  -f, --file 'FILE'     Path to the meta-role file (e.g: DOCUMENTOR.md, META_PROMPT.md)."
      echo "  -t, --task FILE       Path to the task file."
      echo "  -h, --help            Show this help message."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# --- Load Meta-Prompt ---
if [[ ! -f "$META_PROMPT_FILE" ]]; then
  echo "Error: Meta-prompt file not found at '$META_PROMPT_FILE'"
  exit 1
fi
META_PROMPT=$(cat "$META_PROMPT_FILE")

# --- Main Script Logic ---

# Ensure the tasks file exists
if [[ ! -f "$TASK_FILE" ]]; then
  echo "Error: Task file not found at '$TASK_FILE'"
  exit 1
fi

echo "Starting interactive session with model '$MODEL'."
echo "----------------------------------------------------"

# Initialize user_input with the initial prompt if provided
user_input="$INITIAL_PROMPT"

# --- Construct the full prompt for the LLM ---
# 1. Start with the meta-prompt
# 2. Add the source code filename
# 3. Add the user's custom input
full_prompt=$(cat <<-EOM
$META_PROMPT

SOURCE_CODE_FILE_NAME=$TASK_FILE

$user_input
EOM
)

  # --- Call the LLM and process the response ---
  # The '--dangerously-skip-permissions' flag is used for demonstration;
  # in a real-world scenario, handle permissions appropriately.
  # We assume a CLI tool 'claude' is available in the PATH.
echo "Thinking..."
echo "$full_prompt" | claude -p --model "$MODEL" --dangerously-skip-permissions
