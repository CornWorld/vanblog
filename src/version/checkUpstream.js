/**
 * Check if fork version is based on upstream version
 */
import { getUpstreamVersion, logger } from './utils/index.js';

/**
 * Check if fork version is based on upstream version
 * @param {string} version - The current version
 * @returns {Promise<void>}
 */
export async function checkUpstream(version) {
  try {
    logger.step('Checking against upstream version...');

    const upstreamVersion = getUpstreamVersion();

    // Check if version is based on upstream
    const baseVersion = version.split('-')[0];
    if (baseVersion !== upstreamVersion) {
      logger.warn(`Current version ${version} is not based on upstream version ${upstreamVersion}`);
      logger.warn('Suggested format: [upstream-version]-corn.[increment]');
    } else {
      logger.success(
        `Version ${version} is correctly based on upstream version ${upstreamVersion}`,
      );
    }
  } catch (error) {
    logger.warn('Unable to check upstream version');
    logger.warn(error.message);
  }
}
