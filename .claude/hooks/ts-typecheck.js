// PostToolUse hook: run tsc after editing TypeScript files
const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const tool = JSON.parse(input);
    const filePath = tool.file_path || '';
    if (!/\.(ts|tsx)$/.test(filePath)) return;

    const webRoot = path.resolve(__dirname, '../../apps/web');
    try {
      execSync('npx tsc --noEmit', { cwd: webRoot, stdio: 'inherit' });
    } catch (_) {
      // tsc exits non-zero on errors — output already printed to stderr
    }
  } catch (_) {}
});
