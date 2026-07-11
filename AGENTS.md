# AGENTS.md — atprotokens

## Environment Variable Convention

All scripts in this project use the same 3 env vars for AT Protocol authentication:

| Variable       | Purpose           | Example                      |
|----------------|-------------------|------------------------------|
| `ATP_USERNAME` | Handle or DID     | `bomberstudios.com`          |
| `ATP_PASSWORD` | App password      | `xxxx-xxxx-xxxx-xxxx`        |
| `ATP_PDS_HOST` | PDS server URL    | `https://eurosky.social`     |

This applies to:

- `scripts/publish-samples.mjs`
- Integration scripts under `integrations/`

Do **not** use `ATP_IDENTIFIER`, `ATP_SERVICE`, or any other naming — the actual `.env` file at the project root uses `ATP_USERNAME`, `ATP_PASSWORD`, `ATP_PDS_HOST`, and all scripts must match.

## Record Keys for Samples

`scripts/publish-samples.mjs` publishes 3 records:

- `figma-sds`
- `github-primer`
- `ibm-carbon`

Collection: `org.designtxt.tokenCollection`. View/delete at `pdsls.dev/at://<did>/org.designtxt.tokenCollection/`.

## Lexicon Validation

Whenever a file in the `./lexicons` folder is created or edited, make sure it is valid by running `goat lex lint` and `goat lex status` and fixing any errors or warnings.

## Publishing Lexicons (requires DNS)

```bash
goat lex publish --update
```

Requires `_lexicon.designtxt.org` TXT record pointing to the lexicon DID.
