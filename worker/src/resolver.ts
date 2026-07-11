import { parseATUri, resolveDID, fetchRecord, flattenTokens, resolveRefs, xrpcError, jsonResponse } from './helpers'

interface ResolveTokensInput {
  resolverRef: string
  input: Record<string, string>
  resolveReferences?: boolean
}

interface ResolverRecord {
  version: string
  name?: string
  description?: string
  sets?: Record<string, { sources: string[]; description?: string }>
  modifiers?: Record<string, { contexts: Record<string, string[]>; default?: string; description?: string }>
  resolutionOrder: Array<{ $ref: string } | { name: string; type: 'set' | 'modifier'; sources?: string[] }>
}

async function fetchTokenSet(pds: string, did: string, sources: string[]): Promise<Map<string, any>> {
  const merged = new Map<string, any>()
  for (const sourceUri of sources) {
    const uri = parseATUri(sourceUri)
    const record = await fetchRecord(pds, uri.did, uri.collection, uri.rkey)
    const tokens = new Map<string, any>()
    flattenTokens(record.value, null, '', tokens)
    for (const [k, v] of tokens) merged.set(k, v)
  }
  return merged
}

export async function handleResolveTokens(input: ResolveTokensInput): Promise<Response> {
  if (!input.resolverRef) return xrpcError('InvalidRequest', 'Missing required parameter: resolverRef', 400)
  if (!input.input || typeof input.input !== 'object') return xrpcError('InvalidRequest', 'Missing required parameter: input', 400)

  let atUri
  try {
    atUri = parseATUri(input.resolverRef)
  } catch (e: any) {
    return xrpcError('InvalidRequest', e.message, 400)
  }

  let info
  try {
    info = await resolveDID(atUri.did)
  } catch (e: any) {
    return xrpcError('InternalError', `DID resolution failed: ${e.message}`, 502)
  }

  let resolverRecord: ResolverRecord
  try {
    const record = await fetchRecord(info.pds, atUri.did, atUri.collection, atUri.rkey)
    resolverRecord = record.value
  } catch (e: any) {
    return xrpcError('ResolverNotFound', `Resolver not found: ${input.resolverRef}`, 404)
  }

  if (resolverRecord.version !== '2025.10') {
    return xrpcError('InvalidInput', `Unsupported resolver version: ${resolverRecord.version}`, 400)
  }

  // Validate input against modifiers
  if (resolverRecord.modifiers) {
    for (const [modName, modDef] of Object.entries(resolverRecord.modifiers)) {
      if (modName in input.input) {
        const value = input.input[modName]
        if (!modDef.contexts[value]) {
          return xrpcError('InvalidInput', `Unknown context '${value}' for modifier '${modName}'`, 400)
        }
      } else if (!modDef.default) {
        return xrpcError('InvalidInput', `Missing required modifier: ${modName}`, 400)
      }
    }
  }

  // Walk resolutionOrder and build merged token set
  const resolvedTokens = new Map<string, any>()

  for (const entry of resolverRecord.resolutionOrder) {
    if ('$ref' in entry) {
      const refName = entry.$ref

      // Check if it's a set
      if (resolverRecord.sets?.[refName]) {
        const setDef = resolverRecord.sets[refName]
        const setTokens = await fetchTokenSet(info.pds, atUri.did, setDef.sources)
        for (const [k, v] of setTokens) resolvedTokens.set(k, v)
        continue
      }

      // Check if it's a modifier
      if (resolverRecord.modifiers?.[refName]) {
        const modDef = resolverRecord.modifiers[refName]
        const contextValue = input.input[refName] || modDef.default
        if (contextValue && modDef.contexts[contextValue]) {
          const modTokens = await fetchTokenSet(info.pds, atUri.did, modDef.contexts[contextValue])
          for (const [k, v] of modTokens) resolvedTokens.set(k, v)
        }
        continue
      }

      return xrpcError('InvalidInput', `Unknown reference in resolutionOrder: ${refName}`, 400)
    }

    // Inline definition (name + type + sources)
    if (entry.type === 'set' && entry.sources) {
      const setTokens = await fetchTokenSet(info.pds, atUri.did, entry.sources)
      for (const [k, v] of setTokens) resolvedTokens.set(k, v)
    }
  }

  // Convert map to flat object
  const result: Record<string, any> = {}
  for (const [k, v] of resolvedTokens) result[k] = v

  // Resolve references if requested (default true)
  const shouldResolve = input.resolveReferences !== false
  const output = shouldResolve ? resolveRefs(result, resolvedTokens) : result

  return jsonResponse({
    tokens: output,
    input: input.input,
    resolvedAt: new Date().toISOString()
  })
}
