// Solid integration for Prelayout.
//
// createPrelayout() returns a factory with its own cache (mirrors svelte.ts).
// Each factory instance is independent — safe for multiple lists on the same page.
//
// Usage:
//
//   import { createPrelayout } from 'prelayout/solid'
//
//   const prelayout = createPrelayout()
//   const result = prelayout.computeHeights(items, schema, width)
//   // result.heights() — Accessor<number[]>  (reads signals; track inside reactive ctx)
//   // result.totalHeight() — Accessor<number>
//   // result.getItemHeight(index) — plain function (not reactive)

import type { Accessor } from 'solid-js'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutSolidResult = {
  heights: Accessor<number[]>
  totalHeight: Accessor<number>
  getItemHeight: (index: number) => number
}

export function createPrelayout() {
  let cachedItems: Record<string, unknown>[] = []
  let cachedPrepared: PreparedItem[] = []
  let cachedSchemaRef: Schema | null = null
  let cachedSchemaKey = ''

  function computeHeights(
    items: Accessor<Record<string, unknown>[]>,
    schema: Schema,
    containerWidth: Accessor<number>,
  ): PrelayoutSolidResult {
    function getPrepared(): PreparedItem[] {
      const currentItems = items()
      let schemaChanged = false
      if (schema !== cachedSchemaRef) {
        const key = JSON.stringify(schema)
        schemaChanged = key !== cachedSchemaKey
        cachedSchemaKey = key
        cachedSchemaRef = schema
      }

      const next: PreparedItem[] = new Array(currentItems.length)
      for (let i = 0; i < currentItems.length; i++) {
        if (!schemaChanged && i < cachedItems.length && cachedItems[i] === currentItems[i]) {
          next[i] = cachedPrepared[i]!
        } else {
          next[i] = prepareItem(currentItems[i]!, schema)
        }
      }
      cachedItems = currentItems
      cachedPrepared = next
      return next
    }

    function heights(): number[] {
      const width = containerWidth()
      return getPrepared().map((p) => layoutItem(p, width, schema))
    }

    function totalHeight(): number {
      let total = 0
      for (const h of heights()) total += h
      return total
    }

    function getItemHeight(index: number): number {
      return heights()[index] ?? 0
    }

    return { heights, totalHeight, getItemHeight }
  }

  return { computeHeights }
}

/** One-off measurement, no caching. */
export function computeItemHeight(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
): number {
  const prepared = prepareItem(data, schema)
  return layoutItem(prepared, containerWidth, schema)
}
