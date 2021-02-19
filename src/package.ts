import fs from 'fs';
import path from 'path';

function loadPackageJson() {
  const packageJSONPath = path.join(__dirname, '../package.json');
  return JSON.parse(fs.readFileSync(packageJSONPath, { encoding: 'utf8' }));
}

export function getBugsUrl(): string {
  return loadPackageJson().bugs.url;
}