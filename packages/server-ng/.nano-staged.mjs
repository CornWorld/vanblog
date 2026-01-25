import path from 'path';
// for server-ng, only run tsc when *.ts *.tsx staged
export default {
  '*.{ts,tsx,js,jsx}': (api) => {
    // Only consider files under packages/server-ng
    const serverNgFiles = api.filenames.filter((file) => file.startsWith('packages/server-ng/'));
    if (serverNgFiles.length === 0) {
      return [];
    }

    const hasTsFile = serverNgFiles.some(
      (file) => path.extname(file) === '.ts' || path.extname(file) === '.tsx',
    );

    // Convert to paths relative to packages/server-ng for better tooling behavior
    const relFiles = serverNgFiles.map((f) => f.replace(/^packages\/server-ng\//, ''));
    const filesStr = relFiles.join(' ');

    const commands = [`pnpm run format --write`, `pnpm run lint --fix`].map(
      (i) => i.trimEnd() + ' ' + filesStr,
    );
    if (hasTsFile) {
      commands.push('tsc --noEmit');
    }
    return commands.map((cmd) => `sh -c "cd packages/server-ng && ${cmd}"`);
  },
};
