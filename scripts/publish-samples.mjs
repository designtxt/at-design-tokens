#!/usr/bin/env node
import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AtpAgent } from '@atproto/api'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const isDryRun = process.argv.includes('--dry-run')

/* ------------------------------------------------------------------ */
/*  Design systems to publish                                          */
/* ------------------------------------------------------------------ */

const SYSTEMS = [
  { id: 'figma-sds', name: 'Figma Simple Design System' },
  { id: 'ibm-carbon', name: 'IBM Carbon' },
  { id: 'github-primer', name: 'GitHub Primer' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function findPackageRoot(name) {
  let dir = ROOT
  while (dir !== '/') {
    const pkg = resolve(dir, 'node_modules', name, 'package.json')
    if (existsSync(pkg)) return resolve(dir, 'node_modules', name)
    dir = resolve(dir, '..')
  }
  throw new Error(`package not found: ${name} (install with: npm install)`)
}

function readJSON(p) {
  return JSON.parse(readFileSync(p, 'utf-8'))
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(target, source) {
  const out = { ...target }
  for (const [k, v] of Object.entries(source)) {
    if (isObject(v) && isObject(out[k])) {
      out[k] = deepMerge(out[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

function stringifyFloats(value) {
  if (typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(stringifyFloats)
  }
  if (isObject(value)) {
    const result = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = stringifyFloats(v)
    }
    return result
  }
  return value
}

/* ------------------------------------------------------------------ */
/*  Resolve a single design system's token tree                        */
/* ------------------------------------------------------------------ */

function resolveTokens(baseDir, resolver) {
  let tree = {}

  for (const entry of resolver.resolutionOrder) {
    const ref = entry.$ref
    if (!ref || !ref.startsWith('#/')) continue

    const parts = ref.slice(2).split('/')
    const kind = parts[0] // "sets" or "modifiers"
    const name = parts[1]

    let sources = []

    if (kind === 'sets') {
      const set = resolver.sets?.[name]
      sources = set?.sources ?? []
    } else if (kind === 'modifiers') {
      const modifier = resolver.modifiers?.[name]
      const ctx = modifier?.default
      if (ctx !== undefined) {
        sources = modifier.contexts?.[ctx] ?? []
      }
    }

    for (const source of sources) {
      const srcRef = source.$ref
      if (!srcRef) continue

      if (srcRef.startsWith('./')) {
        const filePath = resolve(baseDir, srcRef)
        const data = readJSON(filePath)
        tree = deepMerge(tree, data)
      } else if (srcRef.startsWith('#')) {
        // internal $ref — skip for resolution
      }
    }
  }

  return tree
}

/* ------------------------------------------------------------------ */
/*  Build a tokenCollection record for one design system               */
/* ------------------------------------------------------------------ */

function buildRecord(systemId, systemName, tokens) {
  const encoded = stringifyFloats(tokens)
  return {
    $type: 'org.designtxt.tokenCollection',
    name: systemName,
    description: `DTCG design tokens for ${systemName}, sourced from dtcg-examples.`,
    createdAt: new Date().toISOString(),
    ...encoded,
  }
}

/* ------------------------------------------------------------------ */
/*  Publish to AT Protocol                                             */
/* ------------------------------------------------------------------ */

async function publishRecord(agent, systemId, record) {
  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.session?.did ?? '',
    collection: 'org.designtxt.tokenCollection',
    rkey: systemId,
    record,
  })
  return response.uri
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const pkgRoot = findPackageRoot('dtcg-examples')

  const records = {}

  for (const { id, name } of SYSTEMS) {
    const resolverFile = resolve(pkgRoot, `${id}.resolver.json`)
    const resolver = readJSON(resolverFile)
    const baseDir = dirname(resolverFile)
    const tokens = resolveTokens(baseDir, resolver)
    const record = buildRecord(id, name, tokens)
    records[id] = record
  }

  if (isDryRun) {
    process.stdout.write(JSON.stringify(records, null, 2) + '\n')
    return
  }

  const { ATP_USERNAME, ATP_PASSWORD, ATP_PDS_HOST } = process.env
  if (!ATP_USERNAME || !ATP_PASSWORD || !ATP_PDS_HOST) {
    console.error('Missing required env vars for publish mode.')
    console.error('  ATP_USERNAME, ATP_PASSWORD, ATP_PDS_HOST')
    console.error('')
    console.error('Use --dry-run to preview the records without publishing.')
    process.exit(1)
  }

  const agent = new AtpAgent({ service: ATP_PDS_HOST })
  await agent.login({ identifier: ATP_USERNAME, password: ATP_PASSWORD })

  for (const { id, name } of SYSTEMS) {
    const uri = await publishRecord(agent, id, records[id])
    console.log(` 🟢 ${id} -> ${uri}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
