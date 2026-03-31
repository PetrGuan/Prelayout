// Convenience integration with @tanstack/vue-virtual.
//
// useVirtualLayout() combines usePrelayout with useVirtualizer into a single
// composable. The estimateSize function returns exact Prelayout heights —
// no measureElement needed, no flicker.
//
// Only vertical lists are supported. Prelayout computes heights, not widths.

import { computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { usePrelayout } from './vue.js'
import type { Schema } from './schema.js'
import type { Ref } from 'vue'

export type VirtualLayoutOptions = {
  items: Ref<Record<string, unknown>[]>
  schema: Ref<Schema> | Schema
  containerWidth: Ref<number>
  getScrollElement: () => HTMLElement | null
  overscan?: number
}

export function useVirtualLayout(options: VirtualLayoutOptions) {
  const { items, schema, containerWidth, getScrollElement, overscan } = options
  const { getItemHeight, heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  // Pass a reactive computed ref so the virtualizer picks up count/height changes
  const virtualizerOptions = computed(() => ({
    count: items.value.length,
    getScrollElement,
    estimateSize: getItemHeight,
    overscan,
  }))

  const virtualizer = useVirtualizer(virtualizerOptions)

  return { virtualizer, getItemHeight, heights, totalHeight }
}
