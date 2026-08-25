#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

function usage() {
  console.error('usage: node scripts/build/pack-schema-build.mjs <pack-directory> [output-file]');
}

const [, , packDirectoryArg, outputArg] = process.argv;
if (!packDirectoryArg) {
  usage();
  process.exit(2);
}

const packDirectory = resolve(packDirectoryArg);
const schemaEntry = join(packDirectory, 'schema.ts');
const outputFile = outputArg ? resolve(outputArg) : join(packDirectory, 'schema.js');

if (!existsSync(packDirectory) || !statSync(packDirectory).isDirectory()) {
  console.error(`pack schema build: pack directory does not exist: ${packDirectory}`);
  process.exit(1);
}

if (!existsSync(schemaEntry)) {
  console.log(`pack schema build: no schema.ts found in ${packDirectory}; nothing to build`);
  process.exit(0);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '../..');
const tempDirectory = mkdtempSync(join(tmpdir(), 'vanblog-pack-schema-'));
const tempOutput = join(tempDirectory, 'schema.js');

try {
  await build({
    configFile: false,
    root: repoRoot,
    logLevel: 'warn',
    build: {
      outDir: tempDirectory,
      emptyOutDir: true,
      lib: {
        entry: schemaEntry,
        formats: ['cjs'],
        fileName: () => 'schema.js',
      },
      rollupOptions: {
        external: [],
      },
      minify: false,
      target: 'es2020',
    },
  });

  if (!existsSync(tempOutput)) {
    throw new Error(`builder did not produce ${tempOutput}`);
  }
  const outputSource = readFileSync(tempOutput, 'utf8');
  if (!outputSource.includes('exports.models')) {
    throw new Error('built schema artifact must expose exports.models');
  }
  // Note: for stronger validation, the Go-side pack build command runs
  // validation.ValidateModelSource after this script completes. When invoked
  // standalone (e.g. Dockerfile), only this substring check guards the artifact.

  try {
    renameSync(tempOutput, outputFile);
  } catch (e) {
    if (e.code === 'EXDEV') {
      const { copyFileSync, unlinkSync } = await import('node:fs');
      copyFileSync(tempOutput, outputFile);
      unlinkSync(tempOutput);
    } else {
      throw e;
    }
  }
  console.log(`pack schema build: wrote ${outputFile}`);
} catch (error) {
  console.error(`pack schema build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
