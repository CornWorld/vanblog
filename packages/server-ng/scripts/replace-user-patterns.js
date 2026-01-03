#!/usr/bin/env node

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node replace-user-patterns.js <file-path>');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Pattern 1: Replace simple user objects with createMockUser
const userObjectPattern =
  /\{\s*id:\s*(\d+),\s*username:\s*['"](\w+)['"](,\s*email:\s*['"][^'"]*['"])?(,\s*nickname:\s*['"][^'"]*['"])?(,\s*avatar:\s*null)?(,\s*type:\s*['"](\w+)['"](,\s*permissions:\s*(\[.*?\]))?)?.*password:\s*['"][^'"]*['"].*createdAt:.*updatedAt:.*\}/gs;

// Count replacements
let count = 0;

// Replace pattern with createMockUser calls
content = content.replace(userObjectPattern, (match) => {
  count++;
  // Extract values from match
  const idMatch = match.match(/id:\s*(\d+)/);
  const usernameMatch = match.match(/username:\s*['"](\w+)['"]/);
  const emailMatch = match.match(/email:\s*['"]([^'"]*)['"]/);
  const nicknameMatch = match.match(/nickname:\s*['"]([^'"]*)['"]/);
  const typeMatch = match.match(/type:\s*['"](\w+)['"]/);
  const permissionsMatch = match.match(/permissions:\s*(\[.*?\])/);

  const overrides = [];
  if (idMatch && idMatch[1] !== '1') overrides.push(`id: ${idMatch[1]}`);
  if (usernameMatch && usernameMatch[1] !== 'testuser')
    overrides.push(`username: '${usernameMatch[1]}'`);
  if (emailMatch && emailMatch[1]) overrides.push(`email: '${emailMatch[1]}'`);
  if (nicknameMatch && nicknameMatch[1]) overrides.push(`nickname: '${nicknameMatch[1]}'`);
  if (typeMatch && typeMatch[1] !== 'admin') overrides.push(`type: '${typeMatch[1]}'`);
  if (permissionsMatch) overrides.push(`permissions: ${permissionsMatch[1]}`);

  if (overrides.length === 0) {
    return 'createMockUser()';
  } else {
    return `createMockUser({\n        ${overrides.join(',\n        ')},\n      })`;
  }
});

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Replaced ${count} user data patterns`);
