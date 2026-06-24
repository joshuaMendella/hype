// PreToolUse hook: block any edits to .env files
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const tool = JSON.parse(input);
    const path = tool.file_path || tool.path || '';
    if (path.includes('.env')) {
      process.stderr.write('BLOCKED: .env files are protected — add secrets manually.\n');
      process.exit(2);
    }
  } catch (_) {}
});
