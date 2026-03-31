// Vue 3 integration for Prelayout.
//
// usePrelayout() is a composable that memoizes prepare/layout phases:
//   - Re-prepares only when items or schema change
//   - Re-layouts only when containerWidth changes
//   - Returns getItemHeight(index) for use with any virtual list library
//
// Vue's fine-grained reactivity (ref/computed/watch) handles dependency
// tracking automatically — no manual dependency arrays needed.

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutResult = {
  getItemHeight: (index: number) => number
  heights: ComputedRef<number[]>
  totalHeight: ComputedRef<number>
}

export function usePrelayout(
  items: Ref<Record<string, unknown>[]>,
  schema: Ref<Schema> | Schema,
  containerWidth: Ref<number>,
): PrelayoutResult {
  const schemaRef = typeof schema === 'object' && 'value' in schema ? schema : ref(schema) as Ref<Schema>

  // Cache previous prepared items for incremental updates
  const prevItems = ref<Record<string, unknown>[]>([])
  const prevPrepared = ref<PreparedItem[]>([])

  const prepared = computed<PreparedItem[]>(() => {
    const currentItems = items.value
    const currentSchema = schemaRef.value
    const prev = prevItems.value
    const prevPrep = prevPrepared.value
    const next: PreparedItem[] = new Array(currentItems.length)

    for (let i = 0; i < currentItems.length; i++) {
      if (i < prev.length && prev[i] === currentItems[i]) {
        next[i] = prevPrep[i]!
      } else {
        next[i] = prepareItem(currentItems[i]!, currentSchema)
      }
    }

    return next
  })

  // Update the cache after computed runs
  watch(prepared, (newPrepared) => {
    prevItems.value = items.value
    prevPrepared.value = newPrepared
  }, { flush: 'sync' })

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
