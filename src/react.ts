// React integration for Prelayout.
//
// usePrelayout() memoizes the prepare/layout phases across renders:
//   - Re-prepares only when items or schema change
//   - Re-layouts only when containerWidth changes
//   - Returns getItemHeight(index) — O(1) lookup into cached heights
//
// IMPORTANT: `schema` must be a stable reference (module-level constant or
// wrapped in useMemo). Inline `schema({...})` in render will defeat memoization.

import { useMemo, useRef, useCallback } from 'react'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutResult = {
  getItemHeight: (index: number) => number
  heights: number[]
  totalHeight: number
}

function schemaKey(s: Schema): string {
  return JSON.stringify(s)
}

export function usePrelayout(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): PrelayoutResult {
  // Stabilize schema by value so inline `schema({...})` doesn't bust caches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSchema = useMemo(() => schema, [schemaKey(schema)])

  // Track previous items to do incremental prepare.
  // Only re-prepare items that actually changed.
  const cacheRef = useRef<{
    items: Record<string, unknown>[]
    prepared: PreparedItem[]
  }>({ items: [], prepared: [] })

  const prepared = useMemo(() => {
    const prev = cacheRef.current
    const next: PreparedItem[] = new Array(items.length)

    for (let i = 0; i < items.length; i++) {
      // Reuse prepared handle if the item reference hasn't changed
      if (i < prev.items.length && prev.items[i] === items[i]) {
        next[i] = prev.prepared[i]!
      } else {
        next[i] = prepareItem(items[i]!, stableSchema)
      }
    }

    cacheRef.current = { items, prepared: next }
    return next
  }, [items, stableSchema])

  const { heights, totalHeight } = useMemo(() => {
    const h = new Array<number>(prepared.length)
    let total = 0
    for (let i = 0; i < prepared.length; i++) {
      h[i] = layoutItem(prepared[i]!, containerWidth, stableSchema)
      total += h[i]!
    }
    return { heights: h, totalHeight: total }
  }, [prepared, containerWidth, stableSchema])

  const getItemHeight = useCallback(
    (index: number): number => heights[index] ?? 0,
    [heights],
  )

  return { getItemHeight, heights, totalHeight }
}
