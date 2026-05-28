// virtua integration for Solid.
//
// Returns Accessors for cache/widthKey/heights/totalHeight.
//
// Usage:
//
//   import { createSignal } from 'solid-js'
//   import { VList } from 'virtua/solid'
//   import { createPrelayoutVirtuaCache } from 'prelayout/solid-virtua'
//
//   const [items, setItems] = createSignal([...])
//   const [width, setWidth] = createSignal(480)
//   const { cache, widthKey } = createPrelayoutVirtuaCache(items, schema, width)
//
//   // static mode
//   <VList cache={cache()}>{...}</VList>
//   // reset mode
//   <VList key={widthKey()} cache={cache()}>{...}</VList>

import type { Accessor } from 'solid-js'
import type { Schema } from './schema.js'
import { createPrelayout } from './solid.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutSolidVirtuaCacheResult = {
  cache: Accessor<CacheSnapshot>
  widthKey: Accessor<string>
  heights: Accessor<number[]>
  totalHeight: Accessor<number>
}

// Plain-function accessors (no createMemo) — matches solid.ts design.
// Solid tracks signal reads at the call site, so reading items()/containerWidth()
// inside these functions registers reactive dependencies when the consumer
// (typically virtua's <VList cache={cache()}>) is rendered in a reactive scope.
// Also works in bun's test env where solid-js resolves to its SSR build.
//
// Per-call cache instance — multiple components on one page are safe because
// each call to createPrelayoutVirtuaCache gets its own createPrelayout factory.
export function createPrelayoutVirtuaCache(
  items: Accessor<Record<string, unknown>[]>,
  schema: Schema,
  containerWidth: Accessor<number>,
): PrelayoutSolidVirtuaCacheResult {
  const prelayout = createPrelayout()
  const { heights, totalHeight } = prelayout.computeHeights(items, schema, containerWidth)

  const cache: Accessor<CacheSnapshot> = () => buildCache(heights())
  const widthKey: Accessor<string> = () =>
    buildWidthKey(containerWidth(), items().length, JSON.stringify(schema))

  return { cache, widthKey, heights, totalHeight }
}
