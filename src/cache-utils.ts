// Shared utilities for virtua framework integrations.
//
// virtua's CacheSnapshot is publicly opaque (interface { [cacheSymbol]: never })
// but internally is a tuple: [sizes: number[], defaultSize: number].
//
// This module pins that contract in one place so all four framework integrations
// (react-virtua, vue-virtua, solid-virtua, svelte-virtua) share the same shape.
// We re-export virtua's CacheSnapshot type so consumer code can pass our cache
// directly to <Virtualizer cache={...}> with no further casts.

import type { CacheSnapshot } from 'virtua'

/** Re-export so callers don't need a separate import. */
export type { CacheSnapshot } from 'virtua'

/**
 * Build a synthetic CacheSnapshot from Prelayout's predicted heights.
 *
 * defaultSize is the mean of predicted heights (or 40 when empty), used by virtua
 * as the placeholder size for any items appended to the list after mount.
 *
 * The heights array is copied because virtua mutates _sizes internally when
 * ResizeObserver fires with a different measurement.
 */
export function buildCache(heights: number[]): CacheSnapshot {
  const defaultSize =
    heights.length > 0
      ? heights.reduce((sum, h) => sum + h, 0) / heights.length
      : 40
  const tuple: [number[], number] = [heights.slice(), defaultSize]
  return tuple as unknown as CacheSnapshot
}

/**
 * Build a stable key string from inputs that should trigger remount.
 *
 * Excludes `items` reference itself — content edits with unchanged length
 * are handled by virtua's per-item ResizeObserver, not remount.
 */
export function buildWidthKey(
  width: number,
  itemCount: number,
  schemaKey: string,
): string {
  return `${width}|${itemCount}|${schemaKey}`
}
