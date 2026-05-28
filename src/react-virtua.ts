// virtua integration for React.
//
// Returns a synthetic CacheSnapshot built from Prelayout's predicted heights,
// plus a widthKey string for optional remount-on-resize.
//
// Usage:
//
//   import { usePrelayoutVirtuaCache } from 'prelayout/react-virtua'
//   import { VList } from 'virtua'
//
//   const { cache, widthKey } = usePrelayoutVirtuaCache(items, schema, width)
//
//   // Static mode — virtua's ResizeObserver tracks subsequent resizes
//   <VList cache={cache}>{(item, i) => <Card item={item} />}</VList>
//
//   // Reset mode — force remount when width changes
//   <VList key={widthKey} cache={cache}>{(item, i) => <Card item={item} />}</VList>

import { useMemo } from 'react'
import type { Schema } from './schema.js'
import { usePrelayout } from './react.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutVirtuaCacheResult = {
  cache: CacheSnapshot
  widthKey: string
  heights: number[]
  totalHeight: number
}

export function usePrelayoutVirtuaCache(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): PrelayoutVirtuaCacheResult {
  const { heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const cache = useMemo(() => buildCache(heights), [heights])

  // Reuse usePrelayout's stabilized schema key by re-serializing here — cheap
  // (the schema object identity is already stable across renders unless really
  // changed) and keeps this hook decoupled from internal state.
  const widthKey = useMemo(
    () => buildWidthKey(containerWidth, items.length, JSON.stringify(schema)),
    [containerWidth, items.length, schema],
  )

  return { cache, widthKey, heights, totalHeight }
}
