// Svelte 5 adapter for Prelayout.
//
// Provides createPrelayout() factory and standalone computeItemHeight().
//
// Usage in a .svelte.ts or .svelte file:
//
//   import { createPrelayout } from 'prelayout/svelte'
//
//   const prelayout = createPrelayout()
//   let result = $derived(prelayout.computeHeights(items, schema, containerWidth))
//   // result.heights, result.totalHeight, result.getItemHeight(index)
//
// Each createPrelayout() call creates an independent cache — safe for
// multiple lists on the same page. Unchanged items (by reference) skip
// canvas measurement.

import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutBatchResult = {
  heights: number[]
  totalHeight: number
  getItemHeight: (index: number) => number
}

/**
 * Create a Prelayout instance with its own cache.
 * Each call returns an independent instance — safe for multiple lists.
 */
export function createPrelayout() {
  // Per-instance cache — not shared across lists
  let cachedItems: Record<string, unknown>[] = []
  let cachedPrepared: PreparedItem[] = []
  let cachedSchemaRef: Schema | null = null
  let cachedSchemaKey = ''

  /**
   * Compute heights for all items at a given width.
   * Call inside $derived() for Svelte 5 reactivity.
   */
  function computeHeights(
    items: Record<string, unknown>[],
    schema: Schema,
    containerWidth: number,
  ): PrelayoutBatchResult {
    // Only re-serialize schema when the reference changes
    let schemaChanged = false
    if (schema !== cachedSchemaRef) {
      const key = JSON.stringify(schema)
      schemaChanged = key !== cachedSchemaKey
      cachedSchemaKey = key
      cachedSchemaRef = schema
    }

    const prepared: PreparedItem[] = new Array(items.length)
    for (let i = 0; i < items.length; i++) {
      if (!schemaChanged && i < cachedItems.length && cachedItems[i] === items[i]) {
        prepared[i] = cachedPrepared[i]!
      } else {
        prepared[i] = prepareItem(items[i]!, schema)
      }
    }

    cachedItems = items
    cachedPrepared = prepared

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

  return { computeHeights }
}

/**
 * Compute height for a single item. No caching — useful for one-off measurements.
 */
export function computeItemHeight(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
): number {
  const prepared = prepareItem(data, schema)
  return layoutItem(prepared, containerWidth, schema)
}
