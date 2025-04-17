import {
  changelogPath,
  docsChangelogPath,
  docVersionPath,
  readTextFile,
  writeTextFile,
  fileExists,
  hasUncommittedChanges,
  commitChanges,
  logger,
} from './utils/index.js';
import { spawnSync } from 'child_process';

/**
 * Update documentation with the new version
 * @param {string} version - The version to release
 * @param {string} releaseType - The release type (standard or fork)
 * @returns {Promise<void>}
 */
export async function updateDocs(version, releaseType) {
  logger.step('Updating documentation...');

  // Read the changelog
  const log = readTextFile(changelogPath);

  // Format for documentation
  const newLog =
    `\
---
title: 更新日志
icon: clock
order: 8
redirectFrom: /ref/changelog.html
---
` + log.replace('# Changelog', '');

  // Write to docs/changelog.md
  writeTextFile(docsChangelogPath, newLog);
  logger.success('Updated docs/changelog.md');

  // Update doc-version file
  if (fileExists(docVersionPath)) {
    let docVersion = readTextFile(docVersionPath);
    docVersion = docVersion.split('\n')[0].trim();
    const arr = docVersion.split('.');
    const sub = arr.pop();
    arr.push(String(parseInt(sub) + 1));
    const newVersion = arr.join('.');
    writeTextFile(docVersionPath, newVersion);
    logger.success(`Updated doc-version to ${newVersion}`);
  } else {
    logger.info('No doc-version file found, skipping update.');
  }

  // Prepare commit message based on release type
  const commitMessage =
    releaseType === 'fork' ? 'docs: 更新文档 (CornWorld fork)' : 'docs: 更新文档';

  try {
    // Only commit if there are changes
    if (hasUncommittedChanges()) {
      logger.info('Committing documentation changes...');

      // Execute git commands
      commitChanges(commitMessage);

      // Only create doc tag if doc-version exists
      if (fileExists(docVersionPath)) {
        const docVersion = readTextFile(docVersionPath).trim();
        spawnSync('git', ['tag', `doc-${docVersion}`], { stdio: 'inherit' });
        logger.success(`Created documentation tag: doc-${docVersion}`);
      }

      logger.success('Documentation changes committed');
    } else {
      logger.info('No documentation changes to commit');
    }
  } catch (error) {
    logger.warn('Unable to commit documentation changes');
    logger.warn(error.message);
  }
}
