// virtua integration for Svelte 5.
//
// Factory function returns computeCache(items, schema, width) — call it inside
// $derived(...) for Svelte 5 reactivity.
//
// Usage:
//
//   <script>
//     import { VList } from 'virtua/svelte'
//     import { createPrelayoutVirtuaCache } from 'prelayout/svelte-virtua'
//
//     let items = $state([...])
//     let width = $state(480)
//     const factory = createPrelayoutVirtuaCache()
//     let result = $derived(factory.computeCache(items, schema, width))
//   </script>
//
//   <!-- static mode -->
//   <VList cache={result.cache}>...</VList>
//   <!-- reset mode -->
//   {#key result.widthKey}
//     <VList cache={result.cache}>...</VList>
//   {/key}

import type { Schema } from './schema.js'
import { createPrelayout } from './svelte.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutSvelteVirtuaCacheResult = {
  cache: CacheSnapshot
  widthKey: string
  heights: number[]
  totalHeight: number
}

export function createPrelayoutVirtuaCache() {
  const prelayout = createPrelayout()

  function computeCache(
    items: Record<string, unknown>[],
    schema: Schema,
    containerWidth: number,
  ): PrelayoutSvelteVirtuaCacheResult {
    const { heights, totalHeight } = prelayout.computeHeights(items, schema, containerWidth)
    const cache = buildCache(heights)
    const widthKey = buildWidthKey(containerWidth, items.length, JSON.stringify(schema))
    return { cache, widthKey, heights, totalHeight }
  }

  return { computeCache }
}
