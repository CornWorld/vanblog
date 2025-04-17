#!/usr/bin/env node
/**
 * Main entry point for version management
 */
import { parseArgs } from 'node:util';
import { updateVersions } from './updateVersions.js';
import { generateChangelog } from './generateChangelog.js';
import { generateReleaseNotes } from './generateReleaseNotes.js';
import { updateDocs } from './updateDocs.js';
import { createTag } from './createTag.js';
import { checkUpstream } from './checkUpstream.js';
import { logger } from './utils/index.js';

/**
 * Display usage information
 */
function showHelp() {
  console.log(`
Version Management Tool for VanBlog

Usage:
  node src/version/index.js [options] [version]

Options:
  -v, --version <version>  Version to release (e.g., 1.0.0 or 1.0.0-corn.1)
  -t, --type <type>        Release type: 'auto', 'standard', or 'fork' (default: auto)
  --skipUpstream           Skip upstream version check
  --skipDocs               Skip documentation update
  --skipTag                Skip git tag creation
  -h, --help               Show this help message
`);
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse command line arguments
    const { values } = parseArgs({
      options: {
        version: { type: 'string', short: 'v', default: '' },
        type: { type: 'string', short: 't', default: 'auto' }, // auto, standard, fork
        skipUpstream: { type: 'boolean', default: false },
        skipDocs: { type: 'boolean', default: false },
        skipTag: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: true,
    });

    if (values.help) {
      showHelp();
      process.exit(0);
    }

    // Get version from positional argument if provided
    let version = values.version;
    if (!version && process.argv.length > 2 && !process.argv[2].startsWith('-')) {
      version = process.argv[2];
    }

    if (!version) {
      throw new Error('Version argument is required');
    }

    // Handle version format: Allow both v0.54.0-corn.0 and 0.54.0-corn.0 patterns
    if (version.startsWith('v')) {
      version = version.substring(1);
    }

    // Determine release type
    let releaseType = values.type;
    if (releaseType === 'auto') {
      releaseType = version.includes('-corn.') ? 'fork' : 'standard';
    }

    logger.header(`Preparing ${releaseType} release for version ${version}`);

    // Validate version format based on release type
    if (releaseType === 'fork' && !version.includes('-corn.')) {
      throw new Error('Fork version must include "-corn." suffix');
    }

    // 1. Update versions in all package.json files
    await updateVersions(version);

    // 2. For fork releases, check against upstream version
    if (releaseType === 'fork' && !values.skipUpstream) {
      await checkUpstream(version);
    }

    // 3. Generate changelog
    await generateChangelog(version, releaseType);

    // 4. Generate release notes
    await generateReleaseNotes(version, releaseType);

    // 5. Update documentation
    if (!values.skipDocs) {
      await updateDocs(version, releaseType);
    }

    // 6. Create git tag
    if (!values.skipTag) {
      await createTag(version);
    }

    logger.header('Release preparation completed!');
    logger.info(`Next steps for ${releaseType} release v${version}:`);
    logger.info('1. Review the changes in CHANGELOG.md and RELEASE_NOTES.md');
    logger.info('2. Commit any remaining changes if needed');
    logger.info('3. Push the changes to trigger the release workflow');
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

main();
