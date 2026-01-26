#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Default values for the script
MAX_ITERATIONS=10
TASK_FILE=""
MODEL="sonnet" # Default model, can be overridden
INITIAL_PROMPT=""
ROLE_FILE="DOCUMENTOR.md"

# --- Argument Parsing ---
# Handles command-line options to customize the script's behavior
while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    -p|--prompt)
      INITIAL_PROMPT="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -r|--role)
      ROLE_FILE="$2"
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
      echo "Usage: ./agent.sh [OPTIONS]"
      echo "  --max-iterations N    Max loop iterations (default: 10)"
      echo "  -p, --prompt 'TEXT'   Invocation instructions."
      echo "  -m, --model 'MODEL'   Specify the Claude model to use (default: claude sonnet)."
      echo "  -r, --role 'FILE'     Path to the meta-role file (e.g: DOCUMENTOR.md)."
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
if [[ ! -f "$ROLE_FILE" ]]; then
  echo "Error: Meta-prompt file not found at '$ROLE_FILE'"
  exit 1
fi
ROLE_DEFINITION=$(cat "$ROLE_FILE")

# --- Main Script Logic ---

# Ensure the task file exists
if [[ ! -f "$TASK_FILE" ]]; then
  echo "Error: Task file not found at '$TASK_FILE'"
  exit 1
fi

echo "Starting interactive session with model '$MODEL'."
echo "----------------------------------------------------"

# Initialize user_input with the initial prompt if provided
user_input="$INITIAL_PROMPT"


for ((i=0; i<MAX_ITERATIONS; i++)); do
  # If user_input is empty, prompt the user for it.
  if [[ -z "$user_input" ]]; then
    read -p "You - (press enter to continue with no further input): " user_input
  else
    echo "You: $user_input"
  fi

  # Check for exit condition
  if [[ "$user_input" == "exit" || "$user_input" == "quit" ]]; then
    echo "Session ended."
    break
  fi

  # --- Construct the full prompt for the LLM ---
  full_prompt=$(cat <<-EOM
$ROLE_DEFINITION

TASK_FILE_NAME=$TASK_FILE

$user_input
EOM
)

  # --- Call the LLM and process the response ---
  echo "Thinking..."
  LLM_RESPONSE=$(echo "$full_prompt" | claude -p --model "$MODEL" --dangerously-skip-permissions)

  # Display the conversational part to the user
  echo "Agent: $LLM_RESPONSE"

  # --- Parse the LLM response ---
  if [[ "$LLM_RESPONSE" == *"**AGENT COMPLETE**" ]]; then
    echo "Agent signaled completion."
    break
  fi
done

echo "Agent session complete."
