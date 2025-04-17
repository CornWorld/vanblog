import { execSync } from 'child_process';
import { changelogPath, fileExists, writeTextFile, logger } from './utils/index.js';

/**
 * Generate changelog based on release type
 * @param {string} version - The version to release
 * @param {string} releaseType - The release type (standard or fork)
 * @returns {Promise<void>}
 */
export async function generateChangelog(version, releaseType) {
  logger.step('Generating changelog...');

  if (releaseType === 'standard') {
    // For standard releases, use standard-version
    try {
      // Determine type of release (major, minor, patch) based on version change
      // Default to patch
      let releaseAs = 'patch';

      // Try to extract from current version
      try {
        const currentVersion = execSync('npm pkg get version').toString().replace(/"/g, '').trim();
        const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
        const [newMajor, newMinor] = version.split('.').map(Number);

        if (newMajor > currentMajor) {
          releaseAs = 'major';
        } else if (newMinor > currentMinor) {
          releaseAs = 'minor';
        }
      } catch {
        logger.warn('Unable to determine release type, using patch as default');
      }

      logger.info(`Running standard-version with ${releaseAs} release...`);
      execSync(`pnpm release-${releaseAs}`, { stdio: 'inherit' });
      logger.success('Generated standard changelog');
    } catch {
      logger.error('Failed to generate standard changelog');
      throw new Error('Failed to generate standard changelog');
    }
  } else {
    // For fork releases, just ensure CHANGELOG.md exists and is up to date
    // We don't want to automatically generate it as it might overwrite custom changes
    try {
      if (!fileExists(changelogPath)) {
        logger.info('No CHANGELOG.md found, creating a new one...');
        const initialChangelog = `# Changelog\n\n## [${version}] - ${new Date().toISOString().split('T')[0]}\n\n* Fork release\n`;
        writeTextFile(changelogPath, initialChangelog);
      }
      logger.success('Ensured CHANGELOG.md exists for fork release');
    } catch {
      logger.warn('Unable to check or create CHANGELOG.md');
    }
  }
}
