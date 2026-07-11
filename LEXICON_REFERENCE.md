# Lexicon Reference

Full type, record, endpoint, and coverage reference for the `org.designtxt` lexicon set.

---

## `org.designtxt.defs`

Shared type definitions reused by the other lexicons. This file has no `main` definition -- it exists only to be referenced.

### Scalar types

**`colorValue`** (object)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `colorSpace` | string | yes | One of 14 supported color spaces |
| `components` | string[] | yes | Positional components - each is a string-encoded float or `"none"` |
| `alpha` | string | no | Opacity as string-encoded float (`"0"`-`"1"`), defaults to `"1"` |
| `hex` | string | no | 6-digit CSS hex fallback, e.g. `#ff00ff` |

Supported color spaces: `srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`

**`dimensionValue`** (object)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | String-encoded float (e.g. `"16.5"`, `"100"`) |
| `unit` | string | yes | CSS unit: `px`, `rem`, `em`, `pt`, `%`, `vw`, `vh`, etc. |

**`durationValue`** (object)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | string | yes | String-encoded float (e.g. `"300.5"`, `"150"`) |
| `unit` | string | yes | `ms` or `s` |

**`cubicBezierValue`** (array of 4 strings) -- Exactly 4 string-encoded floats: `["x1", "y1", "x2", "y2"]`

**`numberValue`** (string) -- A numeric value encoded as a string (e.g. `"42"`, `"3.14159"`).

**`fontFamilyValue`** (string) -- Font family name or comma-separated fallback string.

