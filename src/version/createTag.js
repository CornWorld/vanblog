/**
 * Create and push a Git tag for the release
 */
import { createGitTag, pushGitTags, logger } from './utils/index.js';

/**
 * Create and push a Git tag for the release
 * @param {string} version - The version to tag
 * @returns {Promise<void>}
 */
export async function createTag(version) {
  const tagName = `v${version}`;

  try {
    logger.step(`Creating git tag: ${tagName}`);

    createGitTag(tagName);
    logger.success(`Created tag: ${tagName}`);

    // Only try to push if requested
    const shouldPush = process.env.AUTO_PUSH_TAGS === 'true';
    if (shouldPush) {
      logger.info('Pushing tags to remote...');
      pushGitTags();
      logger.success('Pushed tags to remote');
    } else {
      logger.info('Tag created but not pushed. Push manually with:');
      logger.info('  git push --tags');
    }
  } catch (error) {
    if (error.message.includes('already exists')) {
      logger.warn(`Tag ${tagName} already exists`);
    } else {
      logger.error(`Failed to create git tag: ${error.message}`);
      throw new Error(`Failed to create git tag: ${error.message}`);
    }
  }
}
