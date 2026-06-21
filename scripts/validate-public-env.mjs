import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const appRoot = path.resolve(import.meta.dirname, '..');
const envFiles = [
  '.env.production.local',
  '.env.production',
  '.env.local',
  '.env',
];

const env = { ...process.env };

for (const fileName of envFiles) {
  const filePath = path.join(appRoot, fileName);
  if (!fs.existsSync(filePath)) continue;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!env[key]) env[key] = value;
  }
}

const requiredKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingKeys = requiredKeys.filter((key) => !env[key]?.trim());

if (missingKeys.length > 0) {
  console.error(
    `Missing required FlowTranslate production env: ${missingKeys.join(', ')}.`,
  );
  console.error(
    'Set them in the shell or apps/flowtranslate/.env.production before deploying.',
  );
  process.exit(1);
}

console.log('FlowTranslate public production env is present.');
