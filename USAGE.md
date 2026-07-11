# Design Team Usage Guide

A practical guide for design teams using AT Protocol to store, share, and resolve design system tokens. The `org.designtxt` lexicons map the DTCG Design Tokens format into atproto records and XRPC endpoints, giving every team an on-protocol source of truth for their design decisions.

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [Why AT Protocol?](#why-at-protocol)
- [When Not to Use This](#when-not-to-use-this)
- [Scenario 1: Single Brand, One Team](#scenario-1-single-brand-one-team)
- [Scenario 2: Multi-Brand Design System](#scenario-2-multi-brand-design-system)
- [Scenario 3: Theming (Light + Dark Mode)](#scenario-3-theming-light--dark-mode)
- [Scenario 4: Responsive / Breakpoint Tokens](#scenario-4-responsive--breakpoint-tokens)
- [Scenario 5: CI/CD Pipeline Integration](#scenario-5-cicd-pipeline-integration)
- [Access Patterns Cheat Sheet](#access-patterns-cheat-sheet)
- [Vocabulary Reference](#vocabulary-reference)

---

## Core Concepts

| Term | Meaning |
|------|---------|
| **DID** | Decentralized Identifier — the identity that owns the tokens. Every team or individual has one. |
| **AT-URI** | Protocol address: `at://<did>/<collection>/<rkey>` (like a URL for records). |
| **record** | A stored document — either a `tokenCollection` (your tokens) or a `resolver` (your rules for combining token sets). |
| **tokenCollection** | One DTCG-format JSON file. You publish one per brand, per theme, per platform — however you organize. |
| **resolver** | A document that defines which token collections to use, contextual modifiers (theme, size, role), and the order in which they cascade. |
| **query** | A read-only fetch. `getTokens` retrieves a token collection, optionally at a sub-path. |
| **procedure** | A server-side operation. `resolveTokens` takes a resolver + context inputs and returns resolved values. |
| **string-encoded float** | AT Protocol cannot store floating-point numbers (CBOR limitation). All fractional values — color components, dimension values, durations, bezier points — are stored as strings like `"0.4"` or `"16.5"`. Tools parse them back to native floats on read. |
| **metadata fields** | `tokenCollection` records support optional `name`, `description`, and `createdAt` fields at the root level alongside the token tree. Use `name` for human-friendly identification like `"Brand Tokens"` or `"My Design System Q3"`. |

---

## Why AT Protocol?

Traditional design token storage usually means a JSON file in a Git repo, a Figma plugin export, or a vendor-specific token management SaaS. AT Protocol offers structural advantages over all of them.

### Every token collection has a stable, resolvable address

An AT-URI like `at://did:plc:abc123/org.designtxt.tokenCollection/v1` is a permanent, network-addressable identifier. It does not depend on GitHub being up, a specific branch name, or a CDN cache. Any AT Protocol PDS (Personal Data Server) can serve it. Your CI, your web app, your design tool plugin, and your coworker's local dev environment all fetch from the same canonical URI.

Compare this to a Git-based approach where the same file might live at:

- `main` branch → `tokens/latest.json`
- your PR → `feature/update-colors/tokens.json`
- a release tag → `v1.2.3/tokens.json`

All of these are different paths, different URLs (if they have URLs at all), and require authentication middleware to resolve. AT Protocol collapses this to a single, stable URI that never moves.

### Built-in identity and ownership

Every token set is cryptographically tied to a DID. You know who published it, you can verify authorship, and you can set permissions per-repository. This matters for:

- **Vendor tokens** — a font foundry publishes its type scale as a `tokenCollection` you reference by URI instead of copy-pasting
- **Cross-team sharing** — Team A references Team B's spacing scale via AT-URI, not a git submodule or npm dependency
- **Audit trail** — every update to a token set is a new record version in the repo, signed by the publisher's DID

### Federation means no single point of failure

Your tokens are not locked into any single vendor. You choose your PDS — self-host it, use a public one, or switch providers without changing your token URIs. If a SaaS token platform goes down or changes its pricing, your tokens are still available from any other PDS that hosts your data.

### Resolution is a server-side concern

The `resolveTokens` procedure handles alias resolution, modifier cascading, and context matching on the server. The client sends `input: { theme: "dark", viewport: "mobile" }` and gets back resolved values. No client-side DTCG parser, no tree-walking alias resolution, no duplicated logic across platforms. Your web app, iOS app, Android app, and design tool plugin all call the same endpoint.

### Versioning is free

AT Protocol repos are content-addressed Merkle Search Trees — every mutation (create, update, delete) produces a new commit with a different root hash, and the old tree is not destroyed ([repo spec](https://atproto.com/specs/repository)). The [`putRecord`](https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/repo/putRecord.json) endpoint creates or updates a record at a given key, and [`getRecord`](https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/repo/getRecord.json) accepts an optional `cid` parameter — **"The CID of the version of the record. If not specified, then return the most recent version"** — which means you can fetch any previous iteration by its content hash. There is no need to set up your own versioning scheme or retention policy.

### Cross-referencing without copying

A resolver document references token collections by AT-URI. You never copy token values from one set into another. When the foundation team updates `color.brand.primary`, every resolver that references it picks up the change automatically on the next `resolveTokens` call. No npm publish, no PR to update consumers, no stale copies.

### Why not just use Git?

| Concern | Git | AT Protocol |
|---------|-----|-------------|
| Addressing | File path + branch + commit | Single stable AT-URI |
| Identity | GPG signatures (optional, manual) | DID (required, automatic) |
| Server | GitHub/GitLab/self-hosted | Any PDS, switchable |
| Querying | `git show`, grep, or an API wrapper | Native XRPC: sub-path fetch, alias resolution |
| Resolution | Custom tooling required | Built-in `resolveTokens` procedure |
| Access control | Repo-level | Per-repo AT Protocol permissions |

AT Protocol is not a replacement for Git in general. It is a better fit for the specific problem of publishing, addressing, and resolving structured design data across many consumers.

---

## When Not to Use This

AT Protocol was designed for public, federated social networking. Storing design tokens on it makes sense for some teams but is a poor fit for others.

### Private / internal design systems

AT Protocol records are **public by default**. Repositories are designed for open, verifiable data — every record is visible to anyone who knows the AT-URI or can enumerate the collection. If your design system is proprietary (a closed-source product, a financial services UI, a defense contractor), storing tokens on a PDS leaks your design decisions. There is no built-in encryption at the record level. You would need to encrypt token values before writing and decrypt after reading, which adds complexity and breaks server-side resolution (`resolveTokens` would see ciphertext, not tokens).

### Orgs that need strict access control

AT Protocol's permissions model is coarse: either you control the PDS and can block requests at the infrastructure level, or records are world-readable. There is no per-field ACL, no team/role-based access, and no concept of "viewer may see colors but not typography." If your team needs to restrict certain tokens (brand colors before a launch, unreleased spacing scales) to specific people, you need a tool with fine-grained IAM.

### Consumers locked to a single platform

If all your token consumers run in one environment — say, a single Next.js app and a React Native mobile app — the federation and cross-referencing benefits of AT Protocol add operational overhead with no upside. You can store a DTCG JSON file in your app repo, import it directly, and run alias resolution in a build step. AT Protocol makes the most sense when you have heterogeneous consumers (web, iOS, Android, design tools, CI) that need a shared, network-addressable source of truth.

### Teams that want offline-first or local builds

AT Protocol requires network access to a PDS. If your token pipeline runs on airplanes, in CI without egress, or in airgapped environments, every `getTokens` call fails. A file-based approach (JSON in Git, npm-packaged tokens) works offline trivially. You can cache, but now you are managing cache invalidation on top of an already-decentralized system.

### Very large token sets

AT Protocol repositories are designed for "up to single-digit millions" records ([repo spec](https://atproto.com/specs/repository)). A typical design system has hundreds to low thousands of tokens, so this is rarely a bottleneck. But if you are generating tokens for every component variant, at every breakpoint, for every brand — producing hundreds of thousands of resolved values — the PDS's XRPC response size limits and CAR export overhead become a real constraint. At that scale, a purpose-built token management service or a CDN-backed JSON distribution is simpler.

---

## Scenario 1: Single Brand, One Team

The simplest setup. A single design system, one brand, no theming. The team publishes one `tokenCollection` record and consumes it everywhere.

### Step 1: Define your tokens

A `tokenCollection` record stores a DTCG-format JSON tree alongside optional metadata. You write it once and publish it to your atproto repository.

> **Note on floats:** AT Protocol stores only integers, not floating-point numbers. All fractional values in this example (color components, dimension values, alpha, line height, letter spacing) are written as strings. See [Vocabulary Reference](#vocabulary-reference) for details.

```json
{
  "$type": "org.designtxt.tokenCollection",
  "name": "Product Tokens",
  "description": "Primary design tokens for the product team",
  "createdAt": "2026-07-10T12:00:00.000Z",
  "color": {
    "brand": {
      "primary": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["0", "0.4", "0.8"], "hex": "#0066cc" },
        "$description": "Primary brand color"
      },
      "secondary": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["0.5", "0.2", "0.7"], "hex": "#8033b3" }
      }
    },
    "neutral": {
      "white": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["1", "1", "1"], "hex": "#ffffff" }
      },
      "gray100": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["0.96", "0.96", "0.96"], "hex": "#f5f5f5" }
      },
      "gray900": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["0.11", "0.11", "0.11"], "hex": "#1c1c1c" }
      }
    },
    "semantic": {
      "success": { "$value": "{color.brand.primary}" },
      "danger": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": ["0.8", "0", "0.1"], "hex": "#cc001a" }
      }
    }
  },
  "dimension": {
    "spacing": {
      "xs": { "$value": { "value": "4", "unit": "px" } },
      "sm": { "$value": { "value": "8", "unit": "px" } },
      "md": { "$value": { "value": "16", "unit": "px" } },
      "lg": { "$value": { "value": "24", "unit": "px" } },
      "xl": { "$value": { "value": "32", "unit": "px" } }
    },
    "borderRadius": {
      "sm": { "$value": { "value": "4", "unit": "px" } },
      "md": { "$value": { "value": "8", "unit": "px" } },
      "full": { "$value": { "value": "9999", "unit": "px" } }
    }
  },
  "typography": {
    "heading": {
      "$type": "typography",
      "$value": {
        "fontFamily": ["Inter", "system-ui", "sans-serif"],
        "fontWeight": "bold",
        "fontSize": { "value": "24", "unit": "px" },
        "lineHeight": "1.3",
        "letterSpacing": { "value": "-0.01", "unit": "em" }
      }
    },
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": ["Inter", "system-ui", "sans-serif"],
        "fontWeight": "normal",
        "fontSize": { "value": "16", "unit": "px" },
        "lineHeight": "1.5"
      }
    }
  },
  "shadow": {
    "card": {
      "$type": "shadow",
      "$value": {
        "color": { "colorSpace": "srgb", "components": ["0", "0", "0"], "alpha": "0.1" },
        "offsetX": { "value": "0", "unit": "px" },
        "offsetY": { "value": "2", "unit": "px" },
        "blur": { "value": "8", "unit": "px" },
        "inset": false
      }
    }
  }
}
```

### Step 2: Publish via TypeScript

```typescript
import { Agent } from '@atproto/api'

const agent = new Agent({ service: 'https://bsky.social' })
await agent.login({ identifier: 'design-team.example.com', password: 'app-password' })

const { uri } = await agent.com.atproto.repo.createRecord({
  repo: agent.session?.did,
  collection: 'org.designtxt.tokenCollection',
  record: {
    $type: 'org.designtxt.tokenCollection',
    name: 'Product Tokens',
    description: 'Primary design tokens for the product team',
    color: {
      brand: {
        primary: {
          $type: 'color',
          $value: { colorSpace: 'srgb', components: ['0', '0.4', '0.8'], hex: '#0066cc' }
        }
      }
    }
    /* ... rest of the token tree with string-encoded floats ... */
  }
})

console.log('Published at:', uri)
// => at://did:plc:abc123/org.designtxt.tokenCollection/v1
```

### Step 3: Consume in your app

```typescript
// Fetch the full token set
const { data } = await agent.call('org.designtxt.getTokens', {
  ref: 'at://did:plc:abc123/org.designtxt.tokenCollection/v1'
})
// data.tokens contains the full tree

// Fetch just the spacing tokens
const { data: spacing } = await agent.call('org.designtxt.getTokens', {
  ref: 'at://did:plc:abc123/org.designtxt.tokenCollection/v1',
  path: '/dimension/spacing'
})

// Fetch semantic colors with alias resolution
const { data: semantic } = await agent.call('org.designtxt.getTokens', {
  ref: 'at://did:plc:abc123/org.designtxt.tokenCollection/v1',
  path: '/color/semantic',
  resolveReferences: true
})
// semantic.tokens.success.$value is resolved to the actual color,
// not the alias string "{color.brand.primary}"
```

---

## Scenario 2: Multi-Brand Design System

Your design system powers three brands (Acme, BetaCo, and internal tools). Each brand has its own colors and spacing, but they share a common foundation. You publish separate `tokenCollection` records for each brand and one shared foundation.

### Repository layout

```
at://did:plc:brand-owner/
  org.designtxt.tokenCollection/foundation     # shared type ramp, spacing scale, shadows
  org.designtxt.tokenCollection/brand-acme     # Acme-specific semantic tokens
  org.designtxt.tokenCollection/brand-betaco   # BetaCo-specific semantic tokens
  org.designtxt.tokenCollection/brand-internal # Internal tools tokens
  org.designtxt.resolver/acme                  # resolver: foundation + acme
  org.designtxt.resolver/betaco               # resolver: foundation + betaco
```

### The resolver wires them together

```json
{
  "$type": "org.designtxt.resolver",
  "version": "2025.10",
  "name": "Acme Brand Tokens",
  "sets": {
    "foundation": {
      "sources": [{ "$ref": "at://did:plc:brand-owner/org.designtxt.tokenCollection/foundation" }]
    },
    "brand": {
      "sources": [{ "$ref": "at://did:plc:brand-owner/org.designtxt.tokenCollection/brand-acme" }]
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/foundation" },
    { "$ref": "#/sets/brand" }
  ]
}
```

The `resolutionOrder` means: apply foundation first, then overlay brand tokens. If both define `color.brand.primary`, the brand set wins.

### Consume per brand

```typescript
async function getTokensForBrand(brand: 'acme' | 'betaco' | 'internal') {
  const resolvers = { acme: 'at://did:plc:brand-owner/org.designtxt.resolver/acme' }
  const { data } = await agent.call('org.designtxt.resolveTokens', {}, {
    resolverRef: resolvers[brand],
    input: {}
  })
  return data.tokens
}
```

---

## Scenario 3: Theming (Light + Dark Mode)

A resolver with **modifiers** lets teams define theme-conditional token overrides.

### Publish theme-specific collections

Record `org.designtxt.tokenCollection/theme-light`:
```json
{
  "$type": "org.designtxt.tokenCollection",
  "name": "Theme Light",
  "color": {
    "background": {
      "$type": "color",
      "$value": { "colorSpace": "srgb", "components": ["1", "1", "1"], "hex": "#ffffff" }
    },
    "text": {
      "$type": "color",
      "$value": { "colorSpace": "srgb", "components": ["0.11", "0.11", "0.11"], "hex": "#1c1c1c" }
    }
  }
}
```

Record `org.designtxt.tokenCollection/theme-dark`:
```json
{
  "$type": "org.designtxt.tokenCollection",
  "name": "Theme Dark",
  "color": {
    "background": {
      "$type": "color",
      "$value": { "colorSpace": "srgb", "components": ["0.11", "0.11", "0.11"], "hex": "#1c1c1c" }
    },
    "text": {
      "$type": "color",
      "$value": { "colorSpace": "srgb", "components": ["0.96", "0.96", "0.96"], "hex": "#f5f5f5" }
    }
  }
}
```

### Define a resolver with theme modifier

```json
{
  "$type": "org.designtxt.resolver",
  "version": "2025.10",
  "name": "App Tokens with Theming",
  "sets": {
    "foundation": {
      "sources": [{ "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/foundation" }]
    }
  },
  "modifiers": {
    "theme": {
      "description": "Light or dark color theme",
      "contexts": {
        "light": [{ "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/theme-light" }],
        "dark": [{ "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/theme-dark" }]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/foundation" },
    { "$ref": "#/modifiers/theme" }
  ]
}
```

### Resolve per theme

```typescript
// Light mode — uses the default
const { data: light } = await agent.call('org.designtxt.resolveTokens', {}, {
  resolverRef: 'at://did:plc:abc123/org.designtxt.resolver/main',
  input: { theme: 'light' }
})
// light.tokens.color.background => #ffffff

// Dark mode
const { data: dark } = await agent.call('org.designtxt.resolveTokens', {}, {
  resolverRef: 'at://did:plc:abc123/org.designtxt.resolver/main',
  input: { theme: 'dark' }
})
// dark.tokens.color.background => #1c1c1c
```

### On the client at runtime

```typescript
function ThemeSwitcher() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [tokens, setTokens] = useState(null)

  useEffect(() => {
    const { data } = await agent.call('org.designtxt.resolveTokens', {}, {
      resolverRef: 'at://did:plc:abc123/org.designtxt.resolver/main',
      input: { theme }
    })
    setTokens(data.tokens)
  }, [theme])

  // Apply as CSS custom properties
  useEffect(() => {
    if (!tokens) return
    const root = document.documentElement
    root.style.setProperty('--color-background', hexToCss(tokens.color.background.$value))
    root.style.setProperty('--color-text', hexToCss(tokens.color.text.$value))
  }, [tokens])

  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
    Switch to {theme === 'light' ? 'dark' : 'light'} mode
  </button>
}
```

---

## Scenario 4: Responsive / Breakpoint Tokens

Use modifiers to vary spacing and typography at different viewport sizes.

### Token collections per breakpoint

- `org.designtxt.tokenCollection/spacing-mobile`
- `org.designtxt.tokenCollection/spacing-desktop`
- `org.designtxt.tokenCollection/type-mobile`
- `org.designtxt.tokenCollection/type-desktop`

### Resolver with breakpoint modifier

```json
{
  "$type": "org.designtxt.resolver",
  "version": "2025.10",
  "name": "Responsive Tokens",
  "sets": {
    "foundation": {
      "sources": [{ "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/foundation" }]
    }
  },
  "modifiers": {
    "viewport": {
      "description": "Viewport size breakpoint",
      "contexts": {
        "mobile": [
          { "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/spacing-mobile" },
          { "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/type-mobile" }
        ],
        "desktop": [
          { "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/spacing-desktop" },
          { "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/type-desktop" }
        ]
      },
      "default": "desktop"
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/foundation" },
    { "$ref": "#/modifiers/viewport" }
  ]
}
```

### SSR / build-time resolution

```typescript
// In your build script, resolve for each breakpoint
const breakpoints = ['mobile', 'desktop']

for (const bp of breakpoints) {
  const { data } = await agent.call('org.designtxt.resolveTokens', {}, {
    resolverRef: 'at://did:plc:abc123/org.designtxt.resolver/responsive',
    input: { viewport: bp }
  })
  // Write to per-breakpoint CSS files
  writeFileSync(`tokens.${bp}.css`, tokensToCSS(data.tokens))
}
```

---

## Scenario 5: CI/CD Pipeline Integration

Every PR that changes tokens triggers a pipeline that validates, publishes, and generates platform artifacts.

### Example GitHub workflow

```yaml
# .github/workflows/publish-tokens.yml
name: Publish Design Tokens
on:
  push:
    branches: [main]
    paths: [tokens/**]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate DTCG format
        run: npx dtcg-validator tokens/production.json

      - name: Publish to AT Protocol
        run: |
          node scripts/publish.mjs << EOF
            const { Agent } = require('@atproto/api')
            const tokens = require('./tokens/production.json')
            const agent = new Agent({ service: '${{ secrets.ATP_SERVICE }}' })
            await agent.login({
              identifier: '${{ secrets.ATP_IDENTIFIER }}',
              password: '${{ secrets.ATP_PASSWORD }}'
            })
            await agent.com.atproto.repo.putRecord({
              repo: agent.session?.did,
              collection: 'org.designtxt.tokenCollection',
              rkey: 'production',
              record: {
                $type: 'org.designtxt.tokenCollection',
                name: 'Production Tokens',
                ...tokens
              }
            })
          EOF

      - name: Generate platform artifacts
        run: |
          node scripts/generate-css.mjs
          node scripts/generate-android.mjs
          node scripts/generate-swift.mjs

      - name: Publish packages
        run: npm publish ./packages/design-tokens
```

### Tagging releases with record keys

Use meaningful record keys to organize versions:

```
org.designtxt.tokenCollection/latest       # always the current release
org.designtxt.tokenCollection/v1.2.3       # immutable version tag
org.designtxt.tokenCollection/pr-492       # PR preview branch
org.designtxt.tokenCollection/2026Q2       # quarterly snapshot
```

```typescript
// Publish a versioned release
async function publishVersion(version: string, tokens: object) {
  await agent.com.atproto.repo.createRecord({
    repo: session.did,
    collection: 'org.designtxt.tokenCollection',
    rkey: `v${version}`, // e.g. "v1.2.3"
    record: {
      $type: 'org.designtxt.tokenCollection',
      name: `Release ${version}`,
      createdAt: new Date().toISOString(),
      ...tokens
    }
  })
  // Also update the "latest" pointer
  await agent.com.atproto.repo.putRecord({
    repo: session.did,
    collection: 'org.designtxt.tokenCollection',
    rkey: 'latest',
    swapRecord: null,
    record: {
      $type: 'org.designtxt.tokenCollection',
      name: `Release ${version}`,
      createdAt: new Date().toISOString(),
      ...tokens
    }
  })
}
```

---

## Access Patterns Cheat Sheet

| What you want | Endpoint | Key parameters |
|---|---|---|
| Get every token for a brand | `getTokens` | `ref` = AT-URI of the collection |
| Get a subtree (e.g. only colors) | `getTokens` | `ref` + `path=/color` |
| Get tokens with aliases resolved | `getTokens` | `ref` + `resolveReferences=true` |
| Get tokens for a specific theme | `resolveTokens` | `resolverRef` + `input: { theme: "dark" }` |
| Get tokens for a breakpoint | `resolveTokens` | `resolverRef` + `input: { viewport: "mobile" }` |
| Combine brand + theme + breakpoint | `resolveTokens` | `resolverRef` + `input: { brand, theme, viewport }` |

---

## Vocabulary Reference

| DTCG term | What it means on the ground |
|-----------|----------------------------|
| `$type` | The kind of token: `color`, `dimension`, `typography`, `shadow`, `border`, `gradient`, `transition`, `strokeStyle`, `number`, `duration`, `cubicBezier`, `fontFamily`, `fontWeight` |
| `$value` | The actual design decision. Use the typed structures from `org.designtxt.defs`. |
| `$description` | Why this token exists. Document the design rationale inline. |
| `{path.to.token}` | An alias reference to another token. Resolved server-side when you pass `resolveReferences=true`. |
| `$extensions` | Vendor-specific metadata. Put tooling IDs, Figma node refs, Jira ticket links here. |
| `$deprecated` | Mark a token as deprecated (boolean or a string explaining the migration path). |
| `$extends` | Group inheritance — one group can extend another's members. |
| string-encoded floats | AT Protocol has no float type. Store `0.4` as `"0.4"`. Store `16.5` as `"16.5"`. Every DTCG numeric value is a string in the lexicon. Integer font weights (300, 400, 700) are the only exception — they stay as integers. |
| metadata fields | `tokenCollection` records can have `name`, `description`, and `createdAt` at the root. They sit alongside your token tree without conflicting — DTCG group names don't start with lowercase letters that match these reserved words in practice. |
