/**
 * CLI Argument Parser
 *
 * Parses command-line arguments for the Ralph-Thinks-First CLI.
 * Supports flags: --config, --model, --max-iterations, --tasks, --role
 */

/**
 * Parses command-line arguments into a structured object
 * @param {string[]} argv - Array of command-line arguments (typically process.argv or Bun.argv)
 * @returns {object} Parsed arguments object with keys: config, model, maxIterations, tasks, role
 */
export function parseArgs(argv) {
  const args = {
    config: null,
    model: null,
    maxIterations: null,
    tasks: null,
    role: null,
    help: false,
    version: false
  };

  // Skip first two arguments (interpreter and script path) if present
  // Bun.argv already excludes them, but process.argv includes them
  let startIndex = 0;
  if (argv[0] && (argv[0].includes('bun') || argv[0].includes('node'))) {
    startIndex = 2;
  }

  for (let i = startIndex; i < argv.length; i++) {
    const arg = argv[i];

    // Parse --config <path>
    if (arg === '--config' || arg === '-c') {
      if (i + 1 < argv.length) {
        args.config = argv[i + 1];
        i++; // Skip next argument
      }
    }
    // Parse --model <model-name>
    else if (arg === '--model' || arg === '-m') {
      if (i + 1 < argv.length) {
        args.model = argv[i + 1];
        i++; // Skip next argument
      }
    }
    // Parse --max-iterations <n>
    else if (arg === '--max-iterations' || arg === '--max-iter') {
      if (i + 1 < argv.length) {
        args.maxIterations = argv[i + 1];
        i++; // Skip next argument
      }
    }
    // Parse --tasks <path>
    else if (arg === '--tasks' || arg === '-t') {
      if (i + 1 < argv.length) {
        args.tasks = argv[i + 1];
        i++; // Skip next argument
      }
    }
    // Parse --role <role-name>
    else if (arg === '--role' || arg === '-r') {
      if (i + 1 < argv.length) {
        args.role = argv[i + 1];
        i++; // Skip next argument
      }
    }
    // Parse --help
    else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
    // Parse --version
    else if (arg === '--version' || arg === '-v') {
      args.version = true;
    }
  }

  return args;
}
