#!/bin/bash
# Install Cloudroom core on a Zo Computer, in container mode (docs/storage.md#containers in cloudroom-core).
#
#   sudo bash zo-setup.sh check                 Look at this Zo machine. Changes nothing.
#   sudo bash zo-setup.sh install [options]     Install or refresh the core.
#   sudo bash zo-setup.sh token                 Print the core token (to paste into QuantaCore).
#   sudo bash zo-setup.sh status                Ask the running core for its health.
#
# install options:
#   --harness claude     (default) Install Claude Code for the agent; sign in later from the Cloudroom app.
#   --harness codex      Install Codex 0.154.0. Needs --codex-model MODEL.
#   --harness none       Install only the core.
#   --version X.Y.Z      Pick a core release (default: the newest one).
#   --from DIR           Use a core you built from a cloudroom-core checkout instead of downloading.
#
# Zo has no systemd, so the core runs through cloudroom-core's own sandbox-start.sh, started by a
# Zo service. In container mode the Zo sandbox is the security boundary: Core runs as the agent
# account and the agent keeps sudo. Use this only on a Zo machine that is yours alone.
set -euo pipefail

REPO=${CLOUDROOM_REPO:-davidondrej/cloudroom-core}
LIB=/usr/local/lib/cloudroom
ETC=/etc/cloudroom
PORT_CORE=9840
AGENT=cloudroom-agent
CACHE=/var/cache/cloudroom-agent

fail() { echo "Cloudroom setup failed: $*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }
need_root() { [ "$(id -u)" = 0 ] || fail 'run as root, for example: sudo bash zo-setup.sh install'; }
dev() { stat -c %d "$1" 2>/dev/null || echo missing; }

check() {
  say '== Cloudroom on Zo: machine check (nothing is changed) =='
  say "user:        $(id -un) (uid $(id -u))"
  if [ "$(id -u)" = 0 ] || sudo -n true 2>/dev/null; then say 'root/sudo:   yes'; else say 'root/sudo:   NO  -> the install needs root or passwordless sudo'; fi
  say "cpu:         $(uname -m)   (core releases exist for x86_64 and aarch64)"
  . /etc/os-release 2>/dev/null && say "system:      ${PRETTY_NAME:-unknown}"
  if command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then say 'systemd:     yes (the standard cloudroom-core install.sh also works here)'; else say 'systemd:     no  -> container mode via sandbox-start.sh (what this script sets up)'; fi
  if [ -f /sys/fs/cgroup/cgroup.controllers ] && [ -w /sys/fs/cgroup ]; then say 'cgroups:     v2, writable'; else say 'cgroups:     not writable -> container mode needed'; fi
  for tool in node npm git curl python3 openssl setpriv unshare; do
    if command -v "$tool" >/dev/null; then say "$(printf '%-12s' "$tool:") $(command -v "$tool")"; else say "$(printf '%-12s' "$tool:") missing"; fi
  done
  command -v node >/dev/null && say "node version: $(node -v)   (24.x is installed by this script if node is missing)"
  say ''
  say 'Disks (the core needs these on ONE filesystem):'
  for p in / /tmp /var /home /code /home/workspace; do say "$(printf '  %-16s' "$p") device $(dev "$p")"; done
  if [ "$(dev /tmp)" != "$(dev /)" ]; then say '  note: /tmp is a separate disk; sandbox-start.sh then needs "unshare --mount" to work.'; fi
  df -h / /tmp 2>/dev/null | sed 's/^/  /'
  say ''
  if [ -x "$LIB/cloudroom" ]; then say "core:        installed ($("$LIB/cloudroom" --version 2>/dev/null || echo unknown))"; else say 'core:        not installed'; fi
  say ''
  say 'Please paste this whole output back to Claude in QuantaCore if anything says NO or missing.'
}

download_core() {
  local version=$1 stage=$2 url sum
  url=$(python3 - "$REPO" "$(uname -m)" "$version" <<'PY'
import json, sys, urllib.request
repo, arch, version = sys.argv[1:]
with urllib.request.urlopen(f'https://api.github.com/repos/{repo}/releases?per_page=50', timeout=30) as response:
    releases = json.load(response)
for release in releases:
    for asset in release['assets']:
        name = asset['name']
        if name.endswith(f'-linux-{arch}.tar.gz') and (not version or name == f'cloudroom-core-{version}-linux-{arch}.tar.gz'):
            sys.exit(print(asset['browser_download_url']))
sys.exit(f'No cloudroom-core {version or "release"} build for {arch} in {repo}.')
PY
) || fail 'could not find a core release'
  say "Downloading $url"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --retry 3 -o "$stage/release.tar.gz" "$url"
  tar -xzf "$stage/release.tar.gz" -C "$stage" --no-same-owner
  sum=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["sha256"])' "$stage/update-manifest.json")
  echo "$sum  $stage/cloudroom" | sha256sum --check --status || fail 'the downloaded core does not match its checksum'
  if [ ! -f "$stage/install/sandbox-start.sh" ]; then
    mkdir -p "$stage/install"
    curl --fail --silent --show-error --proto '=https' --tlsv1.2 --retry 3 -o "$stage/install/sandbox-start.sh" "https://raw.githubusercontent.com/$REPO/main/install/sandbox-start.sh"
  fi
}

