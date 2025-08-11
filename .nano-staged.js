export default {
  '*.{ts,tsx}': ['pnpm lint --fix', 'prettier --write'],
  '*.{js,jsx}': ['pnpm lint --fix', 'prettier --write'],
  '*.{json,css,less,scss,md}': ['prettier --write'],
};
