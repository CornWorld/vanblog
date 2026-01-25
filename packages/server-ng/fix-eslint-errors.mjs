#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = await glob('src/**/*.spec.ts');

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // Fix template literal errors - wrap numbers in String()
  const templateLiteralMatches = content.matchAll(/\$\{([^}]+\.(length|status|code|port))\}/g);
  for (const match of Array.from(templateLiteralMatches)) {
    const original = match[0];
    const expression = match[1];
    if (!expression.includes('String(') && !expression.includes('`.`')) {
      const replacement = `\${String(${expression})}`;
      content = content.replace(original, replacement);
      modified = true;
    }
  }

  // Fix unused variables - add underscore prefix
  const unusedVarMatches = content.matchAll(/^(\s+)const\s+([a-zA-Z0-9]+)\s*=/gm);
  for (const match of Array.from(unusedVarMatches)) {
    const indent = match[1];
    const varName = match[2];
    // Only if it looks like an error or unused mock
    if (varName.includes('Error') || varName.includes('Spy') || varName === 'result') {
      const original = `${indent}const ${varName} =`;
      const replacement = `${indent}const _${varName} =`;
      content = content.replace(original, replacement);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8');
    console.log(`Fixed: ${file}`);
  }
}

console.log('Batch fix completed!');
