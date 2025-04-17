/**
 * Utilities for parsing and formatting commits
 */

/**
 * Initialize categories for categorizing commits
 * @returns {Object} Categories object
 */
export function initCategories() {
  return {
    // Conventional commits categories
    feat: { title: 'Features', items: [] },
    fix: { title: 'Bug Fixes', items: [] },
    docs: { title: 'Documentation', items: [] },
    style: { title: 'Styling', items: [] },
    refactor: { title: 'Code Refactoring', items: [] },
    perf: { title: 'Performance Improvements', items: [] },
    test: { title: 'Tests', items: [] },
    build: { title: 'Builds', items: [] },
    ci: { title: 'Continuous Integration', items: [] },
    chore: { title: 'Chores', items: [] },
    revert: { title: 'Reverts', items: [] },

    // HadTeam format categories
    Feat: { title: 'Features', items: [] },
    Fix: { title: 'Bug Fixes', items: [] },
    Style: { title: 'Styling', items: [] },
    Clean: { title: 'Code Cleanup', items: [] },
    Refactor: { title: 'Code Refactoring', items: [] },
    Docs: { title: 'Documentation', items: [] },
    Change: { title: 'Structure Changes', items: [] },
    Chore: { title: 'Chores', items: [] },
    Init: { title: 'Initialization', items: [] },
    Release: { title: 'Releases', items: [] },
    'Pre-release': { title: 'Pre-releases', items: [] },

    // Other
    other: { title: 'Other Changes', items: [] },
  };
}

/**
 * Parse a commit message and categorize it
 * @param {string} commit - Commit message
 * @param {Object} categories - Categories object
 */
export function parseCommit(commit, categories) {
  // Skip merge commits
  if (commit.startsWith('Merge ') || commit.startsWith('merge ')) {
    return;
  }

  // Try to parse as conventional commit
  const conventionalMatch = commit.match(/^(\w+)(?:\(([^)]+)\))?:\s+(.+)$/m);

  // Try to parse as HadTeam format
  const hadTeamMatch = commit.match(/^\[([^\]]+)\]\s+(.+)$/m);

  if (conventionalMatch) {
    // Conventional commit format
    const [, type, scope, message] = conventionalMatch;
    const category = type.toLowerCase();

    if (categories[category]) {
      const formattedMessage = scope ? `**${scope}:** ${message}` : message;
      categories[category].items.push(formattedMessage);
    } else {
      categories.other.items.push(message);
    }
  } else if (hadTeamMatch) {
    // HadTeam format
    const [, type, message] = hadTeamMatch;

    // Handle multiple types separated by &
    const types = type.split('&');
    const primaryType = types[0]; // Consider the first type as primary

    if (categories[primaryType]) {
      categories[primaryType].items.push(message);
    } else {
      categories.other.items.push(message);
    }
  } else {
    // Unknown format, put in other
    const firstLine = commit.split('\n')[0].trim();
    if (firstLine) {
      categories.other.items.push(firstLine);
    }
  }
}

/**
 * Format categories into markdown
 * @param {Object} categories - Categories object
 * @param {string} version - Version number
 * @returns {string} Formatted markdown
 */
export function formatMarkdown(categories, version) {
  // Generate markdown output
  let markdown = `## [${version}] - ${new Date().toISOString().split('T')[0]}\n\n`;

  // Add categories that have items
  Object.values(categories).forEach((category) => {
    if (category.items.length > 0) {
      markdown += `### ${category.title}\n\n`;
      category.items.forEach((item) => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}

/**
 * Format release notes based on release type
 * @param {string} changelogContent - Changelog content
 * @param {string} version - Version number
 * @param {string} releaseType - Release type (standard or fork)
 * @returns {string} Formatted release notes
 */
export function formatReleaseNotes(changelogContent, version, releaseType) {
  return releaseType === 'fork'
    ? `# VanBlog v${version}

## 📝 Changelog
${changelogContent}

## 🔍 Upstream Information
- Based on: mereithhh/vanblog
- Maintainer: CornWorld
- Repository: https://github.com/CornWorld/vanblog

## 📦 Installation
\`\`\`bash
docker pull cornworld/vanblog:v${version}
\`\`\`
`
    : `# VanBlog v${version}

## 📝 Changelog
${changelogContent}
`;
}
