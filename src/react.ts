// React integration for Prelayout.
//
// usePrelayout() memoizes the prepare/layout phases across renders:
//   - Re-prepares only when items or schema change
//   - Re-layouts only when containerWidth changes
//   - Returns getItemHeight(index) — O(1) lookup into cached heights
//
// Schema is stabilized by value — inline `schema({...})` in render is safe.

import { useMemo, useRef, useCallback } from 'react'
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
  // Stabilize schema by value. Cache the JSON key in a ref so we only
  // serialize when the object reference changes, not on every render.
  const schemaRef = useRef<{ obj: Schema; key: string }>({ obj: schema, key: '' })
  if (schemaRef.current.obj !== schema) {
    schemaRef.current = { obj: schema, key: JSON.stringify(schema) }
  } else if (schemaRef.current.key === '') {
    schemaRef.current.key = JSON.stringify(schema)
  }
  const schemaKeyValue = schemaRef.current.key

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSchema = useMemo(() => schema, [schemaKeyValue])

  // Track previous items to do incremental prepare.
  // Only re-prepare items that actually changed.
  const cacheRef = useRef<{
    items: Record<string, unknown>[]
    prepared: PreparedItem[]
    schemaKey: string
  }>({ items: [], prepared: [], schemaKey: '' })

  const prepared = useMemo(() => {
    const prev = cacheRef.current
    const schemaChanged = prev.schemaKey !== schemaKeyValue
    const next: PreparedItem[] = new Array(items.length)

    for (let i = 0; i < items.length; i++) {
      // Reuse prepared handle if item reference and schema haven't changed
      if (!schemaChanged && i < prev.items.length && prev.items[i] === items[i]) {
        next[i] = prev.prepared[i]!
      } else {
        next[i] = prepareItem(items[i]!, stableSchema)
      }
    }

    cacheRef.current = { items, prepared: next, schemaKey: schemaKeyValue }
    return next
  }, [items, stableSchema, schemaKeyValue])

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
