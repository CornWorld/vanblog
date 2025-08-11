import path from 'path';
// for server-ng, only run tsc when *.ts *.tsx staged
export default {
  '*.{ts,tsx,js,jsx}': (api) => {
    const hasTsFile = api.filenames.some(
      (file) => path.extname(file) === '.ts' || path.extname(file) === '.tsx',
    );
    const filesStr = api.filenames.join(' ');

    const commands = [`pnpm run format --write`, `pnpm run lint --fix`].map(
      (i) => i.trimEnd() + ' ' + filesStr,
    );
    if (hasTsFile) {
      commands.push('tsc --noEmit');
    }
    return commands.map((cmd) => `sh -c "cd packages/server-ng && ${cmd}"`);
  },
};
