// Convenience integration with @tanstack/react-virtual.
//
// useVirtualLayout() combines usePrelayout with useVirtualizer into a single
// hook. The estimateSize function returns exact Prelayout heights — no DOM
// measurement needed, no measureElement ref, no flicker.

import { useVirtualizer } from '@tanstack/react-virtual'
import { usePrelayout } from './react.js'
import type { Schema } from './schema.js'

export type VirtualLayoutOptions = {
  items: Record<string, unknown>[]
  schema: Schema
  containerWidth: number
  getScrollElement: () => HTMLElement | null
  overscan?: number
  horizontal?: boolean
}

export function useVirtualLayout(options: VirtualLayoutOptions) {
  const { items, schema, containerWidth, getScrollElement, overscan, horizontal } = options
  const { getItemHeight, heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: getItemHeight,
    overscan,
    horizontal,
  })

  return { virtualizer, getItemHeight, heights, totalHeight }
}
