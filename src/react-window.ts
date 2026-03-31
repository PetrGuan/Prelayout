// Integration with react-window (VariableSizeList).
//
// react-window's VariableSizeList takes an `itemSize` callback that returns
// the height for each index. usePrelayoutItemSize() returns exactly that
// function, backed by Prelayout's pure-arithmetic height calculation.

import { usePrelayout } from './react.js'
import type { Schema } from './schema.js'

export type PrelayoutItemSizeResult = {
  itemSize: (index: number) => number
  heights: number[]
  totalHeight: number
  resetAfterIndex: () => void
}

export function usePrelayoutItemSize(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
  listRef?: React.RefObject<{ resetAfterIndex: (index: number) => void } | null>,
): PrelayoutItemSizeResult {
  const { getItemHeight, heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const resetAfterIndex = () => {
    listRef?.current?.resetAfterIndex(0)
  }

  return { itemSize: getItemHeight, heights, totalHeight, resetAfterIndex }
}
