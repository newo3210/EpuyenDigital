// Supabase CLI wrapper - loads .env.local, defaults DOCKER_HOST to Podman on Windows, forwards args.
import { spawnSync } from 'node:child_process';
import { delimiter, resolve } from 'node:path';

// Podman named pipe - container endpoint used by the CLI when DOCKER_HOST is not set.
const PODMAN_PIPE = 'npipe:////./pipe/podman-machine-default';

// Environment setup - .env.local values never override variables already set in the shell.
try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional for CLI commands.
}
if (process.platform === 'win32' && !process.env.DOCKER_HOST) {
  process.env.DOCKER_HOST = PODMAN_PIPE;
}
process.env.PATH = `${resolve('node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`;

// Cloud password - exposed to the CLI only for remote commands, never for the local stack.
const args = process.argv.slice(2);
const isRemoteCommand = args[0] === 'link' || (args[0] === 'db' && args[1] === 'push');
if (isRemoteCommand && process.env.SUPABASE_CLOUD_DB_PASSWORD) {
  process.env.SUPABASE_DB_PASSWORD = process.env.SUPABASE_CLOUD_DB_PASSWORD;
}

// CLI invocation - runs the local supabase binary and propagates its exit code.
const command = ['supabase', ...args].join(' ');
const result = spawnSync(command, { stdio: 'inherit', shell: true, env: process.env });
process.exit(result.status ?? 1);
