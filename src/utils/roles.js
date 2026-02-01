// Role loading utility
// Maps role names to role files with case-insensitive matching

import manageRole from '../roles/manage.js';
import planRole from '../roles/plan.js';
import codeRole from '../roles/code.js';
import documentRole from '../roles/document.js';

// Valid role names (all lowercase for comparison)
const VALID_ROLES = ['manage', 'plan', 'code', 'document'];

// Map of role names to role prompts
const ROLE_MAP = {
  manage: manageRole,
  plan: planRole,
  code: codeRole,
  document: documentRole,
};

/**
 * Load a role meta-prompt by name (case-insensitive)
 *
 * @param {string} roleName - The role name (e.g., "manage", "PLAN", "Code", etc.)
 * @returns {string} The role meta-prompt string
 * @throws {Error} If role name is invalid or not found
 */
export function loadRole(roleName) {
  // Validate input
  if (!roleName || typeof roleName !== 'string') {
    throw new Error(`Invalid role name: ${roleName}. Role name must be a non-empty string.`);
  }

  // Normalize to lowercase for case-insensitive matching
  const normalizedRole = roleName.toLowerCase().trim();

  // Check if role exists
  if (!VALID_ROLES.includes(normalizedRole)) {
    throw new Error(
      `Error: Unknown role '${roleName}'. Available roles: ${VALID_ROLES.join(', ')}`
    );
  }

  // Return the role prompt
  return ROLE_MAP[normalizedRole];
}
