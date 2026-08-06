import type { IncludeResolution } from '../../../shared/types'
import { getBundledInclude } from './bundled-includes'

export type CachedInclude =
  | { status: 'pending' }
  | { status: 'resolved'; source: string }
  | { status: 'error'; message: string }

// Module-level, not component state — shared across call sites and outlives
// any single render.
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
  // Bundled paths need no network, so the automatic loop skips them. Manual
  // sync deliberately does not, and a live result then outranks the bundle.
  if (getBundledInclude(path)) return
  resolve(path, () => window.api.resolveInclude(path), onSettled)
}

export function refreshInclude(path: string, onSettled: () => void): void {
  resolve(path, () => window.api.refreshInclude(path), onSettled)
}