install_node() {
  if [ -x /usr/local/bin/node ] || [ -x /usr/bin/node ]; then return; fi
  local stage=$1 node_arch node_dist node_sum
  say 'Installing Node.js 24...'
  case $(uname -m) in x86_64) node_arch=x64 ;; aarch64) node_arch=arm64 ;; *) fail "no Node.js build for $(uname -m)" ;; esac
  node_dist=https://nodejs.org/dist/latest-v24.x
  node_sum=$(curl --fail --silent --show-error --proto '=https' --tlsv1.2 --retry 3 "$node_dist/SHASUMS256.txt" | grep -E " node-v24\.[0-9.]+-linux-$node_arch\.tar\.gz$") || fail 'Node.js 24 was not found'
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 --retry 3 -o "$stage/node.tar.gz" "$node_dist/${node_sum##* }"
  echo "${node_sum%% *}  $stage/node.tar.gz" | sha256sum --check --status || fail 'the Node.js download does not match its checksum'
  tar -xzf "$stage/node.tar.gz" -C /usr/local --strip-components=1 --no-same-owner --wildcards '*/bin/*' '*/include/*' '*/lib/*' '*/share/*'
}

install_core() {
  need_root
  local harness=claude version='' codex_model='' from=''
  while [ $# -gt 0 ]; do
    case $1 in
      --harness) harness=${2:-}; shift 2 ;;
      --version) version=${2:-}; [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail '--version needs X.Y.Z'; shift 2 ;;
      --codex-model) codex_model=${2:-}; shift 2 ;;
      --from) from=${2:-}; shift 2 ;;
      *) fail "unknown option $1" ;;
    esac
  done
  case $harness in claude|none) ;; codex) [ -n "$codex_model" ] || fail '--harness codex needs --codex-model MODEL' ;; *) fail '--harness must be claude, codex or none' ;; esac
  for tool in curl python3 openssl setpriv sha256sum; do command -v "$tool" >/dev/null || fail "$tool is missing (try: apt-get install -y curl python3 openssl util-linux)"; done

  STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
  local stage=$STAGE
  if [ -n "$from" ]; then
    # A core you built yourself: a cloudroom-core checkout after "cargo build --release".
    local binary=$from/target/release/cloudroom
    [ -x "$binary" ] || binary=$from/cloudroom
    [ -x "$binary" ] && [ -f "$from/install/sandbox-start.sh" ] || fail "--from needs a cloudroom-core folder with a built core"
    cp "$binary" "$stage/cloudroom"; mkdir -p "$stage/install"; cp "$from/install/sandbox-start.sh" "$stage/install/"
  else
    download_core "$version" "$stage"
  fi
  install_node "$stage"

  say 'Creating the agent account...'
  id "$AGENT" >/dev/null 2>&1 || useradd --create-home --user-group --shell /bin/bash "$AGENT"
  local uid gid home
  uid=$(id -u "$AGENT"); gid=$(id -g "$AGENT"); home=$(getent passwd "$AGENT" | cut -d: -f6)
  [ "$uid" != 0 ] && [ "$gid" != 0 ] || fail 'the agent account must not be root'
  # Container mode: the service account is an alias of the agent (same uid), so Core needs no capabilities.
  if ! id cloudroom >/dev/null 2>&1; then
    groupadd -o -g "$gid" cloudroom 2>/dev/null || true
    useradd -o -u "$uid" -g "$gid" -M -d /var/lib/cloudroom -s /usr/sbin/nologin cloudroom
  fi
  [ "$(id -u cloudroom)" = "$uid" ] || fail 'an existing "cloudroom" account has a different uid; this machine was set up another way'
  # Container mode requires the agent to keep sudo (agent_sudo). The Zo sandbox is the boundary.
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$AGENT" > /etc/sudoers.d/cloudroom-agent
  chmod 440 /etc/sudoers.d/cloudroom-agent

  say 'Creating folders...'
  install -d -m 700 -o "$uid" -g "$gid" /var/lib/cloudroom /var/lib/cloudroom/history /code
  install -d -m 755 -o root -g root "$ETC" "$LIB"
  install -d -m 700 -o "$uid" -g "$gid" "$CACHE"
  chmod 700 "$home"
  install -m 755 "$stage/cloudroom" "$LIB/cloudroom"
  install -m 755 "$stage/install/sandbox-start.sh" "$LIB/sandbox-start.sh"

  say 'Writing configuration...'
  # Compact JSON: sandbox-start.sh looks for "cgroup_root":null exactly.
  printf '{"agent_uid":%s,"agent_gid":%s,"cache_dir":"%s","cgroup_root":null,"agent_sudo":true}\n' "$uid" "$gid" "$CACHE" > "$ETC/storage.json"
  chown root:root "$ETC/storage.json"; chmod 644 "$ETC/storage.json"
  if [ -f "$ETC/core.env" ]; then
    say "Keeping the existing $ETC/core.env and its token."
  else
    ( umask 077; set -C
      cat > "$ETC/core.env" <<EOF
CLOUDROOM_TOKEN=$(openssl rand -hex 32)
CLOUDROOM_LISTEN=127.0.0.1:$PORT_CORE
CLOUDROOM_STORE=self-hosted
CLOUDROOM_LOCAL_HISTORY=1
CLOUDROOM_STATE_DIR=/var/lib/cloudroom/history
CLOUDROOM_ACCOUNT_HOME=$home
EOF
    )
  fi
  chown root:root "$ETC/core.env"; chmod 600 "$ETC/core.env"
  set_env() { grep -v "^$1=" "$ETC/core.env" > "$ETC/core.env.tmp" || true; echo "$1=$2" >> "$ETC/core.env.tmp"; chmod 600 "$ETC/core.env.tmp"; mv "$ETC/core.env.tmp" "$ETC/core.env"; }

  case $harness in
    claude)
      say 'Installing Claude Code for the agent...'
      npm install --global --prefix /usr/local @anthropic-ai/claude-code >/dev/null
      install -d -m 700 -o "$uid" -g "$gid" "$home/.claude"
      set_env CLOUDROOM_HARNESS claude-code ;;
    codex)
      say 'Installing Codex 0.154.0 for the agent...'
      npm install --global --prefix /usr/local @openai/codex@0.154.0 >/dev/null
      set_env CLOUDROOM_CODEX_BINARY /usr/local/bin/codex
      set_env CLOUDROOM_CODEX_HOME "$home/.codex"
      set_env CLOUDROOM_CODEX_MODEL "$codex_model"
      set_env CLOUDROOM_HARNESS codex ;;
  esac

  # The Zo service runs this. It starts the core and stays in the foreground, restarting it after a crash.
  cat > "$LIB/zo-start.sh" <<'EOF'
