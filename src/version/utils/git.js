/**
 * Git utilities for the version management system
 */
import { execSync } from 'child_process';

/**
 * Get previous tag or first commit if no tags exist
 * @returns {string} Previous tag or commit hash
 */
export function getPreviousTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
  } catch {
    // No previous tag found, use the first commit
    return execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf-8' }).trim();
  }
}

/**
 * Get commit log since the specified tag or commit
 * @param {string} since - Tag or commit to start from
 * @param {string} format - Git log format
 * @returns {string} Git log output
 */
export function getCommitLog(since, format = '%s%n%b%n----------') {
  const commitRange = since ? `${since}..HEAD` : '';
  const commitLogFormat = `--pretty=format:${format}`;
  return execSync(`git log ${commitRange} ${commitLogFormat}`, { encoding: 'utf-8' });
}

/**
 * Get upstream version from git remote
 * @returns {string} Upstream version
 */
export function getUpstreamVersion() {
  execSync('git fetch upstream');
  const upstreamVersionMatch = execSync('git show upstream/master:package.json')
    .toString()
    .match(/"version":\s*"([^"]+)"/);

  if (!upstreamVersionMatch || !upstreamVersionMatch[1]) {
    throw new Error('Unable to determine upstream version');
  }

  return upstreamVersionMatch[1];
}

/**
 * Create a git tag
 * @param {string} tagName - Name of the tag
 */
export function createGitTag(tagName) {
  execSync(`git tag ${tagName}`);
}

/**
 * Push git tags to remote
 */
export function pushGitTags() {
  execSync('git push --tags');
}

/**
 * Check if there are uncommitted changes
 * @returns {boolean} True if there are uncommitted changes
 */
export function hasUncommittedChanges() {
  const output = execSync('git status --porcelain', { encoding: 'utf8' });
  return output.trim().length > 0;
}

/**
 * Commit changes with a message
 * @param {string} message - Commit message
 */
export function commitChanges(message) {
  execSync('git add .');
  execSync(`git commit -m "${message}"`);
}
