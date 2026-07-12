import { parseATUri, resolveDID, fetchRecord, extractSubtree, flattenTokens, resolveRefs, xrpcError, jsonResponse } from './helpers'

interface GetTokensParams {
  ref: string
  path?: string
  resolveReferences?: boolean
}

export async function handleGetTokens(params: GetTokensParams): Promise<Response> {
  if (!params.ref) return xrpcError('InvalidRequest', 'Missing required parameter: ref', 400)

  let atUri
  try {
    atUri = parseATUri(params.ref)
  } catch (e: any) {
    return xrpcError('InvalidRequest', e.message, 400)
  }

  let info
  try {
    info = await resolveDID(atUri.did)
  } catch (e: any) {
    return xrpcError('InternalError', `DID resolution failed: ${e.message}`, 502)
  }

  let record
  try {
    record = await fetchRecord(info.pds, atUri.did, atUri.collection, atUri.rkey)
  } catch (e: any) {
    return xrpcError('RecordNotFound', `Record not found: ${params.ref}`, 404)
  }

  let tokens = record.value

  if (params.resolveReferences) {
    const tokenMap = new Map<string, any>()
    flattenTokens(tokens, null, '', tokenMap)
    tokens = resolveRefs(tokens, tokenMap)
  }

  if (params.path) {
    try {
      tokens = extractSubtree(tokens, params.path)
    } catch (e: any) {
      return xrpcError('InvalidRequest', `Path not found: ${params.path}`, 400)
    }
  }

  return jsonResponse({
    tokens,
    resolvedAt: new Date().toISOString()
  })
}
