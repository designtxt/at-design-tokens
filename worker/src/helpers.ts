// AT-URI parsing: at://<did>/<collection>/<rkey>

export interface ATUri {
  did: string
  collection: string
  rkey: string
}

export function parseATUri(uri: string): ATUri {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/)
  if (!match) throw new Error(`Invalid AT-URI: ${uri}`)
  return { did: match[1], collection: match[2], rkey: match[3] }
}

// DID resolution: did:plc → plc.directory, did:web → .well-known/did.json

export interface DIDInfo {
  did: string
  pds: string
}

export async function resolveDID(did: string): Promise<DIDInfo> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${did}`)
    if (!res.ok) throw new Error(`DID resolution failed: ${res.status}`)
    const doc = await res.json() as any
    const pds = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint
    if (!pds) throw new Error('No PDS in DID document')
    return { did, pds }
  }
  if (did.startsWith('did:web:')) {
    const domain = did.slice(8)
    const res = await fetch(`https://${domain}/.well-known/did.json`)
    if (!res.ok) throw new Error(`DID web resolution failed: ${res.status}`)
    const doc = await res.json() as any
    const pds = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint
    if (!pds) throw new Error('No PDS in DID document')
    return { did, pds }
  }
  throw new Error(`Unsupported DID method: ${did}`)
}

// Fetch a record from a PDS

export async function fetchRecord(pds: string, did: string, collection: string, rkey: string): Promise<any> {
  const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`getRecord failed: ${res.status}`)
  return res.json()
}

// JSON Pointer subtree extraction

export function extractSubtree(data: any, path: string): any {
  if (!path || path === '/') return data
  const parts = path.split('/').filter(Boolean)
  let current = data
  for (const part of parts) {
    if (current == null || typeof current !== 'object') throw new Error(`Path not found: ${path}`)
    current = current[part]
  }
  return current
}

// Token helpers

export function isTokenNode(n: any): boolean {
  return n && typeof n === 'object' && !Array.isArray(n) && ('$value' in n)
}

export function flattenTokens(obj: any, inheritedType: string | null, path: string, tokens: Map<string, any>): void {
  if (!obj || typeof obj !== 'object') return
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$') || key === 'name' || key === 'description' || key === 'createdAt') continue
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue
    const type = (val as any).$type || inheritedType || null
    const fullPath = path ? `${path}.${key}` : key
    if (isTokenNode(val)) tokens.set(fullPath, val)
    if (!('$value' in val)) flattenTokens(val, type, fullPath, tokens)
  }
}

// Reference resolution: replace {path} strings with resolved values

const REF_PATTERN = /^\{[\w.]+\}$/

export function resolveRefs(value: any, tokenMap: Map<string, any>): any {
  if (typeof value === 'string' && REF_PATTERN.test(value)) {
    const refPath = value.slice(1, -1)
    const target = tokenMap.get(refPath)
    if (target && target.$value !== undefined) return resolveRefs(target.$value, tokenMap)
    return value
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return value.map(v => resolveRefs(v, tokenMap))
    const result: any = {}
    for (const [k, v] of Object.entries(value)) result[k] = resolveRefs(v, tokenMap)
    return result
  }
  return value
}

// Error response helper

export interface XRPCError {
  error: string
  message: string
}

export function xrpcError(error: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

// Success response helper

export function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
