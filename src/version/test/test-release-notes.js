#!/usr/bin/env node
/**
 * Test script for release note generation
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

// Mock the paths and utilities
const mockPaths = {
  testDir: null, // Will be set during test

  // These will be dynamically set based on testDir
  get changelogPath() {
    return path.join(this.testDir, 'CHANGELOG.md');
  },
  get releaseNotesPath() {
    return path.join(this.testDir, 'RELEASE_NOTES.md');
  },
  get docsChangelogPath() {
    return path.join(this.testDir, 'docs/changelog.md');
  },
  get docVersionPath() {
    return path.join(this.testDir, 'doc-version');
  },
  get packageJsonPath() {
    return path.join(this.testDir, 'package.json');
  },

  getPackageJsonPath(packageName) {
    return path.join(this.testDir, 'packages', packageName, 'package.json');
  },
};

// Mock file system utilities
const mockFs = {
  readTextFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  },

  writeTextFile(filePath, data) {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, 'utf8');
  },

  readJsonFile(filePath) {
    return JSON.parse(this.readTextFile(filePath));
  },

  writeJsonFile(filePath, data) {
    this.writeTextFile(filePath, JSON.stringify(data, null, 2) + '\n');
  },

  fileExists(filePath) {
    return fs.existsSync(filePath);
  },
};

// Mock Git utilities
const mockGit = {
  getPreviousTag() {
    // For test, always return a fixed test tag
    return 'test-tag';
  },

  getCommitLog(since, format) {
    // Return actual commit log from the test repo
    return execSync(`git log ${format ? '--pretty=format:' + format : ''}`, {
      encoding: 'utf-8',
      cwd: mockPaths.testDir,
    });
  },
};

// Mock logger
const mockLogger = {
  info(message) {
    console.log(`INFO: ${message}`);
  },
  success(message) {
    console.log(`SUCCESS: ${message}`);
  },
  warn(message) {
    console.log(`WARNING: ${message}`);
  },
  error(message) {
    console.log(`ERROR: ${message}`);
  },
  step(message) {
    console.log(`\nSTEP: ${message}`);
  },
  debug(message) {
    if (process.env.DEBUG) console.log(`DEBUG: ${message}`);
  },
  header(message) {
    console.log(`\n=== ${message} ===`);
  },
};

// Create a mock version of generateReleaseNotes
async function mockGenerateReleaseNotes(version, releaseType) {
  // Import modules that contain the functions we need
  const { initCategories, parseCommit, formatMarkdown, formatReleaseNotes } = await import(
    '../utils/commits.js'
  );

  mockLogger.step('Creating release notes...');

  try {
    // Get commits from test repo
    const commitLog = mockGit.getCommitLog(null, '%s%n%b%n----------');

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
    const changelogContent = formatMarkdown(categories, version);

    // Create/update changelog file
    let fullChangelog = '';

    if (mockFs.fileExists(mockPaths.changelogPath)) {
      // Read existing changelog and prepend the new content
      const existingChangelog = mockFs.readTextFile(mockPaths.changelogPath);
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
    mockFs.writeTextFile(mockPaths.changelogPath, fullChangelog);
    mockLogger.success('Updated CHANGELOG.md');

    // Generate RELEASE_NOTES.md
    const releaseNotes = formatReleaseNotes(changelogContent, version, releaseType);

    // Write release notes
    mockFs.writeTextFile(mockPaths.releaseNotesPath, releaseNotes);
    mockLogger.success('Release notes generated');

    return { changelogContent, releaseNotes };
  } catch (error) {
    mockLogger.error(`Failed to generate release notes: ${error.message}`);
    throw new Error('Failed to generate release notes');
  }
}

/**
 * Create a temporary test repository
 * @returns {string} Path to the test repository
 */
async function createTestRepo() {
  const testDir = path.join(rootDir, 'test-release-notes');

  // Clean up previous test directory if it exists
  if (fs.existsSync(testDir)) {
    console.log('Cleaning up previous test directory...');
    execSync(`rm -rf ${testDir}`);
  }

  // Create test directory and initialize git
  console.log('Creating test repository...');
  fs.mkdirSync(testDir, { recursive: true });

  // Set the test directory for our mocks
  mockPaths.testDir = testDir;

  // Initialize git repository
  execSync('git init', { cwd: testDir });
  execSync('git config --local user.name "Test User"', { cwd: testDir });
  execSync('git config --local user.email "test@example.com"', { cwd: testDir });

  // Create initial commit
  fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Repository');
  execSync('git add README.md', { cwd: testDir });
  execSync('git commit -m "Initial commit"', { cwd: testDir });

  // Create conventional commits
  fs.writeFileSync(path.join(testDir, 'conventional.txt'), 'Conventional commit test');
  execSync('git add conventional.txt', { cwd: testDir });
  execSync('git commit -m "feat: add conventional feature"', { cwd: testDir });

  fs.writeFileSync(path.join(testDir, 'conventional2.txt'), 'Another conventional commit');
  execSync('git add conventional2.txt', { cwd: testDir });
  execSync('git commit -m "fix(auth): fix login issue"', { cwd: testDir });

  // Create HadTeam format commits
  fs.writeFileSync(path.join(testDir, 'hadteam.txt'), 'HadTeam format test');
  execSync('git add hadteam.txt', { cwd: testDir });
  execSync('git commit -m "[Feat] Add HadTeam feature"', { cwd: testDir });

  fs.writeFileSync(path.join(testDir, 'hadteam2.txt'), 'Another HadTeam format test');
  execSync('git add hadteam2.txt', { cwd: testDir });
  execSync('git commit -m "[Fix] Correct an issue"', { cwd: testDir });

  // Combined formats
  fs.writeFileSync(path.join(testDir, 'combined.txt'), 'Combined formats test');
  execSync('git add combined.txt', { cwd: testDir });
  execSync('git commit -m "[Feat&Refactor] Add feature and refactor code"', { cwd: testDir });

  console.log('Test repository created with sample commits');
  return testDir;
}

/**
 * Main function to test release note generation
 */
async function testReleaseNotes() {
  try {
    console.log('=== Testing release note generation ===');

    // Create test repository
    await createTestRepo();

    // Test for standard release
    console.log('\nTesting standard release note generation:');
    await mockGenerateReleaseNotes('1.0.0', 'standard');

    console.log('\nGenerated CHANGELOG.md:');
    console.log('------------------------');
    console.log(fs.readFileSync(mockPaths.changelogPath, 'utf-8'));

    console.log('\nGenerated RELEASE_NOTES.md:');
    console.log('----------------------------');
    console.log(fs.readFileSync(mockPaths.releaseNotesPath, 'utf-8'));

    // Test for fork release
    console.log('\nTesting fork release note generation:');
    await mockGenerateReleaseNotes('1.0.0-corn.1', 'fork');

    console.log('\nGenerated fork RELEASE_NOTES.md:');
    console.log('--------------------------------');
    console.log(fs.readFileSync(mockPaths.releaseNotesPath, 'utf-8'));

    // Clean up
    console.log('\nCleaning up test repository...');
    execSync(`rm -rf ${mockPaths.testDir}`);

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testReleaseNotes();
