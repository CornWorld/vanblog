# VanBlog v0.54.0-corn.6

## 📝 Changelog

## [0.54.0-corn.6] - 2025-05-03

### Bug Fixes

- Keep full translations and add theme mode i18n keys

### Features

- Add trans key for all the tsx files and fix lint errors
- Migrate most of text that can be found to i18next
- Refactor version-relative code providing a clear CLI

### Bug Fixes

- Fix translation keys
- Fix react hooks lint
- Refactor editor of admin package
- Cannot use hooks in hooks
- Use `react-i18next`
- Fix theme
- Use a route handler
- Fix build
- Fix the logic of theme button in website package

### Code Refactoring

- Make editor component's structure better
- Use React context to control theme
- Remove umi compact code

### Chores

- Add `next-i18next`

### Other Changes

- From branch 'feat/i18n'
- cd packages/website && DOCKER_BUILD=true pnpm build

## 🔍 Upstream Information

- Based on: mereithhh/vanblog
- Maintainer: CornWorld
- Repository: https://github.com/CornWorld/vanblog

## 📦 Installation

```bash
docker pull cornworld/vanblog:v0.54.0-corn.6
```
