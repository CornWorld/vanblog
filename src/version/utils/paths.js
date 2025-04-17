/**
 * Common path utilities for the version management system
 */
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root directory of the project
export const rootDir = path.resolve(__dirname, '../../..');

// Paths to common files
export const packageJsonPath = path.join(rootDir, 'package.json');
export const changelogPath = path.join(rootDir, 'CHANGELOG.md');
export const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
export const docsChangelogPath = path.join(rootDir, 'docs/changelog.md');
export const docVersionPath = path.join(rootDir, 'doc-version');

/**
 * Get path to a package.json file in a packages directory
 * @param {string} packageName - Name of the package
 * @returns {string} Full path to the package.json file
 */
export function getPackageJsonPath(packageName) {
  return path.join(rootDir, 'packages', packageName, 'package.json');
}