**`fontWeightValue`** (union of `fontWeightKeyword` | `fontWeightNumber`)
- Keyword: `thin`, `light`, `normal`, `medium`, `bold`, `black`, `extraBlack`, etc.
- Number: integer 1--1000 (fits in atproto's integer type)

### Composite types

**`strokeStyleValue`** (object) -- `dashArray` (string[]), `lineCap` (string), `lineJoin` (string), `miterLimit` (string-encoded float)

**`borderValue`** (object) -- `width` (dimensionValue), `style` (string), `color` (colorValue)

**`transitionValue`** (object) -- `duration` (durationValue), `delay` (durationValue), `timingFunction` (cubicBezierValue)

**`shadowValue`** (object) -- `color` (colorValue), `offsetX`/`offsetY`/`blur`/`spread` (dimensionValue), `inset` (boolean)

**`gradientValue`** (object) -- `type` (string), `angles` (string[]), `colorStops` (colorStop[])

**`colorStop`** (object) -- `color` (colorValue), `position` (string-encoded float)

**`typographyValue`** (object) -- `fontFamily` (string[]), `fontWeight` (fontWeightValue), `fontSize` (dimensionValue), `lineHeight` (string), `letterSpacing`/`paragraphSpacing`/`paragraphIndent` (dimensionValue), `textCase` (string), `textDecoration` (string)

---

## `org.designtxt.tokenCollection` (record)

Stores a complete DTCG-format design tokens document as a single atproto record.

```
at://<did>/org.designtxt.tokenCollection/<record-key>
```

**Record key**: `any` -- authors choose their own naming convention (e.g. `my-tokens`, `brand`, `2025Q3`).

### Fields (at root level)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Human-readable name (e.g. "Brand Tokens", "My Design System Q3") |
| `description` | string | no | Optional description of the collection's purpose or scope |
| `createdAt` | string (datetime) | no | Timestamp when created |

All other root-level keys are the token tree itself (tokens or groups per DTCG format). Metadata and token keys coexist at the same level -- atproto ignores unexpected fields on objects, so the token tree passes through freely.

### Example

```json
{
  "$type": "org.designtxt.tokenCollection",
  "name": "Brand Tokens",
  "description": "Primary brand color and spacing tokens",
  "createdAt": "2026-07-10T12:00:00.000Z",
  "color": {
    "$type": "color",
    "brand": {
      "primary": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": ["0", "0.4", "0.8"],
          "hex": "#0066cc"
        },
        "$description": "Primary brand color"
      }
    },
    "semantic": {
      "success": { "$value": "{color.brand.primary}" },
      "danger": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": ["0.8", "0", "0.1"],
          "hex": "#cc001a"
        }
      }
    }
  },
  "spacing": {
    "$type": "dimension",
    "small": { "$value": { "value": "8", "unit": "px" } },
    "medium": { "$value": { "value": "16", "unit": "px" } },
    "large": { "$value": { "value": "32", "unit": "px" } }
  }
}
```

---

## `org.designtxt.resolver` (record)

Stores a DTCG Resolver 2025.10 document for multi-context token resolution (light/dark mode, breakpoints, accessibility modes).

```
at://<did>/org.designtxt.resolver/<record-key>
```

**Record key**: `any`

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | string | no | JSON Schema URL |
| `name` | string | no | Human-readable name |
| `version` | string | **yes** | Must be `"2025.10"` |
| `description` | string | no | Human-readable description |
| `$extensions` | object | no | Vendor extensions |
| `$defs` | object | no | JSON Schema defs for bundling |
| `sets` | object | no | Map of named token sources |
| `modifiers` | object | no | Map of contextual modifier definitions |
| `resolutionOrder` | array | **yes** | Ordered resolution cascade |

### Example

```json
{
  "$type": "org.designtxt.resolver",
  "version": "2025.10",
  "name": "My App Tokens",
  "sets": {
    "foundation": {
      "sources": [{ "$ref": "at://did:plc:abc123/org.designtxt.tokenCollection/foundation" }]
    }
  },
  "modifiers": {
    "theme": {
      "description": "Color theme",
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

---

## `org.designtxt.getTokens` (query)

XRPC Query to retrieve a `tokenCollection` record.

**Endpoint**: `GET /xrpc/org.designtxt.getTokens`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ref` | string (at-uri) | **yes** | AT-URI of a `tokenCollection` record |
| `path` | string | no | JSON Pointer to a subtree (e.g. `/color/brand`) |
| `resolveReferences` | boolean | no | Resolve `{token.name}` aliases inline (default: false) |

### Response

```json
{
  "tokens": { "color": { "brand": { "primary": { ... } } } },
  "resolvedAt": "2026-07-10T12:00:00.000Z"
}
```

### Examples

Fetch the full token set:

```
GET /xrpc/org.designtxt.getTokens?ref=at://did:plc:abc123/org.designtxt.tokenCollection/my-tokens
```

Fetch a sub-tree with alias resolution:

```
GET /xrpc/org.designtxt.getTokens?ref=at://...&path=/color/semantic&resolveReferences=true
```

---

## `org.designtxt.resolveTokens` (procedure)

XRPC Procedure to resolve a resolver document against contextual inputs.

**Endpoint**: `POST /xrpc/org.designtxt.resolveTokens`

### Input

```json
{
  "resolverRef": "at://did:plc:abc123/org.designtxt.resolver/my-resolver",
  "input": {
    "theme": "dark",
    "size": "compact"
  },
  "resolveReferences": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resolverRef` | string (at-uri) | **yes** | AT-URI of a `resolver` record |
| `input` | object | **yes** | Modifier context selections (string values only) |
| `resolveReferences` | boolean | no | Resolve aliases in output (default: true) |

### Response

```json
{
  "tokens": { "color": { "brand": { "primary": { ... } } } },
  "input": { "theme": "dark", "size": "compact" },
  "resolvedAt": "2026-07-10T12:00:00.000Z"
}
```

### Errors

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `ResolverNotFound` | 404 | Resolver record not found |
| `InvalidInput` | 400 | Unknown modifier, invalid context value, or missing required modifier |
| `CircularReference` | 422 | Circular reference in resolver or token sources |
| `ResolutionFailed` | 422 | Unresolvable aliases or invalid token values |

---

## DTCG Coverage Map

| DTCG Feature | Lexicon Coverage |
|---|---|
| `$value` with typed values | All 7 scalar types + 6 composite types in `defs` |
| 14 color spaces | All encoded as `knownValues` on `colorValue.colorSpace` |
| `$type` on tokens/groups | Documented; application-validated |
| `$description` | Documented; stored as part of unknown payload |
| `$deprecated` (boolean or string) | Documented; application-validated |
| `$extensions` (vendor namespaces) | Documented; stored as object |
| `$extends` (group inheritance) | Documented; stored in unknown payload |
| `$root` (root tokens) | Documented; stored in unknown payload |
| `{token.name}` alias references | `resolveReferences` parameter on both endpoints |
| Human-readable name on tokenCollection | `name` field at record root |
| JSON Pointer `$ref` | Supported via DTCG spec; application-validated |
| Resolver `sets` | `resolver` record with sources |
| Resolver `modifiers` with contexts | `resolver` record with contexts/default |
| Resolver `resolutionOrder` | `resolver` record, required field |
| Resolver `input` validation | `resolveTokens` procedure with `InvalidInput` error |
| Float-to-string encoding | All fractional values stored as strings; documented encoding strategy |

---

## SDK Usage (TypeScript Example)

```typescript
import { Agent } from '@atproto/api'

const agent = new Agent({ service: 'https://bsky.social' })

// Publish a token collection (floats encoded as strings)
await agent.com.atproto.repo.createRecord({
  repo: agent.session?.did ?? '',
  collection: 'org.designtxt.tokenCollection',
  record: {
    $type: 'org.designtxt.tokenCollection',
    name: 'Brand Tokens',
    description: 'Primary brand tokens for the design system',
    color: {
      brand: {
        primary: {
          $type: 'color',
          $value: {
            colorSpace: 'srgb',
            components: ['0', '0.4', '0.8'],
            hex: '#0066cc'
          }
        }
      }
    }
  }
})

// Retrieve tokens with alias resolution
const { data } = await agent.call(
  'org.designtxt.getTokens',
  {
    ref: 'at://did:plc:abc123/org.designtxt.tokenCollection/my-tokens',
    path: '/color',
    resolveReferences: true
  }
)

// Resolve tokens for dark mode
const { data: resolved } = await agent.call(
  'org.designtxt.resolveTokens',
  {},
  {
    resolverRef: 'at://did:plc:abc123/org.designtxt.resolver/main',
    input: { theme: 'dark', size: 'compact' }
  }
)
```
