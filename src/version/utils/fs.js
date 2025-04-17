/**
 * Filesystem utilities for the version management system
 */
import fs from 'fs';

/**
 * Read JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} Parsed JSON object
 */
export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Write JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {Object} data - Data to write
 */
export function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Read text file
 * @param {string} filePath - Path to the text file
 * @returns {string} File contents
 */
export function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Write text file
 * @param {string} filePath - Path to the text file
 * @param {string} data - Data to write
 */
export function writeTextFile(filePath, data) {
  fs.writeFileSync(filePath, data, 'utf8');
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
