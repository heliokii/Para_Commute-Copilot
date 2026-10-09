import { planOptions, planRoute } from './plan.ts'
import type { RouterRequest, RouterResponse } from './protocol.ts'
import type { RoutePack } from './types.ts'

let pack: RoutePack | null = null

function handle(request: RouterRequest): RouterResponse {
  if (request.type === 'setPack') {
    pack = request.pack
    return { id: request.id, ok: true, result: null }
  }
  if (!pack) return { id: request.id, ok: false, error: 'Route pack not loaded' }
  const result =
    request.type === 'planRoute'
      ? planRoute(pack, request.intent)
      : planOptions(pack, request.intent)
  return { id: request.id, ok: true, result }
}

// Typed against the DOM lib (the webworker lib clashes with it), so use the
// message-only forms that exist in both scopes.
addEventListener('message', (event: MessageEvent<RouterRequest>) => {
  let response: RouterResponse
  try {
    response = handle(event.data)
  } catch (error) {
    response = { id: event.data?.id ?? -1, ok: false, error: String(error) }
  }
  postMessage(response)
})
