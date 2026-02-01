/**
 * Configuration Loading System
 *
 * Merges configuration from multiple sources in priority order:
 * CLI flags > Environment variables > Config file > Defaults
 */

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  model: "claude-sonnet-4-5",
  maxIterations: 10,
  tasksFile: "TASKS.md",
  configFile: ".rtfrc.json",
  claudeCommand: "claude",
  skipPermissions: false
};

/**
 * Loads configuration from .rtfrc.json file if it exists
 * @param {string} configFilePath - Path to the config file
 * @returns {Promise<object>} Configuration object from file, or empty object if file doesn't exist
 */
async function loadConfigFile(configFilePath) {
  try {
    const file = Bun.file(configFilePath);
    const exists = await file.exists();

    if (!exists) {
      return {};
    }

    const text = await file.text();
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // Provide detailed error message for JSON parse errors
      throw new Error(
        `Error: Failed to parse .rtfrc.json: ${parseError.message}\n\n` +
        `The config file at '${configFilePath}' contains invalid JSON.\n` +
        `Please check that:\n` +
        `  - All quotes are properly matched\n` +
        `  - No trailing commas exist\n` +
        `  - The JSON structure is valid\n\n` +
        `Example valid .rtfrc.json:\n` +
        `{\n` +
        `  "model": "claude-sonnet-4-5",\n` +
        `  "maxIterations": 10,\n` +
        `  "tasksFile": "TASKS.md"\n` +
        `}`
      );
    }
  } catch (error) {
    // Gracefully handle missing config files
    if (error.code === 'ENOENT') {
      return {};
    }
    // Re-throw parse errors with details
    if (error.message.includes('Failed to parse')) {
      throw error;
    }
    // Other file read errors
    console.warn(`Warning: Could not read config file ${configFilePath}: ${error.message}`);
    return {};
  }
}

/**
 * Loads configuration from environment variables
 * @returns {object} Configuration object from environment variables
 */
function loadEnvConfig() {
  const config = {};

  if (process.env.RTF_MODEL) {
    config.model = process.env.RTF_MODEL;
  }

  if (process.env.RTF_MAX_ITERATIONS) {
    const parsed = parseInt(process.env.RTF_MAX_ITERATIONS, 10);
    if (!isNaN(parsed)) {
      config.maxIterations = parsed;
    }
  }

  if (process.env.RTF_TASKS_FILE) {
    config.tasksFile = process.env.RTF_TASKS_FILE;
  }

  if (process.env.RTF_CONFIG_FILE) {
    config.configFile = process.env.RTF_CONFIG_FILE;
  }

  if (process.env.RTF_CLAUDE_COMMAND) {
    config.claudeCommand = process.env.RTF_CLAUDE_COMMAND;
  }

  if (process.env.RTF_SKIP_PERMISSIONS) {
    const val = process.env.RTF_SKIP_PERMISSIONS.toLowerCase();
    config.skipPermissions = val === "true" || val === "1" || val === "yes";
  }

  return config;
}

/**
 * Normalizes CLI arguments to config object
 * @param {object} cliArgs - Parsed CLI arguments
 * @returns {object} Configuration object from CLI arguments
 */
function cliArgsToConfig(cliArgs) {
  const config = {};

  if (cliArgs.model !== undefined && cliArgs.model !== null) {
    config.model = cliArgs.model;
  }

  if (cliArgs.maxIterations !== undefined && cliArgs.maxIterations !== null) {
    const parsed = parseInt(cliArgs.maxIterations, 10);
    if (!isNaN(parsed)) {
      config.maxIterations = parsed;
    }
  }

  if (cliArgs.tasks !== undefined && cliArgs.tasks !== null) {
    config.tasksFile = cliArgs.tasks;
  }

  if (cliArgs.config !== undefined && cliArgs.config !== null) {
    config.configFile = cliArgs.config;
  }

  if (cliArgs.role !== undefined && cliArgs.role !== null) {
    config.role = cliArgs.role;
  }

  if (cliArgs.skipPermissions !== undefined && cliArgs.skipPermissions !== null) {
    config.skipPermissions = cliArgs.skipPermissions;
  }

  return config;
}

/**
 * Loads and merges configuration from all sources
 * Priority: CLI flags > Env vars > Config file > Defaults
 *
 * @param {object} cliArgs - Parsed command-line arguments
 * @returns {Promise<object>} Merged configuration object
 */
export async function loadConfig(cliArgs = {}) {
  // Start with defaults
  let config = { ...DEFAULT_CONFIG };

  // Determine config file path (could be overridden by env or CLI)
  const envConfig = loadEnvConfig();
  const cliConfig = cliArgsToConfig(cliArgs);

  const configFilePath = cliConfig.configFile || envConfig.configFile || config.configFile;

  // Load and merge config file
  const fileConfig = await loadConfigFile(configFilePath);
  config = { ...config, ...fileConfig };

  // Merge environment variables (overrides config file)
  config = { ...config, ...envConfig };

  // Merge CLI arguments (highest priority)
  config = { ...config, ...cliConfig };

  return config;
}
