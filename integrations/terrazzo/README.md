# Terrazzo ↔ AT Protocol (two-way sync)

A daemon that synchronizes DTCG token files between a local Terrazzo project and an atproto `org.designtxt.tokenCollection` record. Runs alongside `terrazzo dev` to keep remote and local in sync during editing.

## How it works

```
 ┌──────────────┐   file watcher    ┌────────────┐   XRPC    ┌───────────┐
 │  local .json  │ ──────────────►  │  sync.mjs  │ ────────► │ atproto   │
 │  token files  │ ◄──────────────  │  (daemon)  │ ◄────────  │   PDS     │
 └──────────────┘   file write      └────────────┘   poll     └───────────┘
```

- **Push**: when a local token file changes (detected via `chokidar`), the daemon reads the tree, stringifies floats, and publishes an updated `tokenCollection` to atproto.
- **Pull**: on a configurable interval, the daemon polls the remote record. If the remote CID changed (and no local change has happened since the last push), the remote data is written back to local files.
- **Conflict resolution**: last-write-wins. If both local and remote changed between sync cycles, the most recent one wins. The daemon logs conflict events so you can manually reconcile.

## Setup

```bash
npm install
cp .env.example .env    # edit with your PDS and credentials
```

## Usage

```bash
# Use .env file (recommended)
node sync.mjs

# Or override with environment variables
ATP_SERVICE="https://pds.example.com" \
ATP_IDENTIFIER="handle.bsky.social" \
ATP_PASSWORD="app-password" \
TERRAZZO_TOKEN_DIR="./tokens" \
node sync.mjs
```

Run alongside `terrazzo dev` in a separate terminal or as a background process.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATP_SERVICE` | yes | — | PDS URL (e.g. `https://pds.example.com`) |
| `ATP_IDENTIFIER` | yes | — | Handle or email for atproto login |
| `ATP_PASSWORD` | yes | — | App password |
| `ATP_RECORD_KEY` | no | `terrazzo` | Record key for the tokenCollection |
| `TERRAZZO_TOKEN_DIR` | no | `tokens/` | Path to DTCG token file(s) |
| `SYNC_INTERVAL` | no | `30000` | Remote poll interval in milliseconds |

### Typical workflow

```bash
# Terminal 1: Terrazzo dev server (handles transforms, preview)
npx terrazzo dev

# Terminal 2: AT Protocol sync daemon
ATP_IDENTIFIER=... ATP_PASSWORD=... node sync.mjs

# Edit your tokens — every save triggers a publish to atproto
```

### CI / one-shot sync

For build-time publishing without the watcher:

```bash
SYNC_INTERVAL=0 node sync.mjs
```

The daemon pushes once on startup and exits (no polling, no watching).
