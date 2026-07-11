# Tokens Studio → AT Protocol (publish-only)

Publishes Tokens Studio export files to an atproto repository as a `org.designtxt.tokenCollection` record. Handles multiple Tokens Studio export formats (DTCG-native, legacy value/type buckets, multi-file theme directories).

## Setup

```bash
npm install
cp .env.example .env    # edit with your PDS and credentials
```

## Usage

```bash
# Use .env file (recommended)
node publish.mjs

# Or override with environment variables:
# Single export file
ATP_PDS_HOST="https://pds.example.com" \
ATP_USERNAME="handle.bsky.social" \
ATP_PASSWORD="app-password" \
TS_TOKEN_FILE="./tokens.json" \
node publish.mjs

# Directory of theme files (e.g. from Tokens Studio sync)
ATP_PDS_HOST="https://pds.example.com" \
ATP_USERNAME="handle.bsky.social" \
ATP_PASSWORD="app-password" \
TS_TOKEN_DIR="./tokens/" \
node publish.mjs
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATP_PDS_HOST` | yes | — | PDS URL (e.g. `https://pds.example.com`) |
| `ATP_USERNAME` | yes | — | Handle or email for atproto login |
| `ATP_PASSWORD` | yes | — | App password |
| `ATP_RECORD_KEY` | no | `latest` | Record key for the tokenCollection |
| `TS_TOKEN_FILE` | no* | — | Path to a single Tokens Studio export JSON |
| `TS_TOKEN_DIR` | no* | `tokens/` | Path to a directory of token JSON files |

\* One of `TS_TOKEN_FILE` or `TS_TOKEN_DIR` must resolve to an existing file or directory.

### Normalization

The script handles three Tokens Studio export shapes automatically:

| Shape | Detection | Handling |
|---|---|---|
| DTCG-native (`$value`, `$type` at leaves) | Recursive `$value` scan | Pass-through |
| Named buckets (`{ "global": {...}, "light": {...} }`) | Top-level keys are sets | Merges into single tree |
| Legacy `{ value, type }` leaves | Leaves have `value` key | Converts to `$value`/`$type`, applies type-specific value parsing |

Color values stored as hex strings (e.g. `"#0066cc"`) are converted to structured `{ colorSpace, components, hex }` objects. Dimension strings like `"16px"` are parsed into `{ value, unit }` pairs.