#!/bin/bash
# Started by the Zo service "cloudroom-core". Runs Cloudroom core in the foreground.
if [ "$(id -u)" != 0 ]; then exec sudo -n bash "$0" "$@"; fi
exec bash /usr/local/lib/cloudroom/sandbox-start.sh
EOF
  chmod 755 "$LIB/zo-start.sh"

  say 'Checking that the core folders share one disk...'
  local base; base=$(dev /code)
  for p in /tmp /var/lib/cloudroom/history "$home" "$CACHE"; do
    [ "$(dev "$p")" = "$base" ] || say "  warning: $p is on a different disk from /code. The core may refuse to start; paste 'zo-setup.sh check' output to Claude."
  done

  cat <<EOF

Cloudroom core $("$LIB/cloudroom" --version 2>/dev/null | cut -d' ' -f2) is installed.

Next steps:
 1. In Zo, add a service:
      label:       cloudroom-core
      mode:        http
      local port:  $PORT_CORE
      entrypoint:  bash $LIB/zo-start.sh
    Then make it PRIVATE (the *.zo.computer address that needs your Zo sign-in).
 2. Check it:     sudo bash zo-setup.sh status
 3. Get the token for QuantaCore and the Cloudroom app:  sudo bash zo-setup.sh token
EOF
  case $harness in
    claude) say ' 4. Sign in Claude: in the Cloudroom app, pick Cloud, then Connect Claude (uses your subscription).' ;;
    codex)  say " 4. Sign in Codex:  sudo -u $AGENT -H /usr/local/bin/codex login --device-auth" ;;
  esac
}

token() {
  need_root
  [ -f "$ETC/core.env" ] || fail 'the core is not installed yet'
  sed -n 's/^CLOUDROOM_TOKEN=//p' "$ETC/core.env"
}

status() {
  need_root
  [ -f "$ETC/core.env" ] || fail 'the core is not installed yet'
  sed -n 's/^CLOUDROOM_TOKEN=\(.*\)$/header = "Authorization: Bearer \1"/p' "$ETC/core.env" |
    curl --config - --silent --show-error --fail-with-body "http://127.0.0.1:$PORT_CORE/v1/health" && echo ||
    { echo 'The core did not answer. Recent log:'; tail -n 30 /var/log/cloudroom/core.log 2>/dev/null; exit 1; }
}

case ${1:-} in
  check) check ;;
  install) shift; install_core "$@" ;;
  token) token ;;
  status) status ;;
  *) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
