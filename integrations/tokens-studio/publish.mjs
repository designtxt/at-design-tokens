#!/usr/bin/env node
import 'dotenv/config'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { AtpAgent } from '@atproto/api'

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const {
  ATP_USERNAME,
  ATP_PASSWORD,
  ATP_PDS_HOST,
  ATP_RECORD_KEY,
  TS_TOKEN_FILE,
  TS_TOKEN_DIR,
} = process.env

const RECORD_KEY = ATP_RECORD_KEY || 'latest'

if (!ATP_USERNAME || !ATP_PASSWORD || !ATP_PDS_HOST) {
  console.error('Missing required env vars: ATP_USERNAME, ATP_PASSWORD, ATP_PDS_HOST')
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/*  Float encoding helpers                                            */
/* ------------------------------------------------------------------ */

function stringifyNumbers(value) {
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(stringifyNumbers)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const [k, v] of Object.entries(value)) result[k] = stringifyNumbers(v)
    return result
  }
  return value
}

/* ------------------------------------------------------------------ */
/*  Read Tokens Studio exports                                        */
/* ------------------------------------------------------------------ */

function readTokenFile(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf-8'))
}

/**
 * Tokens Studio exports can be:
 *   a) Single DTCG JSON file (a flat or grouped token tree)
 *   b) Multiple theme files in a directory (e.g. tokens/$themes.json + tokens/$metadata.json)
 *   c) A single JSON with "$type" at the root or within groups
 *
 * This reader handles all three cases:
 *   1. If TS_TOKEN_FILE is set, read that single file.
 *   2. If TS_TOKEN_DIR is set, scan for JSON files, merge them.
 *   3. If neither, search for a tokens.json or tokens directory.
 */
function resolveTokenTree() {
  let tree = {}

  if (TS_TOKEN_FILE && existsSync(resolve(TS_TOKEN_FILE))) {
    tree = readTokenFile(TS_TOKEN_FILE)
  } else {
    const dir = TS_TOKEN_DIR || 'tokens'
    const dirPath = resolve(dir)
    if (existsSync(dirPath)) {
      if (dirPath.endsWith('.json')) {
        tree = readTokenFile(dirPath)
      } else {
        const entries = readdirSync(dirPath).filter((f) => f.endsWith('.json'))
        for (const entry of entries) {
          const data = readTokenFile(`${dirPath}/${entry}`)
          // name the set after the filename (without .json)
          const setName = entry.replace(/\.json$/, '')
          tree[setName] = data
        }
      }
    } else {
      throw new Error('No token source found. Set TS_TOKEN_FILE or TS_TOKEN_DIR.')
    }
  }

  return tree
}

/* ------------------------------------------------------------------ */
/*  Tokens Studio → DTCG normalization                                */
/* ------------------------------------------------------------------ */

/**
 * Tokens Studio stores "$value" and "$type" differently depending on
 * version. Some exports use the DTCG format natively; older ones nest
 * tokens under "global", "light", etc. and store values as:
 *   { "value": "#0066cc", "type": "color" }
 * instead of DTCG's:
 *   { "$value": { "colorSpace": "srgb", ... }, "$type": "color" }
 *
 * This normalizer handles the most common Tokens Studio export shapes.
 */
function normalizeTokenStudioExport(raw) {
  // If it already looks like a DTCG tree (has $value or nested groups),
  // return as-is.
  if (hasDTCGStructure(raw)) return raw

  // Tokens Studio wraps sets in named buckets: { "global": {...}, "light": {...} }
  // Merge them all together, preferring later sets on conflict.
  const merged = {}
  for (const [setName, setData] of Object.entries(raw)) {
    if (setName.startsWith('$')) continue // skip $metadata, $themes
    for (const [key, token] of Object.entries(setData)) {
      merged[key] = token
    }
  }

  if (hasDTCGStructure(merged)) return merged

  // Last-resort: assume every leaf is { value, type, ... } and convert
  return convertTokenStudioFormat(merged)
}

function hasDTCGStructure(obj) {
  if (obj.$value) return true
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.$value) return true
      if (hasDTCGStructure(v)) return true
    }
  }
  return false
}

function convertTokenStudioFormat(obj) {
  const result = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('value' in val) {
        // Token leaf: { value: "#0066cc", type: "color", ... }
        result[key] = {
          $type: val.type || undefined,
          $value: convertTokenStudioValue(val.value, val.type),
          $description: val.description || undefined,
        }
        // clean up undefined
        if (!result[key].$type) delete result[key].$type
        if (!result[key].$description) delete result[key].$description
      } else {
        result[key] = convertTokenStudioFormat(val)
      }
    } else {
      result[key] = val
    }
  }
  return result
}

function convertTokenStudioValue(value, type) {
  if (type === 'color' && typeof value === 'string') {
    // Tokens Studio often stores colors as hex strings
    const hex = value.startsWith('#') ? value.slice(0, 7) : value
    return {
      colorSpace: 'srgb',
      components: ['0', '0', '0'], // best-effort; hex is the fallback
      hex,
    }
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && type === 'dimension') {
    const match = value.match(/^([\d.]+)(\w+)$/)
    if (match) return { value: match[1], unit: match[2] }
  }
  return value
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  const raw = resolveTokenTree()
  const normalized = normalizeTokenStudioExport(raw)

  const record = {
    $type: 'org.designtxt.tokenCollection',
    name: normalized.name || 'Tokens Studio Export',
    description: normalized.description || `Exported from Tokens Studio`,
    ...stringifyNumbers(normalized),
  }

  const agent = new AtpAgent({ service: ATP_PDS_HOST })
  await agent.login({ identifier: ATP_USERNAME, password: ATP_PASSWORD })

  const existing = await agent.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'org.designtxt.tokenCollection',
    rkey: RECORD_KEY,
  }).catch(() => null)

  if (existing) {
    await agent.com.atproto.repo.putRecord({
      repo: agent.session.did,
      collection: 'org.designtxt.tokenCollection',
      rkey: RECORD_KEY,
      swapRecord: existing.cid,
      record,
    })
    console.log(`Updated ${RECORD_KEY}`)
  } else {
    const { uri } = await agent.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection: 'org.designtxt.tokenCollection',
      rkey: RECORD_KEY,
      record,
    })
    console.log(`Published ${uri}`)
  }
}

main().catch((err) => {
  console.error('Publish failed:', err)
  process.exit(1)
})
