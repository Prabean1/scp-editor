export type CachedInclude =
  | { status: 'pending' }
  | { status: 'resolved'; source: string }
  | { status: 'error'; message: string }

// Module-level, not component state — the cache needs to survive across
// every call site (App.tsx, eventually Rich Text mode) and outlive any
// single render.
const cache = new Map<string, CachedInclude>()

export function getCachedInclude(path: string): CachedInclude | undefined {
  return cache.get(path)
}

export function ensureIncludeResolved(path: string, onSettled: () => void): void {
  if (cache.has(path)) return
  cache.set(path, { status: 'pending' })
  window.api
    .resolveInclude(path)
    .then((result) => {
      cache.set(
        path,
        result.status === 'resolved'
          ? { status: 'resolved', source: result.source }
          : { status: 'error', message: result.message }
      )
    })
    .catch((err) => {
      cache.set(path, { status: 'error', message: err instanceof Error ? err.message : String(err) })
    })
    .finally(onSettled)
}

export function refreshInclude(path: string, onSettled: () => void): void {
  cache.set(path, { status: 'pending' })
  window.api
    .refreshInclude(path)
    .then((result) => {
      cache.set(
        path,
        result.status === 'resolved'
          ? { status: 'resolved', source: result.source }
          : { status: 'error', message: result.message }
      )
    })
    .catch((err) => {
      cache.set(path, { status: 'error', message: err instanceof Error ? err.message : String(err) })
    })
    .finally(onSettled)
}
