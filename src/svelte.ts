// Svelte adapter for Prelayout.
//
// Provides createPrelayout() — a factory that returns reactive getters
// for use with Svelte 5 runes ($state, $derived).
//
// Usage in a .svelte.ts or .svelte file:
//
//   import { createPrelayout } from 'prelayout/svelte'
//
//   const prelayout = createPrelayout()
//   const heights = $derived(prelayout.computeHeights(items, schema, containerWidth))
//   const getItemHeight = (index: number) => heights[index] ?? 0
//
// Since Svelte 5 runes ($state, $derived) are compile-time macros that only
// work in .svelte.ts files, this module exports plain functions that compute
// heights from current values. The caller wraps them in $derived for reactivity.
//
// Also provides a batch prepare + layout helper for direct use without runes.

import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutBatchResult = {
  heights: number[]
  totalHeight: number
  getItemHeight: (index: number) => number
}

// Incremental cache — shared across calls. Items with the same reference
// reuse their PreparedItem handle.
const cache = {
  items: [] as Record<string, unknown>[],
  prepared: [] as PreparedItem[],
  schemaKey: '',
}

/**
 * Compute heights for all items at a given width.
 * Call this inside $derived() for Svelte 5 reactivity.
 *
 * Internally caches PreparedItem handles — unchanged items (by reference)
 * skip canvas measurement.
 */
export function computeHeights(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): PrelayoutBatchResult {
  const schemaKey = JSON.stringify(schema)
  const schemaChanged = cache.schemaKey !== schemaKey

  const prepared: PreparedItem[] = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    if (!schemaChanged && i < cache.items.length && cache.items[i] === items[i]) {
      prepared[i] = cache.prepared[i]!
    } else {
      prepared[i] = prepareItem(items[i]!, schema)
    }
  }

  cache.items = items
  cache.prepared = prepared
  cache.schemaKey = schemaKey

  const heights: number[] = new Array(items.length)
  let totalHeight = 0
  for (let i = 0; i < prepared.length; i++) {
    heights[i] = layoutItem(prepared[i]!, containerWidth, schema)
    totalHeight += heights[i]!
  }

  return {
    heights,
    totalHeight,
    getItemHeight: (index: number) => heights[index] ?? 0,
  }
}

/**
 * Prepare and layout a single item. Useful for one-off measurements
 * without the batch caching.
 */
export function computeItemHeight(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
): number {
  const prepared = prepareItem(data, schema)
  return layoutItem(prepared, containerWidth, schema)
}
