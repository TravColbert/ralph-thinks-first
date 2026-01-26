#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Default values for the script
MAX_ITERATIONS=10
TASK_FILE="TASKS.md"
MODEL="sonnet" # Default model, can be overridden
INITIAL_PROMPT=""
ROLE_FILE="MANAGER.md"
INTERACTIVE=false

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
    --interactive)
      INTERACTIVE=true
      shift
      ;;
    -h|--help)
      echo "Usage: ./agent.sh [OPTIONS]"
      echo "  --max-iterations N    Max loop iterations (default: 10)"
      echo "  -p, --prompt 'TEXT'   Invocation instructions."
      echo "  -m, --model 'MODEL'   Specify the Claude model to use (default: claude sonnet)."
      echo "  -r, --role 'FILE'     Path to the role file (e.g: MANAGER.md)."
      echo "  -t, --task FILE       Path to the task file (default: TASKS.md)."
      echo "  --interactive         Prompt user for input each iteration."
      echo "  -h, --help            Show this help message."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "----------------------------------------------------"
echo "Agent invocation parameters:"
echo "  Max Iterations: $MAX_ITERATIONS"
echo "  Initial Prompt: ${INITIAL_PROMPT:-<none>}"
echo "  Model: $MODEL"
echo "  Role: $ROLE_FILE"
echo "  Task File: $TASK_FILE"
echo "  Interactive: $INTERACTIVE"
echo "----------------------------------------------------"

# --- Load Role ---
if [[ ! -f "$ROLE_FILE" ]]; then
  echo "Error: Role file not found at '$ROLE_FILE'"
  exit 1
fi
ROLE_DEFINITION=$(cat "$ROLE_FILE")

# --- Main Script Logic ---

# Ensure the task file exists (create it if interactive, else error)
if [[ ! -f "$TASK_FILE" ]]; then
  if [[ "$INTERACTIVE" == true ]]; then
    touch "$TASK_FILE"
    echo "Created empty task file: $TASK_FILE"
  else
    echo "Error: Task file not found at '$TASK_FILE'"
    exit 1
  fi
fi

echo "Starting session with model '$MODEL'."
echo "----------------------------------------------------"

# Initialize user_input with the initial prompt if provided
user_input="$INITIAL_PROMPT"

# Conversation history accumulates across iterations
CONVERSATION_HISTORY=""

for ((i=0; i<MAX_ITERATIONS; i++)); do
  # --- Gather user input ---
  if [[ -z "$user_input" ]]; then
    if [[ "$INTERACTIVE" == true ]]; then
      read -p "You (type 'exit' to quit): " user_input
    fi
    # In autonomous mode, empty input is fine — the LLM works from the task file
  else
    echo "You: $user_input"
  fi

  # Check for exit condition
  if [[ "$user_input" == "exit" || "$user_input" == "quit" ]]; then
    echo "Session ended."
    break
  fi

  # Append user turn to conversation history (skip for CODER — minimal context strategy)
  if [[ -n "$user_input" && "$ROLE_FILE" != *"CODER"* ]]; then
    CONVERSATION_HISTORY+="USER: $user_input"$'\n'
  fi

  # --- Read current task file contents ---
  current_task_content=$(cat "$TASK_FILE")

  # --- Build optional conversation history block ---
  history_block=""
  if [[ "$ROLE_FILE" != *"CODER"* && -n "$CONVERSATION_HISTORY" ]]; then
    history_block=$(cat <<-HIST

--- CONVERSATION HISTORY ---
$CONVERSATION_HISTORY
--- END CONVERSATION HISTORY ---
HIST
)
  fi

  # --- Construct the full prompt for the LLM ---
  full_prompt=$(cat <<-EOM
$ROLE_DEFINITION

TASK_FILE_NAME=$TASK_FILE

--- CURRENT CONTENTS OF $TASK_FILE ---
$current_task_content
--- END CURRENT CONTENTS ---
$history_block
EOM
)

  # --- Call the LLM and process the response ---
  echo "Thinking..."
  LLM_RESPONSE=$(echo "$full_prompt" | claude -p --model "$MODEL" --dangerously-skip-permissions)

  # Append assistant turn to conversation history (skip for CODER)
  if [[ "$ROLE_FILE" != *"CODER"* ]]; then
    CONVERSATION_HISTORY+="ASSISTANT: $LLM_RESPONSE"$'\n'
  fi

  # --- Parse for task file updates (---BEGIN TASKS.MD--- / ---END TASKS.MD---) ---
  if [[ "$LLM_RESPONSE" == *"---BEGIN TASKS.MD---"* ]]; then
    tasks_content=$(echo "$LLM_RESPONSE" | sed -n '/---BEGIN TASKS.MD---/,/---END TASKS.MD---/p' | sed '1d;$d')
    if [[ -n "$tasks_content" ]]; then
      echo "$tasks_content" > "$TASK_FILE"
      echo "[Task file updated: $TASK_FILE]"
    fi
    # Display only the conversational part (before the marker) to the user
    conversational_part=$(echo "$LLM_RESPONSE" | sed '/---BEGIN TASKS.MD---/Q')
    echo "Agent: $conversational_part"
  else
    # Display the full response
    echo "Agent: $LLM_RESPONSE"
  fi

  # --- Parse for agent completion ---
  if [[ "$LLM_RESPONSE" == *"**AGENT COMPLETE**"* ]]; then
    echo "Agent signaled completion."
    break
  fi

  # --- Parse for sub-agent invocation (MANAGER orchestration) ---
  if [[ "$LLM_RESPONSE" =~ \*\*INVOKE\*\*:[[:space:]]*(.*) ]]; then
    invoke_cmd="${BASH_REMATCH[1]}"
    # Strip any trailing markdown or whitespace
    invoke_cmd=$(echo "$invoke_cmd" | sed 's/[[:space:]]*$//' | sed 's/`//g')
    echo "----------------------------------------------------"
    echo "Manager invoking sub-agent: $invoke_cmd"
    echo "----------------------------------------------------"
    # Execute the sub-agent as a child process (inherits stdin/stdout)
    # Use || true to prevent set -e from killing the manager on sub-agent failure
    eval "$invoke_cmd" && sub_exit_code=0 || sub_exit_code=$?
    echo "----------------------------------------------------"
    echo "Sub-agent finished (exit code: $sub_exit_code)."
    echo "----------------------------------------------------"
    # Feed result back into the manager's next iteration
    user_input="Sub-agent completed with exit code $sub_exit_code. The task file ($TASK_FILE) has been updated. Determine the next step."
    continue
  fi

  # Clear user_input for next iteration
  user_input=""
done

echo "Agent session complete."
