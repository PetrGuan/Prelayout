// React Native adapter for Prelayout.
//
// React Native has no canvas.measureText() — text measurement requires
// a native bridge. This adapter provides:
//
//   1. prepareItemRN() — measures text via react-native-text-size (async)
//   2. layoutItem() — same pure arithmetic as web (reused directly)
//   3. usePrelayoutRN() — React Native hook with async prepare
//   4. FlatList/FlashList integration via getItemLayout
//
// Prerequisites:
//   npm install react-native-text-size
//
// The key difference from web: prepare is async (native bridge call),
// but layout is still sync pure arithmetic.

import type { Schema, SchemaChild } from './schema.js'

// Type for react-native-text-size measure result
export type RNTextMeasureResult = {
  width: number
  height: number
  lineCount: number
  lineHeight: number
}

// Type for the measure function — users provide their own implementation
// since we don't want to depend on react-native-text-size directly
export type RNTextMeasureFn = (text: string, font: string, maxWidth: number) => Promise<RNTextMeasureResult>

// A lightweight prepared text handle for RN — stores the measured height
// directly since we can't reuse Pretext's canvas-based PreparedText
export type RNPreparedText = {
  height: number
  lineCount: number
}

export type RNPreparedItem = {
  textFields: Map<string, RNPreparedText>
  flexFields: Map<string, number[]>
  data: Record<string, unknown>
}

// --- Prepare (async) ---

export async function prepareItemRN(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
  measureText: RNTextMeasureFn,
): Promise<RNPreparedItem> {
  const textFields = new Map<string, RNPreparedText>()
  const flexFields = new Map<string, number[]>()
  const [, pr, , pl] = schema.padding
  const contentWidth = Math.max(0, containerWidth - pl - pr)

  await prepareChildRN(schema.children, data, contentWidth, measureText, textFields, flexFields)
  return { textFields, flexFields, data }
}

async function prepareChildRN(
  children: SchemaChild[],
  data: Record<string, unknown>,
  contentWidth: number,
  measureText: RNTextMeasureFn,
  textFields: Map<string, RNPreparedText>,
  flexFields: Map<string, number[]>,
): Promise<void> {
  for (const child of children) {
    switch (child.type) {
      case 'text': {
        const value = data[child.field]
        if (typeof value === 'string' && value.length > 0) {
          const result = await measureText(value, child.font, contentWidth)
          textFields.set(child.field, {
            height: result.height,
            lineCount: result.lineCount,
          })
        }
        break
      }
      case 'row': {
        // For row children, we need to measure each cell at its specific width
        const totalGap = Math.max(0, child.children.length - 1) * child.gap
        let fixedWidth = totalGap
        let flexCount = 0
        for (const w of child.widths) {
          if (w === 'flex') flexCount++
          else fixedWidth += w
        }
        const flexWidth = flexCount > 0 ? Math.max(0, contentWidth - fixedWidth) / flexCount : 0

        for (let i = 0; i < child.children.length; i++) {
          const cellWidth = child.widths[i] === 'flex' ? flexWidth : (child.widths[i] as number)
          await prepareChildRN([child.children[i]!], data, cellWidth, measureText, textFields, flexFields)
        }
        break
      }
      case 'group': {
        const [, pr, , pl] = child.padding
        const innerWidth = Math.max(0, contentWidth - pl - pr)
        await prepareChildRN(child.children, data, innerWidth, measureText, textFields, flexFields)
        break
      }
      case 'conditional': {
        if (data[child.field]) {
          await prepareChildRN([child.child], data, contentWidth, measureText, textFields, flexFields)
        }
        break
      }
      case 'flex-wrap':
      case 'aspect-ratio':
      case 'fixed':
        break
    }
  }
}

// --- Layout (sync, pure arithmetic) ---

export function layoutItemRN(
  prepared: RNPreparedItem,
  containerWidth: number,
  schema: Schema,
): number {
  const [pt, pr, pb, pl] = schema.padding
  const contentWidth = Math.max(0, containerWidth - pl - pr)

  let height = pt
  let visibleCount = 0

  for (const child of schema.children) {
    const childHeight = layoutChildRN(child, prepared, contentWidth)
    if (childHeight === null) continue

    if (visibleCount > 0) height += schema.gap
    height += childHeight
    visibleCount++
  }

  height += pb
  return height
}

