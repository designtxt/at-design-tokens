# Design Tokens in the Atmosphere

> [!CAUTION]
> This project is an experimental proof of concept, and most of the docs and code are AI-generated. Proceed at your own risk.

Design tokens are how your team ships design decisions to code. Colors, spacing, type scales, shadows — they power every screen your users see. But keeping them in sync across products and platforms is a mess of branch confusion, stale copies, and "which file has the latest colors?"

**at-design-tokens** is a standard way to publish your design tokens on the AT Protocol network (the same open protocol behind Bluesky). Publish your token file once to a permanent address. Your web app, iOS app, design tools, and CI all fetch from the same source, resolved for the right brand, theme, and breakpoint. No vendor lock-in, no "check the README for the right branch."

Built on the [DTCG Design Tokens](https://www.designtokens.org/TR/2025.10/) format, the open industry standard for describing design decisions in code.

**Try it live:** [Token Viewer →](https://designtxt.org/atproto) — browse token collections by `at://` URI, no install needed.

**Start here:** [Design Team Usage Guide →](./USAGE.md) — scenarios for single brands, multi-brand design systems, theming, breakpoints, and CI.

> [!NOTE]
> The `org.designtxt` namespace is not a solid proposal set in stone, I just had the domain registered a while ago for stuff like this.

---

## Lexicon Index

| NSID                            | Kind        | Purpose                                                                             |
|---------------------------------|-------------|-------------------------------------------------------------------------------------|
| `org.designtxt.defs`            | definitions | Reusable value-type schemas for all DTCG token types                                |
| `org.designtxt.tokenCollection` | record.     | A DTCG-format design tokens file stored as an atproto record                        |
| `org.designtxt.resolver`        | record      | A resolver document for multi-context token resolution (theming, breakpoints, etc.) |
| `org.designtxt.getTokens`       | query       | Retrieve a `tokenCollection` (optionally at a sub-path, with alias resolution)      |
| `org.designtxt.resolveTokens`   | procedure   | Resolve a resolver document against contextual inputs                               |

Full reference: [`LEXICON_REFERENCE.md`](./LEXICON_REFERENCE.md) | Usage guide: [`USAGE.md`](./USAGE.md)

---

## Design Rationale

### Coarse records, not per-token granularity

DTCG tokens are authored as hierarchical JSON files (groups containing tokens containing sub-groups). It would be appealing to model each individual token as a separate atproto record -- Google could publish `at://material.io/org.designtxt.token/color.primary.40` and every downstream team could reference it by URI. That pattern (one record per atom, composable by reference) is exactly how atproto handles likes, follows, and reposts, and it would be elegant for tokens too.

The coarse `tokenCollection` record was chosen instead for three reasons:

**1. DTCG's tree structure is not a flat set of independent atoms.** Tokens inherit `$type` from their parent group, groups extend other groups via `$extends`, and `$root` tokens sit inside groups alongside children. All of these are tree operations -- parent-child scope, inheritance chains, sibling enumeration. Flattening to individual records loses that structure. You would need a separate `group` record type to reconstruct the hierarchy, and every resolver would have to walk the tree at resolution time instead of merging JSON blobs.

**2. Record count grows without bound.** A `typography` composite token alone contains `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing` -- each a structured value. Material Design's full token set is roughly 6,000 entries. A publish batch that creates or updates thousands of records hits PDS throughput limits, turning every CI merge into a multi-minute operation.

**3. DTCG tooling works on files, not on individual records.** Style Dictionary, Token Studio, Terrazzo -- every tool in the ecosystem reads and writes DTCG-format JSON files. A per-token record model would force every tool to reconstruct the tree from individual records before doing anything useful. The coarse model maps 1:1: a `tokenCollection` *is* a DTCG file, importable and exportable with zero transformation.

**If cross-org token publishing becomes the dominant use case,** nothing prevents adding a finer-grained `org.designtxt.token` record type later. At that point `tokenCollection` could be redefined as a container that composes both inline trees and `$ref` references to external token records. The current design deliberately does not close that door -- it just didn't make sense as the foundation.

Applications that need to query individual tokens within a collection use the `getTokens` endpoint with a `path` parameter (JSON Pointer into the tree).

### Unknown payloads for recursive structures

The DTCG format is inherently recursive (groups nest arbitrarily). ATProto's type system does not support `additionalProperties` or recursive type references, so the root payload of `tokenCollection` and `resolver` records is typed as `unknown`. Application-level validation should use the DTCG 2025.10 JSON Schema.

### Why no input modifiers on getTokens

The `getTokens` query intentionally does **not** accept resolver-style inputs. Resolution is a multi-step process (input validation, ordering, alias resolution) that belongs in a `procedure`. The `resolveTokens` procedure handles that. `getTokens` is a simple fetch, optionally with `resolveReferences=true` to resolve alias chains within the stored document.

---

## AT Protocol Data Model Constraints

The AT Protocol data model supports integer, boolean, string, bytes, and link (CID) types -- but **not** floating-point numbers. All fractional numeric values in this lexicon (color components, dimension values, durations, bezier points) are stored as **strings**. Tools must parse these strings into native floats and serialize floats back into strings.

| DTCG native | atproto encoding | Example |
|---|---|---|
| `0.4` (number) | `"0.4"` (string) | Color component |
| `16.5` (number) | `"16.5"` (string) | Dimension value |
| `150` (number) | `"150"` (string) | Duration value |
| `0.314159` (number) | `"0.314159"` (string) | Generic number token |
| `[1, 0.5, 0.2, 0.3]` | `["1", "0.5", "0.2", "0.3"]` | Cubic bezier points |

---

## Sample Implementations

The `integrations/` directory contains sample scripts that publish design tokens from common DTCG tools to an atproto PDS:

| Integration | Type | Description |
|-------------|------|-------------|
| [`integrations/style-dictionary/`](./integrations/style-dictionary/) | publish-only | Reads Style Dictionary output JSON and publishes as a `tokenCollection` record |
| [`integrations/tokens-studio/`](./integrations/tokens-studio/) | publish-only | Reads Tokens Studio exports (DTCG-native, legacy, or multi-file themes) and publishes as a `tokenCollection` record |
| [`integrations/terrazzo/`](./integrations/terrazzo/) | two-way sync | Daemon that watches local Terrazzo token files, publishes changes to atproto, and polls the PDS for remote updates |

---

## Further Reading

- **[`LEXICON_REFERENCE.md`](./LEXICON_REFERENCE.md)** -- Full reference for every type, record, query, and procedure in the lexicon set
- **[`USAGE.md`](./USAGE.md)** -- Practical guide covering single-brand setups, multi-brand design systems, theming, breakpoints, CI/CD, and access patterns
