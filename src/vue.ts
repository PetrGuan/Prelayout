// Vue 3 integration for Prelayout.
//
// usePrelayout() is a composable that memoizes prepare/layout phases:
//   - Re-prepares only when items or schema change
//   - Re-layouts only when containerWidth changes
//   - Returns getItemHeight(index) for use with any virtual list library
//
// Vue's fine-grained reactivity (ref/computed) handles dependency
// tracking automatically — no manual dependency arrays needed.
//
// Note: heights and totalHeight are ComputedRef — use .value in script,
// auto-unwrapped in templates.

import { computed, type Ref, type ComputedRef } from 'vue'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutResult = {
  getItemHeight: (index: number) => number
  /** ComputedRef — use .value in script, auto-unwrapped in templates */
  heights: ComputedRef<number[]>
  /** ComputedRef — use .value in script, auto-unwrapped in templates */
  totalHeight: ComputedRef<number>
}

export function usePrelayout(
  items: Ref<Record<string, unknown>[]>,
  schema: Ref<Schema> | Schema,
  containerWidth: Ref<number>,
): PrelayoutResult {
  const schemaRef = typeof schema === 'object' && 'value' in schema ? schema : { value: schema } as Ref<Schema>

  // Plain (non-reactive) cache object — not tracked by Vue's reactivity
  // system. Read inside computed without creating circular dependencies.
  const cache = {
    items: [] as Record<string, unknown>[],
    prepared: [] as PreparedItem[],
    schemaKey: '',
  }

  const prepared = computed<PreparedItem[]>(() => {
    const currentItems = items.value
    const currentSchema = schemaRef.value
    const currentSchemaKey = JSON.stringify(currentSchema)
    const schemaChanged = cache.schemaKey !== currentSchemaKey
    const next: PreparedItem[] = new Array(currentItems.length)

    for (let i = 0; i < currentItems.length; i++) {
      if (!schemaChanged && i < cache.items.length && cache.items[i] === currentItems[i]) {
        next[i] = cache.prepared[i]!
      } else {
        next[i] = prepareItem(currentItems[i]!, currentSchema)
      }
    }

    // Update cache synchronously before returning — plain object mutation,
    // no reactive side effects
    cache.items = currentItems
    cache.prepared = next
    cache.schemaKey = currentSchemaKey

    return next
  })

  const heights = computed<number[]>(() => {
    const width = containerWidth.value
    const currentSchema = schemaRef.value
    return prepared.value.map(p => layoutItem(p, width, currentSchema))
  })

  const totalHeight = computed(() => {
    let total = 0
    for (const h of heights.value) total += h
    return total
  })

  function getItemHeight(index: number): number {
    return heights.value[index] ?? 0
  }

  return { getItemHeight, heights, totalHeight }
}
