# Spike: Local Supabase on Podman

- **Change:** `foundation-workspace-auth` — tasks 1.1–1.5
- **Date executed:** 2026-10-01
- **Timebox:** 2 h (used ~25 min)
- **Decision:** **PASS — local stack on Podman is the primary dev environment.** Cloud project kept for `db push` / deploy.

## Environment

| Item | Value |
|---|---|
| OS | Windows 10.0.26200 |
| Node / npm | v24.13.1 / 11.11.0 |
| Podman | 5.8.3, machine `podman-machine-default` (WSL2, 6 CPU, 2 GiB RAM, rootless default connection) |
| Supabase CLI | 2.119.0 via `npx supabase@latest` |
| Postgres image | `public.ecr.aws/supabase/postgres:17.11.0.002` |
| Repo location | OneDrive folder with a space in the path (`...\cursor\Epuyen Bot`) |

## 1.1 Podman machine and `DOCKER_HOST`

```powershell
podman machine list
podman machine inspect --format '{{.ConnectionInfo.PodmanPipe.Path}}'
# \\.\pipe\podman-machine-default
```

`DOCKER_HOST=npipe:////./pipe/podman-machine-default` (matches design D3).

Gotcha: `podman` was installed but not on the PATH of shells started before the install; refresh PATH from Machine/User scopes or restart the terminal.

## 1.2 `supabase init` + `supabase start`

```powershell
npx supabase@latest init
$env:DOCKER_HOST = 'npipe:////./pipe/podman-machine-default'
npx supabase@latest start
```

- First run pulled all images (~6 min) and then failed:
  `ContainerCreateError: statfs /mnt/c/.../supabase/snippets: no such file or directory` (Studio bind mount).
  **Fix:** create `supabase/snippets/` (tracked with `.gitkeep`).
- Second run: all services healthy — db, kong, auth, inbucket (mailpit), realtime, rest, storage, pg_meta, studio.
- Bind mounts through `/mnt/c` work despite OneDrive and the space in the path.

Local endpoints: API `http://127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio `http://127.0.0.1:54323`, Mailpit `http://127.0.0.1:54324`.

### `supabase/config.toml` adjustments

| Section | Change | Reason |
|---|---|---|
| `[analytics]` | `enabled = false` | logflare/vector need the Docker socket and are unused; saves RAM |
| `[edge_runtime]` | `enabled = false` | no edge functions in this change; saves RAM |
| `[db.seed]` | `enabled = false` | seeding is done by `supabase/seed/seed.ts` (task 4.6), no `seed.sql` |

After these changes `npx supabase start` works with no `-x` flags.

## 1.3 `db reset` + `test db`

Sample test `supabase/tests/000_smoke.test.sql` (`has_schema` for `public` and `auth`).

```text
$ npx supabase db reset
Finished supabase db reset on branch feature/foundation-workspace-auth.

$ npx supabase test db
/.../supabase/tests/000_smoke.test.sql .. ok
All tests successful.
Files=1, Tests=2
Result: PASS
```

`supabase test db` runs `pg_prove` in a container, so no host `psql` is required.

## 1.4 Decision

**PASS → local.** `.env.local` points to the local stack (`DOCKER_HOST`, local URL and CLI demo keys). Cloud project `ornqhujsmwjaegjadjar` values are kept in `.env.local` under `SUPABASE_CLOUD_*` / `SUPABASE_PROJECT_REF` for later `db push` and deploy; its service role key and DB password are pending from the user and not needed for local development.

## Risks / notes

- The Podman machine has 2 GiB RAM and also runs `n8n` and `vikunja` containers. Stack was stable during the spike; if OOM appears, raise memory with `podman machine set --memory 4096` (requires machine stop).
- Host `psql` is not installed; not needed because `supabase test db` is containerised.
