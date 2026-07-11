#!/usr/bin/env node
import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AtpAgent } from '@atproto/api'
import { watch } from 'chokidar'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {
  ATP_USERNAME,
  ATP_PASSWORD,
  ATP_PDS_HOST,
  ATP_RECORD_KEY,
  TERRAZZO_TOKEN_DIR,
  SYNC_INTERVAL,
} = process.env

const TOKEN_DIR = resolve(TERRAZZO_TOKEN_DIR || 'tokens')
const RECORD_KEY = ATP_RECORD_KEY || 'terrazzo'

if (!ATP_USERNAME || !ATP_PASSWORD || !ATP_PDS_HOST) {
  console.error('Missing required env vars: ATP_USERNAME, ATP_PASSWORD, ATP_PDS_HOST')
  process.exit(1)
}
const POLL_MS = parseInt(SYNC_INTERVAL || '30000', 10)
const STATE_FILE = resolve(__dirname, '.sync-state.json')

let agent
let localVersion = 0

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

function parseNumbers(value) {
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) && isFinite(Number(value)))
    return Number(value)
  if (Array.isArray(value)) return value.map(parseNumbers)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const [k, v] of Object.entries(value)) result[k] = parseNumbers(v)
    return result
  }
  return value
}

/* ------------------------------------------------------------------ */
/*  Sync state                                                        */
/* ------------------------------------------------------------------ */

function loadState() {
  if (!existsSync(STATE_FILE)) return { remoteCid: null }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

/* ------------------------------------------------------------------ */
/*  Read / write tokens                                               */
/* ------------------------------------------------------------------ */

function readLocalTokens() {
  const files = ['.tokens.json', 'tokens.json']
  for (const f of files) {
    const path = resolve(TOKEN_DIR, f)
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8'))
  }
  // fallback: treat TOKEN_DIR as a direct file path
  if (existsSync(TOKEN_DIR) && TOKEN_DIR.endsWith('.json'))
    return JSON.parse(readFileSync(TOKEN_DIR, 'utf-8'))
  throw new Error(`No token file found in ${TOKEN_DIR}`)
}

function writeLocalTokens(data) {
  const path = resolve(TOKEN_DIR, '.tokens.json')
  writeFileSync(path, JSON.stringify(data, null, 2))
}

/* ------------------------------------------------------------------ */
/*  AT Protocol operations                                            */
/* ------------------------------------------------------------------ */

async function publishToAtproto(tokens) {
  const record = {
    $type: 'org.designtxt.tokenCollection',
    name: tokens.name || 'Terrazzo Sync',
    description: tokens.description || `Synced from ${TOKEN_DIR}`,
    ...stringifyNumbers(tokens),
  }

  const existing = await agent.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'org.designtxt.tokenCollection',
    rkey: RECORD_KEY,
  }).catch(() => null)

  if (existing) {
    const res = await agent.com.atproto.repo.putRecord({
      repo: agent.session.did,
      collection: 'org.designtxt.tokenCollection',
      rkey: RECORD_KEY,
      swapRecord: existing.cid,
      record,
    })
    return res.cid
  } else {
    const res = await agent.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection: 'org.designtxt.tokenCollection',
      rkey: RECORD_KEY,
      record,
    })
    return res.cid
  }
}

async function fetchRemoteCid() {
  const res = await agent.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'org.designtxt.tokenCollection',
    rkey: RECORD_KEY,
  }).catch(() => null)
  if (!res) return null
  return { cid: res.cid, data: res.value }
}

/* ------------------------------------------------------------------ */
/*  Sync operations                                                   */
/* ------------------------------------------------------------------ */

async function pushLocal() {
  const tokens = readLocalTokens()
  const cid = await publishToAtproto(tokens)
  const state = loadState()
  state.remoteCid = cid
  saveState(state)
  localVersion++
  console.log(`[push] published ${RECORD_KEY} (${cid.slice(0, 12)}…)`)
}

async function pullRemote() {
  const remote = await fetchRemoteCid()
  if (!remote) return
  const state = loadState()
  if (remote.cid === state.remoteCid) return // already in sync

  // remote changed — pull to local files
  const tokens = parseNumbers(remote.data)
  writeLocalTokens(tokens)
  state.remoteCid = remote.cid
  saveState(state)
  console.log(`[pull] synced from ${RECORD_KEY} (${remote.cid.slice(0, 12)}…)`)
}

async function sync() {
  const state = loadState()
  const remote = await fetchRemoteCid()

  if (!remote) {
    // no remote yet — push local
    return pushLocal()
  }

  if (remote.cid === state.remoteCid) {
    // no change on either side
    return
  }

  // CID differs — check if local has changed
  if (localVersion > 0) {
    // local and remote both changed — last-write-wins by polling cycle
    console.log('[sync] conflict detected — last-write-wins')
  }

  // try push first (local changes are more recent in a dev workflow)
  if (localVersion > 0) {
    const cid = await publishToAtproto(readLocalTokens())
    state.remoteCid = cid
    saveState(state)
    localVersion = 0
    console.log(`[sync] pushed update (${cid.slice(0, 12)}…)`)
  } else {
    await pullRemote()
  }
}

/* ------------------------------------------------------------------ */
/*  File watcher                                                      */
/* ------------------------------------------------------------------ */

function startWatcher() {
  const watcher = watch(TOKEN_DIR, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\./,
  })

  watcher.on('change', async (path) => {
    console.log(`[watch] ${path} changed`)
    try {
      await pushLocal()
    } catch (err) {
      console.error(`[watch] push failed:`, err.message)
    }
  })

  watcher.on('ready', () => {
    console.log(`[watch] watching ${TOKEN_DIR}`)
  })

  return watcher
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  agent = new AtpAgent({ service: ATP_PDS_HOST })
  await agent.login({ identifier: ATP_USERNAME, password: ATP_PASSWORD })
  console.log(`[auth] logged in as ${ATP_USERNAME}`)

  // initial push
  await pushLocal()

  // watch local files
  const watcher = startWatcher()

  // poll remote periodically
  const poller = setInterval(() => {
    sync().catch((err) => console.error('[poll] sync failed:', err.message))
  }, POLL_MS)

  process.on('SIGINT', () => {
    watcher.close()
    clearInterval(poller)
    process.exit(0)
  })

  console.log(`[sync] running (poll every ${POLL_MS / 1000}s)`)

  // immediate remote check
  await pullRemote()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
