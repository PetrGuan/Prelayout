// React integration for Prelayout.
//
// usePrelayout() memoizes the prepare/layout phases across renders:
//   - Re-prepares only when items or schema change
//   - Re-layouts only when containerWidth changes
//   - Returns getItemHeight(index) — O(1) lookup into cached heights

import { useMemo, useRef } from 'react'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutResult = {
  getItemHeight: (index: number) => number
  heights: number[]
  totalHeight: number
}

export function usePrelayout(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): PrelayoutResult {
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
        next[i] = prepareItem(items[i]!, schema)
      }
    }

    cacheRef.current = { items, prepared: next }
    return next
  }, [items, schema])

  const { heights, totalHeight } = useMemo(() => {
    const h = new Array<number>(prepared.length)
    let total = 0
    for (let i = 0; i < prepared.length; i++) {
      h[i] = layoutItem(prepared[i]!, containerWidth, schema)
      total += h[i]!
    }
    return { heights: h, totalHeight: total }
  }, [prepared, containerWidth, schema])

  const getItemHeight = useMemo(() => {
    return (index: number): number => heights[index] ?? 0
  }, [heights])

  return { getItemHeight, heights, totalHeight }
}
