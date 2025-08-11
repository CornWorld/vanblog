import path from 'path';
// for server-ng, only run tsc when *.ts *.tsx staged
export default {
  '*.{ts,tsx,js,jsx}': (api) => {
    const hasTsFile = api.filenames.some(
      (file) => path.extname(file) === '.ts' || path.extname(file) === '.tsx',
    );
    const filesStr = api.filenames.join(' ');

    return [
      `pnpm run lint --fix ${filesStr}`,
      `pnpm run format --write ${filesStr}`,
      hasTsFile ? 'tsc --noEmit' : '',
    ].map((i) => 'cd packages/server-ng ' + i);
  },
};
