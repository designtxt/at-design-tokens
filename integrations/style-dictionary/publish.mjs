#!/usr/bin/env node
import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { AtpAgent } from '@atproto/api'

const {
  ATP_USERNAME,
  ATP_PASSWORD,
  ATP_PDS_HOST,
  ATP_RECORD_KEY,
  SD_TOKEN_FILE,
} = process.env

const TOKEN_FILE = resolve(SD_TOKEN_FILE || 'tokens.json')
const RECORD_KEY = ATP_RECORD_KEY || 'latest'

if (!ATP_USERNAME || !ATP_PASSWORD || !ATP_PDS_HOST) {
  console.error('Missing required env vars: ATP_USERNAME, ATP_PASSWORD, ATP_PDS_HOST')
  process.exit(1)
}

if (!existsSync(TOKEN_FILE)) {
  console.error(`Token file not found: ${TOKEN_FILE}`)
  process.exit(1)
}

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

async function main() {
  const raw = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'))

  const record = {
    $type: 'org.designtxt.tokenCollection',
    name: raw.name || 'Style Dictionary Tokens',
    description: raw.description || `Published from ${TOKEN_FILE}`,
    ...stringifyNumbers(raw),
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
