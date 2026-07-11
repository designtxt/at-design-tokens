# Publishing Guide

How to validate, publish, and manage the `org.designtxt` lexicon set on the AT Protocol network.

---

## Prerequisites

- An AT Protocol account (a PDS account with a handle, e.g. `yourname.bsky.social`)
- The DID of that account (find it in your PDS settings or via `goat account status`)
- Access to manage DNS for `designtxt.org` (to set the NSID-to-DID mapping)
- Go installed (for installing `goat`) or Homebrew

---

## 1. Install `goat`

```bash
# macOS (Homebrew)
brew install goat

# Or via Go toolchain
go install github.com/bluesky-social/goat@latest
```

Verify:

```bash
goat --version # goat version v0.2.3-rev-d064a46
```

---

## 2. Validate Local Lexicons

From the project root:

```bash
goat lex lint
```

This parses all JSON files under `lexicons/` and reports style issues, missing descriptions, and schema errors.

Expected output:

```text
 🟢 lexicons/org/designtxt/defs.json
 🟢 lexicons/org/designtxt/tokenCollection.json
 🟢 lexicons/org/designtxt/resolver.json
 🟢 lexicons/org/designtxt/getTokens.json
 🟢 lexicons/org/designtxt/resolveTokens.json
```

Yellow or red indicators mean the linter found issues -- read the message next to each file and fix the corresponding JSON. Alternatively, copy this prompt and feed it to your AI agent:

```text
Run `goat lex lint` and fix any linting errors. See https://atproto.com/guides/lexicon for help with definitions.
```

You can also use the convenience script:

```bash
./scripts/validate.sh
```

### Additional Validation

Check DNS configuration before publishing:

```bash
goat lex check-dns
```

This will initially show that the `org.designtxt.*` namespace does not resolve -- that is expected until the DNS record is set up (next step).

---

## 3. Configure DNS (Manual Step)

AT Protocol resolves lexicon NSIDs via DNS TXT records. For the `org.designtxt.*` namespace, you must add a TXT record to `designtxt.org`.

**The record:**

```dns
_lexicon.designtxt.org   TXT   "did=did:plc:YOUR_DID_HERE"
```

Where `YOUR_DID_HERE` is the DID of the account that will publish the lexicons.

### How to find your DID

```bash
goat account login
goat account status
```

Or check the PDS settings page for your handle (e.g. `bsky.app/settings/account`).

### DNS details

| Field       | Value                              |
| ----------- | ---------------------------------- |
| Record type | `TXT`                              |
| Name        | `_lexicon.designtxt.org`           |
| Value       | `did=did:plc:abc123...` (your DID) |
| TTL         | 300 (or your default)              |

**Why this works:** The NSID `org.designtxt.tokenCollection` has authority `org.designtxt`. Reversed, it becomes `designtxt.org`. atproto SDKs query `_lexicon.designtxt.org` for the DID that owns this namespace, then fetch the lexicon from that DID's `com.atproto.lexicon.schema` collection.

### With Marque (atproto-native registrar)

