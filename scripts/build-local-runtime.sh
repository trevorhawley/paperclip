#!/bin/bash
# Build a self-contained local Paperclip runtime from an exact commit, for the native Git
# managed install's cached-reuse path: stage the output at
#   ~/.paperclip/cli/installs/git/<sha:0:12>/paperclip-<sha:0:9>-local-runtime
# with node_modules/paperclipai -> ../paperclip-<sha:0:9>-local-runtime, then run
#   paperclipai install --repo <repo> --ref <sha> --yes   (reports "Activated cached ... payload").
# The script only writes inside <out-dir>; it never touches launchd, services or ~/.paperclip.
#
# Usage: scripts/build-local-runtime.sh <full-sha> <source-tar.gz with a single top-level dir> <out-dir>
# Optional: CARGO_HOME / RUSTUP_HOME for the Rust toolchain that builds the runner.
# Output: <out-dir>/paperclip-<sha:0:9>-local-runtime (+ numbered build logs in <out-dir>)
set -euo pipefail
SHA="${1:?full sha}"; ARCHIVE="${2:?source archive}"; OUT="${3:?out dir}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "need a full 40-char sha" >&2; exit 2; }
case "$OUT" in /*) ;; *) echo "out dir must be an absolute path" >&2; exit 2;; esac
case "$OUT" in "$HOME/.paperclip"|"$HOME/.paperclip/"*) echo "refusing to build inside ~/.paperclip" >&2; exit 2;; esac
SHORT="${SHA:0:9}"
unset PAPERCLIP_HOME PAPERCLIP_CONFIG PAPERCLIP_INSTANCE_ID DATABASE_URL
export PAPERCLIP_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin"

SRC="$OUT/source"; RT="$OUT/paperclip-$SHORT-local-runtime"; STORE="$OUT/pnpm-store"; SHIM="$OUT/pnpm-bin"
rm -rf "$SRC" "$RT" "$STORE" "$OUT/server-staged"; mkdir -p "$SRC" "$SHIM"
tar -xzf "$ARCHIVE" --strip-components=1 -C "$SRC"
cd "$SRC"
# Pin pnpm to the repo's packageManager version; a newer global pnpm fails its check.
corepack enable pnpm --install-directory "$SHIM"
export PATH="$SHIM:$CARGO_BIN:$PATH"
PNPM_PIN="$(node -p 'require("./package.json").packageManager.split("@")[1].split("+")[0]')"
[ "$(pnpm --version)" = "$PNPM_PIN" ]
cp cli/package.json "$OUT/cli-package.dev.json"

echo "== install";        pnpm install --frozen-lockfile                      > "$OUT/1-install.log" 2>&1
echo "== build-npm";      bash scripts/build-npm.sh --skip-checks --skip-typecheck > "$OUT/2-build-npm.log" 2>&1
cp cli/package.json "$OUT/cli-package.publish.json"   # publish manifest the CLI bundle expects
echo "== server build";   pnpm -r --filter @paperclipai/server... --if-present run build > "$OUT/3-server-build.log" 2>&1
PAPERCLIP_RELEASE_REUSE_UI_DIST=1 bash scripts/prepare-server-ui-dist.sh > "$OUT/4-ui-dist.log" 2>&1
[ -d server/skills ] || cp -R skills server/skills
PAPERCLIP_BUILD_COMMIT="$SHA" node server/scripts/write-build-stamp.mjs
test -x server/dist/vendor/paperclip-runner/bin/paperclip-runnerd

# Deploy manifest: the publish manifest's external deps (what the bundled CLI imports) plus
# embedded-postgres, with the server taken from this workspace rather than the npm registry.
python3 - "$OUT/cli-package.dev.json" "$OUT/cli-package.publish.json" cli/package.json <<'PY'
import json, sys
dev, pub, out = (json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3])
m = dict(dev)
deps = {k: v for k, v in pub["dependencies"].items()}
deps["@paperclipai/server"] = "workspace:*"
if "embedded-postgres" in dev["dependencies"]: deps["embedded-postgres"] = dev["dependencies"]["embedded-postgres"]
m["dependencies"] = deps
for k in ("main", "bin", "files", "exports", "type"):
    if k in pub: m[k] = pub[k]
json.dump(m, open(out, "w"), indent=2)
PY
echo "== deploy";         pnpm --filter paperclipai deploy --prod --store-dir "$STORE" "$RT" > "$OUT/5-deploy.log" 2>&1
cp "$OUT/cli-package.dev.json" cli/package.json

# Deployed workspace packages keep their dev entry points (src/*.ts); apply publishConfig.
python3 - "$RT" <<'PY'
import glob, json, os, sys
rt = sys.argv[1]
for d in glob.glob(f"{rt}/node_modules/.pnpm/*/node_modules/@paperclipai/*"):
    p = os.path.join(d, "package.json")
    if os.path.islink(d) or not os.path.isfile(p): continue
    pkg = json.load(open(p)); pc = pkg.get("publishConfig") or {}
    keys = [k for k in ("main", "types", "exports", "bin") if k in pc]
    if not keys: continue
    for k in keys: pkg[k] = pc[k]
    pkg.pop("publishConfig", None); json.dump(pkg, open(p, "w"), indent=2)
PY

# Server bundled dependencies (chat adapters, ACP agents) are prepared the way the release does.
echo "== bundled deps";   node scripts/prepare-bundled-package.mjs "$SRC/server" "$OUT/server-staged" > "$OUT/6-bundled.log" 2>&1
SV="$(cd "$RT/node_modules/@paperclipai/server" && pwd -P)"
for dep in $(node -e 'const p=require(process.argv[1]);console.log((p.bundleDependencies||p.bundledDependencies||[]).join(" "))' "$SRC/server/package.json"); do
  rm -rf "$SV/node_modules/$dep"
done
cp -R "$OUT/server-staged/node_modules/." "$SV/node_modules/"
cmp -s "$SRC/server/dist/build-info.json" "$SV/dist/build-info.json"

echo "== smoke"
( cd "$RT" && node dist/index.js --version )
node -e 'const b=require(process.argv[1]); if(b.commit!==process.argv[2]) process.exit(1)' "$SV/dist/build-info.json" "$SHA"
test -x "$SV/dist/vendor/paperclip-runner/bin/paperclip-runnerd"
ls "$RT"/node_modules/.pnpm | grep -q '^@embedded-postgres+darwin-arm64@'
echo "OK $RT"
