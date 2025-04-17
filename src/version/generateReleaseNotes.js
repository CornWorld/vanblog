/**
 * Generate release notes based on Git commit history
 */
import {
  changelogPath,
  releaseNotesPath,
  getPreviousTag,
  getCommitLog,
  readTextFile,
  writeTextFile,
  fileExists,
  initCategories,
  parseCommit,
  formatMarkdown,
  formatReleaseNotes,
  logger,
} from './utils/index.js';

/**
 * Parse commits and generate formatted release notes
 * Supports both conventional commits and HadTeam format
 * @param {string} version - The version being released
 * @returns {string} Formatted release notes
 */
async function parseCommits(version) {
  try {
    // Get the previous tag to determine the commit range
    const previousTag = getPreviousTag();

    // Get commits since the previous tag
    const commitLog = getCommitLog(previousTag);

    // Split log into individual commits
    const commits = commitLog
      .split('----------')
      .filter(Boolean)
      .map((c) => c.trim());

    // Initialize categories
    const categories = initCategories();

    // Parse each commit
    for (const commit of commits) {
      parseCommit(commit, categories);
    }

    // Format as markdown
    return formatMarkdown(categories, version);
  } catch (error) {
    logger.error(`Error parsing commits: ${error.message}`);
    return `## [${version}] - ${new Date().toISOString().split('T')[0]}\n\n* Release without detailed changelog\n`;
  }
}

/**
 * Generate release notes based on release type
 * @param {string} version - The version to release
 * @param {string} releaseType - The release type (standard or fork)
 * @returns {Promise<void>}
 */
export async function generateReleaseNotes(version, releaseType) {
  logger.step('Creating release notes...');

  try {
    // Generate release notes by parsing git commits
    const changelogContent = await parseCommits(version);

    // Write to CHANGELOG.md if it doesn't exist or update it
    let fullChangelog = '';

    if (fileExists(changelogPath)) {
      // Read existing changelog and prepend the new content
      const existingChangelog = readTextFile(changelogPath);
      if (existingChangelog.startsWith('# Changelog')) {
        // Prepend after the title
        fullChangelog = existingChangelog.replace(
          '# Changelog\n',
          `# Changelog\n\n${changelogContent}`,
        );
      } else {
        fullChangelog = `# Changelog\n\n${changelogContent}${existingChangelog}`;
      }
    } else {
      // Create new changelog
      fullChangelog = `# Changelog\n\n${changelogContent}`;
    }

    // Write updated changelog
    writeTextFile(changelogPath, fullChangelog);
    logger.success('Updated CHANGELOG.md');

    // Generate RELEASE_NOTES.md
    const releaseNotes = formatReleaseNotes(changelogContent, version, releaseType);

    // Write release notes
    writeTextFile(releaseNotesPath, releaseNotes);
    logger.success('Release notes generated');
  } catch (error) {
    logger.error(`Failed to generate release notes: ${error.message}`);
    throw new Error('Failed to generate release notes');
  }
}
