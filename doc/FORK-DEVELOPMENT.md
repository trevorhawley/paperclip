# Fork development workflow

This guide supplements [DEVELOPING.md](DEVELOPING.md), [DATABASE.md](DATABASE.md), and [CONTRIBUTING.md](../CONTRIBUTING.md). It does not change the upstream release process.

## Branches and review

- `master`: clean upstream tracking; do not commit custom changes here.
- `dev`: integration branch; start from its current reviewed revision.
- `feature/*`: individual changes; open draft pull requests into `dev`.
- Keep upstream fixes in separate PRs with their original attribution. Fetch upstream changes, review the diff, and test them before integrating. Never merge or deploy automatically from a feature PR.

```sh
git fetch origin
git switch -c feature/example origin/dev
# make and test the change
git push -u origin feature/example
```

For an existing checkout, use `git fetch origin` and review the diff before switching branches. Keep unrelated changes in their original worktree. Follow `AGENTS.md` and scoped rules; use the PR template.

## Isolated loopback preview

Use a clean development checkout with no production `.env`, config, credentials, agent homes, or database URL. Install the Node and pnpm versions specified in `package.json`; Rust is needed for native Runner builds. Follow the prerequisites in DEVELOPING.md. From the checkout root:

```sh
node scripts/agent-preflight.mjs
```

Open a clean shell without inherited production provider or database environment variables. The following uses a fresh temporary state root for each preview. Keep the printed path for stopping and inspecting that instance.

```sh
preview_dir="$(mktemp -d "${TMPDIR:-/tmp}/paperclip-preview.XXXXXX")"
printf 'Preview data: %s\n' "$preview_dir"
# Use an unused port; do not use the live instance's port.
env -u DATABASE_URL -u DATABASE_MIGRATION_URL -u PAPERCLIP_INSTANCE_ID \
  PORT=4310 pnpm dev --bind loopback --data-dir "$preview_dir"
```

The native dev runner maps `--data-dir` to an isolated `PAPERCLIP_HOME`; without a database URL, it starts embedded PostgreSQL there. Do not pass an existing instance directory or copy its configuration. Verify the printed data/config location and URL before opening `http://127.0.0.1:4310`. If the port is occupied, stop and choose another unused port. Keep the preview loopback-only. Use synthetic companies, projects, and tasks; do not connect live applications or run paid agents. The local-trusted preview is not a production authentication test.

From another clean shell, substitute the printed temporary path:

```sh
pnpm dev:list --data-dir /path/to/preview-directory
pnpm dev:stop --data-dir /path/to/preview-directory
```

You can also stop the foreground process with Ctrl-C. Retain the temporary directory for inspection; remove it manually only after verifying it is the disposable preview directory and the process is stopped.

## Verification and CI

Use `pnpm verify --base origin/dev` for affected local tests after preflight; see AGENTS.md for exit code 2 and wider checks. Run focused tests for changed behavior. The fork PR workflow is intended to exercise the upstream policy checks, typecheck, build and Vitest suite on GitHub-hosted Linux with read-only token permissions and no production secrets. No live provider, deployment, or browser acceptance is implied by these checks. Record the tested SHA and actual job results in the PR. A pending, skipped, or unavailable check is not a pass.

Do not publish private instance details, real task data, connector configuration, chat links, tokens, or personal information in source, PRs, CI output or test fixtures. Use synthetic fixtures. Production deployment and data migrations require separate operator approval, a backup, and an explicit rollback plan.
