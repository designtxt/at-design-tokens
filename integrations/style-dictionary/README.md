# Style Dictionary → AT Protocol (publish-only)

Publishes Style Dictionary output tokens to an atproto repository as a `org.designtxt.tokenCollection` record. All numeric values are converted to strings for atproto compatibility.

## Setup

```bash
npm install
cp .env.example .env    # edit with your PDS and credentials
```

## Usage

```bash
# Use .env file (recommended)
node publish.mjs

# Or override with environment variables
ATP_SERVICE="https://pds.example.com" \
ATP_IDENTIFIER="handle.bsky.social" \
ATP_PASSWORD="app-password" \
SD_TOKEN_FILE="./tokens.json" \
ATP_RECORD_KEY="latest" \
node publish.mjs
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATP_SERVICE` | yes | — | PDS URL (e.g. `https://pds.example.com`) |
| `ATP_IDENTIFIER` | yes | — | Handle or email for atproto login |
| `ATP_PASSWORD` | yes | — | App password (not the main password) |
| `ATP_RECORD_KEY` | no | `latest` | Record key for the tokenCollection (e.g. `v1`, `production`) |
| `SD_TOKEN_FILE` | no | `tokens.json` | Path to the Style Dictionary output JSON |

### Typical Style Dictionary workflow

```bash
npx style-dictionary build              # generates tokens.json
ATP_SERVICE=... ATP_IDENTIFIER=... ATP_PASSWORD=... node publish.mjs
```

### CI integration (GitHub Actions)

```yaml
- run: npx style-dictionary build
- run: node integrations/style-dictionary/publish.mjs
  env:
    ATP_SERVICE: ${{ secrets.ATP_SERVICE }}
    ATP_IDENTIFIER: ${{ secrets.ATP_IDENTIFIER }}
    ATP_PASSWORD: ${{ secrets.ATP_PASSWORD }}
    SD_TOKEN_FILE: build/tokens.json
    ATP_RECORD_KEY: main
```
