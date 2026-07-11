import { handleGetTokens } from './tokens'
import { handleResolveTokens } from './resolver'
import { xrpcError, jsonResponse } from './helpers'

export interface Env {}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    // Health check
    if (url.pathname === '/') {
      return jsonResponse({ status: 'ok', endpoints: ['getTokens', 'resolveTokens'] })
    }

    // Route XRPC endpoints
    if (url.pathname === '/xrpc/org.designtxt.getTokens') {
      const params = {
        ref: url.searchParams.get('ref') || '',
        path: url.searchParams.get('path') || undefined,
        resolveReferences: url.searchParams.get('resolveReferences') === 'true'
      }
      return handleGetTokens(params)
    }

    if (url.pathname === '/xrpc/org.designtxt.resolveTokens' && request.method === 'POST') {
      try {
        const body = await request.json() as any
        return handleResolveTokens({
          resolverRef: body.resolverRef || '',
          input: body.input || {},
          resolveReferences: body.resolveReferences
        })
      } catch {
        return xrpcError('InvalidRequest', 'Invalid JSON body', 400)
      }
    }

    return xrpcError('UnknownEndpoint', `Unknown endpoint: ${url.pathname}`, 404)
  }
}
