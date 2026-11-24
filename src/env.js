// Loads abu's own .env (project root, git-ignored; see .env.example) into
// process.env. Variables already set in the shell win over the file.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENV_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

/** @returns {boolean} whether a .env file was found and loaded */
export function loadEnvFile(file = ENV_FILE) {
  try {
    process.loadEnvFile(file);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}