If `designtxt.org` is registered through [Marque](https://marque.at), DNS records live on your PDS as atproto records in the **`at.marque.dns`** collection (record key = FQDN, matching the corresponding `at.marque.domain` record). You create the `_lexicon` TXT record by writing a DNS record to your own PDS -- no control panel needed.

Marque's dashboard has a DNS editor, but you can also manage records from the CLI using any atproto client. With `goat`:

```bash
# Login (one time)
goat account login

# Get your DID
goat account status

# Create the _lexicon TXT record
# (uses your PDS's com.atproto.repo.createRecord)
goat xrpc post com.atproto.repo.createRecord \
  --repo "$(goat account status --did)" \
  --collection at.marque.dns \
  --rkey designtxt.org \
  --record '{
    "name": "_lexicon.designtxt.org",
    "type": "TXT",
    "ttl": 300,
    "value": "did=did:plc:YOUR_DID"
  }'
```

This makes the DNS step scriptable alongside everything else -- the full pipeline (validate, DNS, publish) can run from CI.

### Propagation

DNS changes can take minutes to hours to propagate. You can verify with:

```bash
dig TXT _lexicon.designtxt.org +short
```

Once it resolves, confirm with goat:

```bash
goat lex check-dns
```

Expected output:

```text
 🟢 org.designtxt.* -> did:plc:abc123...
```

---

## 4. Publish

Authenticate (one-time):

```bash
goat account login
```

Follow the prompts to enter your handle and app password.

Then publish all lexicons:

```bash
goat lex publish
```

This uploads each JSON file in `lexicons/` as a `com.atproto.lexicon.schema` record on your account. It will skip schemas that are unchanged from the live version.

Expected output:

```text
 🟢 org.designtxt.defs
 🟢 org.designtxt.tokenCollection
 🟢 org.designtxt.resolver
 🟢 org.designtxt.getTokens
 🟢 org.designtxt.resolveTokens
```

### Updating existing lexicons

By default, `goat lex publish` skips schemas that already exist on the network. To publish updates:

```bash
goat lex publish --update
```

Or using the convenience script:

```bash
./scripts/publish.sh --update
```

**Caution:** The `--update` flag can clobber published schemas. Only use it when you have schema-evolution-compatible changes (adding optional fields, widening enums, etc.).

### Using environment variables (CI)

If you are publishing from CI, you can skip interactive login:

```bash
export GOAT_USERNAME="your-handle.bsky.social"
export GOAT_PASSWORD="your-app-password"
goat lex publish
```

---

## 5. Verify

### Check via goat

```bash
goat lex status
```

This compares local lexicons against the live network and shows any differences.

### Check via PDSLS

Browse to [https://pdsls.dev/at://<YOUR_DID>/com.atproto.lexicon.schema/](https://pdsls.dev/at://<YOUR_DID>/com.atproto.lexicon.schema/)

You should see all five `org.designtxt.*` records listed.

Or check a specific lexicon: [https://pdsls.dev/at://<YOUR_DID>/com.atproto.lexicon.schema/org.designtxt.tokenCollection.json](https://pdsls.dev/at://<YOUR_DID>/com.atproto.lexicon.schema/org.designtxt.tokenCollection.json)

### Check via goat fetch

```bash
goat xrpc get com.atproto.lexicon.getSchema --lexicon-nsid org.designtxt.tokenCollection
```

---

## 6. Using the Published Lexicons

Once published, any atproto SDK can fetch the schemas by NSID:

```typescript
import { LexiconDoc } from '@atproto/lexicon'
const schema = await agent.getSchema('org.designtxt.tokenCollection')
```

SDKs and tooling (like `pdsls`, `lexicon-garden`, etc.) will automatically resolve the schemas via DNS when they see the `org.designtxt` namespace.

---

## Full Checklist

- [ ] `goat` installed
- [ ] `goat account login` succeeds
- [ ] `goat lex lint` shows all green
- [ ] DNS TXT record `_lexicon.designtxt.org` -> `did=...` added
- [ ] `goat lex check-dns` shows green for `org.designtxt.*`
- [ ] `goat lex publish` completes without errors
- [ ] `goat lex status` shows no unexpected differences
- [ ] PDSLS shows all five lexicon records

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `goat lex publish` skips all schemas with orange icon | DNS check failed; your DID doesn't match the DNS record | Run `goat lex check-dns` and verify the DNS TXT record matches your publishing account's DID |
| `goat lex publish` skips with "no change" | Schemas already published and identical | Pass `--update` to force re-publish |
| `goat lex lint` shows yellow for `defs.json` | Missing descriptions on primary types | Add a `description` field to the `main` definition in each file |
| DNS record added but `check-dns` still fails | DNS hasn't propagated yet | Wait and retry with `dig TXT _lexicon.designtxt.org` |
| Published but `getSchema` returns 404 | Record key mismatch | Lexicons are published with record key = full NSID (e.g. `org.designtxt.tokenCollection`) |

---

## Related

- [AT Protocol: Publishing Lexicons](https://atproto.com/guides/publishing-lexicons)
- [NSID Specification](https://atproto.com/specs/nsid)
- [goat CLI Reference](https://github.com/bluesky-social/goat)
- [Lexicon Garden](https://lexicon.garden/)