function layoutChildRN(
  child: SchemaChild,
  prepared: RNPreparedItem,
  contentWidth: number,
): number | null {
  switch (child.type) {
    case 'fixed':
      return child.height

    case 'text': {
      const measured = prepared.textFields.get(child.field)
      if (measured === undefined) {
        return child.minHeight > 0 ? child.minHeight : null
      }
      if (measured.lineCount === 0) {
        return child.minHeight > 0 ? child.minHeight : null
      }
      const lines = child.maxLines !== null ? Math.min(measured.lineCount, child.maxLines) : measured.lineCount
      return Math.max(lines * child.lineHeight, child.minHeight)
    }

    case 'flex-wrap': {
      const itemWidths = prepared.flexFields.get(child.field)
      if (itemWidths === undefined || itemWidths.length === 0) return null
      let rowCount = 1
      let rowWidth = 0
      for (let i = 0; i < itemWidths.length; i++) {
        const w = itemWidths[i]!
        if (i === 0) { rowWidth = w; continue }
        const nextWidth = rowWidth + child.columnGap + w
        if (nextWidth > contentWidth) { rowCount++; rowWidth = w }
        else { rowWidth = nextWidth }
      }
      return rowCount * child.itemHeight + Math.max(0, rowCount - 1) * child.rowGap
    }

    case 'aspect-ratio': {
      let ratio = child.ratio
      if (child.field.length > 0) {
        const dataRatio = prepared.data[child.field]
        if (typeof dataRatio === 'number' && dataRatio > 0) ratio = dataRatio
      }
      if (ratio === null || ratio <= 0) return null
      const h = contentWidth * ratio
      return child.maxHeight !== null ? Math.min(h, child.maxHeight) : h
    }

    case 'row': {
      const totalGap = Math.max(0, child.children.length - 1) * child.gap
      let fixedWidth = totalGap
      let flexCount = 0
      for (const w of child.widths) {
        if (w === 'flex') flexCount++
        else fixedWidth += w
      }
      const flexWidth = flexCount > 0 ? Math.max(0, contentWidth - fixedWidth) / flexCount : 0
      let maxHeight = 0
      let hasVisible = false
      for (let i = 0; i < child.children.length; i++) {
        const cellWidth = child.widths[i] === 'flex' ? flexWidth : (child.widths[i] as number)
        const cellHeight = layoutChildRN(child.children[i]!, prepared, cellWidth)
        if (cellHeight !== null) { hasVisible = true; if (cellHeight > maxHeight) maxHeight = cellHeight }
      }
      return hasVisible ? maxHeight : null
    }

    case 'group': {
      const [pt, pr, pb, pl] = child.padding
      const innerWidth = Math.max(0, contentWidth - pl - pr)
      let h = pt
      let visibleCount = 0
      for (const grandchild of child.children) {
        const gh = layoutChildRN(grandchild, prepared, innerWidth)
        if (gh === null) continue
        if (visibleCount > 0) h += child.gap
        h += gh
        visibleCount++
      }
      h += pb
      return visibleCount > 0 ? h : null
    }

    case 'conditional': {
      const value = prepared.data[child.field]
      if (!value) return null
      return layoutChildRN(child.child, prepared, contentWidth)
    }
  }
}

// --- FlatList / FlashList integration ---

export type GetItemLayoutResult = {
  length: number
  offset: number
  index: number
}

export function buildGetItemLayout(
  heights: number[],
): (data: unknown, index: number) => GetItemLayoutResult {
  // Pre-compute cumulative offsets
  const offsets: number[] = new Array(heights.length)
  let cumulative = 0
  for (let i = 0; i < heights.length; i++) {
    offsets[i] = cumulative
    cumulative += heights[i]!
  }

  return (_data: unknown, index: number): GetItemLayoutResult => ({
    length: heights[index] ?? 0,
    offset: offsets[index] ?? 0,
    index,
  })
}
