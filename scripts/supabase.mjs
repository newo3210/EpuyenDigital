// Supabase CLI wrapper - loads .env.local, defaults DOCKER_HOST to Podman on Windows, forwards args.
import { spawnSync } from 'node:child_process';

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

// CLI invocation - runs the local supabase binary and propagates its exit code.
const command = ['supabase', ...process.argv.slice(2)].join(' ');
const result = spawnSync(command, { stdio: 'inherit', shell: true, env: process.env });
process.exit(result.status ?? 1);
