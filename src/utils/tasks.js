// TASKS.md file reader and parser utilities

/**
 * Read a TASKS.md file and return its contents as a string
 *
 * @param {string} filePath - Path to the tasks file
 * @returns {Promise<string>} The file contents
 * @throws {Error} If file path is invalid or file cannot be read
 */
export async function readTasksFile(filePath) {
  // Validate input
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error(`Invalid file path: ${filePath}. Path must be a non-empty string.`);
  }

  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
      throw new Error(`Task file not found: ${filePath}`);
    }

    const content = await file.text();
    return content;
  } catch (error) {
    // Re-throw with more context if it's not already our error
    if (error.message.startsWith('Invalid file path') || error.message.startsWith('Task file not found')) {
      throw error;
    }
    throw new Error(`Failed to read task file ${filePath}: ${error.message}`);
  }
}

/**
 * Parse TASKS.md content and extract task items
 *
 * @param {string} content - The raw markdown content
 * @returns {Array<{completed: boolean, description: string}>} Array of parsed tasks
 */
export function parseTasksFile(content) {
  // Handle null/undefined
  if (!content) {
    return [];
  }

  const tasks = [];
  const lines = content.split('\n');

  // Regex to match markdown checkboxes: - [ ] or - [x]
  // Supports indentation (spaces or tabs)
  const checkboxRegex = /^\s*-\s*\[([ xX])\]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(checkboxRegex);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      const description = match[2].trim();
      tasks.push({ completed, description });
    }
  }

  return tasks;
}

/**
 * Extract TASKS.md content from a response containing delimiters
 *
 * @param {string} response - The full response text
 * @returns {string|null} Extracted content or null if delimiters not found
 */
export function extractTasksContent(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const beginDelimiter = '---BEGIN TASKS.MD---';
  const endDelimiter = '---END TASKS.MD---';

  const beginIndex = response.indexOf(beginDelimiter);
  const endIndex = response.indexOf(endDelimiter);

  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    return null;
  }

  const content = response.slice(beginIndex + beginDelimiter.length, endIndex).trim();
  return content;
}

/**
 * Write content to a TASKS.md file
 *
 * @param {string} filePath - Path to the tasks file
 * @param {string} content - Content to write
 * @throws {Error} If file path is invalid or write fails
 */
export async function writeTasksFile(filePath, content) {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error(`Invalid file path: ${filePath}. Path must be a non-empty string.`);
  }

  if (content === null || content === undefined) {
    throw new Error('Content cannot be null or undefined');
  }

  try {
    await Bun.write(filePath, content);
  } catch (error) {
    throw new Error(`Failed to write task file ${filePath}: ${error.message}`);
  }
}
