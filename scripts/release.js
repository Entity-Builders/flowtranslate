import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';

const args = process.argv.slice(2);
const releaseType = args[0]; // patch, minor, major
const isDryRun = args.includes('--dry-run');

if (!['patch', 'minor', 'major'].includes(releaseType)) {
  console.error(
    'Usage: node scripts/release.js <patch|minor|major> [--dry-run]',
  );
  process.exit(1);
}

function run(command) {
  console.log(`\n> ${command}`);
  if (isDryRun) {
    console.log('[Dry Run] Command would execute here.');
    return;
  }
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log(
    `Starting ${releaseType} release...${isDryRun ? ' (DRY RUN)' : ''}`,
  );

  // 1. Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain').toString();
    if (status) {
      if (isDryRun) {
        console.warn(
          '[Dry Run] Git working directory is dirty, but proceeding...',
        );
      } else {
        console.error(
          'Error: Git working directory is not clean. Please commit or stash changes.',
        );
        process.exit(1);
      }
    }
  } catch (e) {
    // Ignore error in dry run if git is not initialized (unlikely)
  }

  // 2. Check branch
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim();
    if (branch !== 'main' && branch !== 'master') {
      console.warn(
        `Warning: You are on branch '${branch}'. Releases are typically done from 'main'.`,
      );
      // Ask for confirmation or just proceed with warning? strict mode:
      // process.exit(1);
    }
  } catch (e) {
    console.error('Error checking branch:', e);
    process.exit(1);
  }

  // 3. Bump version (without auto-commit so we can include lock files)
  run(`npm version ${releaseType} --no-git-tag-version`);

  // 4. Read the new version for the commit message and tag
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  );
  const newVersion = pkg.version;
  console.log(`\nNew version: ${newVersion}`);

  // 5. Stage all version-affected files (package.json + root lock files)
  run('git add package.json');
  run('git add ../../package-lock.json ../../yarn.lock || true');

  // 6. Commit and tag
  run(`git commit -m "chore(release): v${newVersion}"`);
  run(`git tag v${newVersion}`);

  // 7. Push changes and tags
  run('git push');
  run('git push --tags');

  console.log(
    '\n✅ Tag pushed! GitHub Actions will build and publish for macOS + Windows automatically.',
  );
  console.log(
    '   Check progress at: https://github.com/juanobrach/entity-builders/actions',
  );
}

main();
