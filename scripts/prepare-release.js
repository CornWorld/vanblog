import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Error: Version argument is required');
  process.exit(1);
}

// Handle version format: Allow both v0.54.0-corn.0 and 0.54.0-corn.0 patterns
let currentVersion = args[0];
if (currentVersion.startsWith('v')) {
  currentVersion = currentVersion.substring(1);
}

// Update version in package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.version = currentVersion;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');

// Check version format, for Corn's release only // TODO
if (!currentVersion.includes('-corn.')) {
  console.error('Error: Version must include "-corn." suffix');
  process.exit(1);
}

// Get upstream version
try {
  execSync('git fetch upstream');
  const upstreamVersion = execSync('git show upstream/master:package.json')
    .toString()
    .match(/"version":\s*"([^"]+)"/)[1];

  // Check if version is based on upstream
  const baseVersion = currentVersion.split('-')[0];
  if (baseVersion !== upstreamVersion) {
    console.warn(
      `Warning: Current version ${currentVersion} is not based on upstream version ${upstreamVersion}`,
    );
    console.warn('Suggested format: [upstream-version]-corn.[increment]');
  }
} catch {
  console.warn('Warning: Unable to check upstream version');
}

// Generate changelog
console.log('Generating changelog...');
execSync('pnpm release-note');

// Update version in all packages
const packages = ['admin', 'server', 'website', 'cli', 'waline'].map((pkg) =>
  path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'packages', pkg, 'package.json'),
);

console.log(`Updating all package versions to ${currentVersion}`);
packages.forEach((pkgPath) => {
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = currentVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ Updated ${path.basename(path.dirname(pkgPath))}`);
  }
});

// Generate release notes
console.log('Creating release notes...');
// Check if RELEASE_NOTES.md exists, otherwise generate it from CHANGELOG.md
if (!fs.existsSync('RELEASE_NOTES.md')) {
  console.log('Generating RELEASE_NOTES.md from CHANGELOG.md...');
  execSync('node scripts/releaseNote.js');
}

if (fs.existsSync('RELEASE_NOTES.md')) {
  const releaseNotes = fs.readFileSync('RELEASE_NOTES.md', 'utf8');

  const finalReleaseNotes = `# VanBlog v${currentVersion}

## 📝 Changelog
${releaseNotes}

## 🔍 Upstream Information
- Based on: mereithhh/vanblog
- Maintainer: CornWorld
- Repository: https://github.com/CornWorld/vanblog

## 📦 Installation
\`\`\`bash
docker pull cornworld/vanblog:v${currentVersion}
\`\`\`
`;

  fs.writeFileSync('RELEASE_NOTES.md', finalReleaseNotes);
  console.log('✓ Release notes generated');
}

console.log('✨ Release preparation completed!');
