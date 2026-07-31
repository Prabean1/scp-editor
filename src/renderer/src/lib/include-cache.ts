import type { IncludeResolution } from '../../../shared/types'

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

function resolve(path: string, fetch: () => Promise<IncludeResolution>, onSettled: () => void): void {
  cache.set(path, { status: 'pending' })
  fetch()
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

export function ensureIncludeResolved(path: string, onSettled: () => void): void {
  if (cache.has(path)) return
  resolve(path, () => window.api.resolveInclude(path), onSettled)
}

export function refreshInclude(path: string, onSettled: () => void): void {
  resolve(path, () => window.api.refreshInclude(path), onSettled)
}
