// Tallies bytes the app itself tries to send at runtime: request bodies on any
// request, plus the URL on cross-origin requests. Expected to stay at 0.
// This is an in-app tally; devtools Network remains the source of truth.

let bytesSent = 0
const listeners = new Set<() => void>()
const encoder = new TextEncoder()

function add(bytes: number) {
  if (bytes <= 0) return
  bytesSent += bytes
  listeners.forEach((listener) => listener())
}

function bodySize(body: unknown): number {
  if (body == null) return 0
  if (typeof body === 'string') return encoder.encode(body).length
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof URLSearchParams) return encoder.encode(body.toString()).length
  return 0
}

function urlSize(url: string | URL): number {
  const parsed = new URL(url, location.href)
  return parsed.origin === location.origin ? 0 : encoder.encode(parsed.href).length
}

export function installNetMeter() {
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : input
    add(urlSize(url) + bodySize(init?.body))
    return originalFetch(input, init)
  }

  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['open']>
  ) {
    add(urlSize(args[1]))
    return originalOpen.apply(this, args)
  } as XMLHttpRequest['open']

  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (body) {
    add(bodySize(body))
    return originalSend.call(this, body)
  }

  const originalBeacon = navigator.sendBeacon.bind(navigator)
  navigator.sendBeacon = (url, data) => {
    add(urlSize(url) + bodySize(data))
    return originalBeacon(url, data)
  }
}

export function subscribeBytesSent(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBytesSent() {
  return bytesSent
}
