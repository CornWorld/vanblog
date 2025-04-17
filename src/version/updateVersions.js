/**
 * Update versions in all package.json files
 */
import {
  packageJsonPath,
  getPackageJsonPath,
  readJsonFile,
  writeJsonFile,
  fileExists,
  logger,
} from './utils/index.js';

/**
 * Update versions in all package.json files
 * @param {string} version - The new version to set
 * @returns {Promise<void>}
 */
export async function updateVersions(version) {
  logger.step(`Updating version to ${version}...`);

  // Update root package.json
  const packageJson = readJsonFile(packageJsonPath);
  packageJson.version = version;
  writeJsonFile(packageJsonPath, packageJson);
  logger.success(`Updated root package.json to version ${version}`);

  // Update all subpackages
  const packages = ['admin', 'server', 'website', 'cli', 'waline'];

  logger.info(`Updating all package versions to ${version}`);
  packages.forEach((pkg) => {
    const pkgPath = getPackageJsonPath(pkg);
    if (fileExists(pkgPath)) {
      const pkgJson = readJsonFile(pkgPath);
      pkgJson.version = version;
      writeJsonFile(pkgPath, pkgJson);
      logger.success(`Updated ${pkg}`);
    }
  });
}
