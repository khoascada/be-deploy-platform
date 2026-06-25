const { spawnSync } = require('node:child_process');

const [, , nodeEnv, command, ...args] = process.argv;

if (!nodeEnv || !command) {
  console.error(
    'Usage: node scripts/with-node-env.cjs <development|production|test> <command> [...args]',
  );
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: nodeEnv,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
