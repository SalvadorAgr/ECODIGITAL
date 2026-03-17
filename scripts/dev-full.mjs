import { spawn } from 'node:child_process';

let shuttingDown = false;
const children = [];

function run(label, cmd, args) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  child.on('exit', code => {
    if (!shuttingDown) {
      shuttingDown = true;
      shutdown('SIGTERM');
    }
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });

  return child;
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

children.push(
  run('server', 'yarn', ['affine', 'server', 'dev']),
  run('web', 'yarn', ['affine', 'dev', '-p', 'web'])
);
