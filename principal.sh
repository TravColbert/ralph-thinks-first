#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Default values for the script
TASKS_FILE="TASKS.md"
MODEL="sonnet" # Default model, can be overridden
INITIAL_PROMPT=""
META_PROMPT_FILE="META_PROMPT.md"

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
      TASKS_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./principal.sh [OPTIONS]"
      echo "  -p, --prompt 'TEXT'   Initial project idea to start the session."
      echo "  -m, --model 'MODEL'   Specify the Claude model to use (default: claude-3-sonnet-20240229)."
      echo "  -f, --file 'FILE'     Path to the meta-prompt file (default: META_PROMPT.md)."
      echo "  -t, --task FILE       Path to the tasks file (default: TASKS.md)."
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
touch "$TASKS_FILE"

echo "Starting interactive session with model '$MODEL'."
echo "The generated task list will be saved to '$TASKS_FILE'."
echo "Type 'exit' or 'quit' at any time to end the session."
echo "----------------------------------------------------"

# Initialize user_input with the initial prompt if provided
user_input="$INITIAL_PROMPT"

while true; do
  # If user_input is empty, prompt the user for it.
  if [[ -z "$user_input" ]]; then
    read -p "You: " user_input
  else
    echo "You: $user_input"
  fi

  # Check for exit condition
  if [[ "$user_input" == "exit" || "$user_input" == "quit" ]]; then
    echo "Session ended. Your final task list is in '$TASKS_FILE'."
    break
  fi

  # --- Construct the full prompt for the LLM ---
  # 1. Start with the meta-prompt
  # 2. Add the current content of the tasks file
  # 3. Add the user's latest input
  current_tasks_content=$(cat "$TASKS_FILE")
  full_prompt=$(cat <<-EOM
$META_PROMPT

Here is the current content of '$TASKS_FILE':
---
$current_tasks_content
---

Here is the user's request:
$user_input
EOM
)

  # --- Call the LLM and process the response ---
  # The '--dangerously-skip-permissions' flag is used for demonstration;
  # in a real-world scenario, handle permissions appropriately.
  # We assume a CLI tool 'claude' is available in the PATH.
  echo "Principal (Claude): Thinking..."
  llm_response=$(echo "$full_prompt" | claude -p --model "$MODEL" --dangerously-skip-permissions)

  # --- Parse the LLM response ---
  # Extract the conversational part (everything before the BEGIN marker)
  conversational_part=$(echo "$llm_response" | sed '/---BEGIN TASKS.MD---/Q')

  # Extract the TASKS.md content (everything between the markers)
  tasks_part=$(echo "$llm_response" | sed -n '/---BEGIN TASKS.MD---/,/---END TASKS.MD---/p' | sed '1d;$d')

  # Display the conversational part to the user
  echo "Principal (Claude): $conversational_part"

  # Update the TASKS.md file if new content was provided
  if [[ -n "$tasks_part" ]]; then
    echo "$tasks_part" > "$TASKS_FILE"
    echo ""
    echo "INFO: '$TASKS_FILE' has been updated."
    echo "----------------------------------------------------"
  fi

  # Clear user_input for the next loop iteration
  user_input=""
done
