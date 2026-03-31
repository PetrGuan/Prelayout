// React Native adapter for Prelayout.
//
// React Native has no canvas.measureText() — text measurement requires
// a native bridge. This adapter provides:
//
//   1. prepareItemRN() — measures text at a specific width (async, native bridge)
//   2. layoutItemRN() — sums prepared heights with padding/gaps (sync, pure arithmetic)
//   3. buildGetItemLayout() — FlatList/FlashList getItemLayout helper
//
// IMPORTANT: Unlike web where prepare() is width-independent and layout()
// takes a width, RN's prepareItemRN() bakes in the width during measurement.
// If the width changes (e.g. device rotation), you must re-prepare all items.

import type { Schema, SchemaChild } from './schema.js'

// Users provide their own text measurement function.
// The font parameter matches the schema text child's font string.
export type RNTextMeasureFn = (text: string, font: string, maxWidth: number) => Promise<{
  height: number
  lineCount: number
}>

// Stores pre-measured heights per text field
export type RNPreparedItem = {
  /** Per-field measured heights (text fields store line-aware heights) */
  childHeights: Map<string, number>
  data: Record<string, unknown>
  preparedAtWidth: number
}

// --- Prepare (async) ---

export async function prepareItemRN(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
  measureText: RNTextMeasureFn,
): Promise<RNPreparedItem> {
  const childHeights = new Map<string, number>()
  const [, pr, , pl] = schema.padding
  const contentWidth = Math.max(0, containerWidth - pl - pr)

  await measureChildren(schema.children, data, contentWidth, schema, measureText, childHeights)
  return { childHeights, data, preparedAtWidth: containerWidth }
}

export function prepareItemsRN(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
  measureText: RNTextMeasureFn,
): Promise<RNPreparedItem[]> {
  return Promise.all(items.map(item => prepareItemRN(item, schema, containerWidth, measureText)))
}

async function measureChildren(
  children: SchemaChild[],
  data: Record<string, unknown>,
  contentWidth: number,
  schema: Schema,
  measureText: RNTextMeasureFn,
  childHeights: Map<string, number>,
): Promise<void> {
  for (const child of children) {
    switch (child.type) {
      case 'text': {
        const value = data[child.field]
        if (typeof value === 'string' && value.length > 0) {
          const result = await measureText(value, child.font, contentWidth)
          let lineCount = result.lineCount
          if (lineCount === 0) break
          if (child.maxLines !== null) lineCount = Math.min(lineCount, child.maxLines)
          childHeights.set(child.field, Math.max(lineCount * child.lineHeight, child.minHeight))
        } else if (child.minHeight > 0) {
          childHeights.set(child.field, child.minHeight)
        }
        break
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
        for (let i = 0; i < child.children.length; i++) {
          const cellWidth = child.widths[i] === 'flex' ? flexWidth : (child.widths[i] as number)
          await measureChildren([child.children[i]!], data, cellWidth, schema, measureText, childHeights)
        }
        break
      }
      case 'group': {
        const [, pr, , pl] = child.padding
        const innerWidth = Math.max(0, contentWidth - pl - pr)
        await measureChildren(child.children, data, innerWidth, schema, measureText, childHeights)
        break
      }
      case 'conditional': {
        if (data[child.field]) {
          await measureChildren([child.child], data, contentWidth, schema, measureText, childHeights)
        }
        break
      }
      case 'flex-wrap':
      case 'aspect-ratio':
      case 'fixed':
        // These are computed purely from schema + data in layoutItemRN
        break
    }
  }
}

// --- Layout (sync, pure arithmetic) ---

export function layoutItemRN(
  prepared: RNPreparedItem,
  schema: Schema,
): number {
  const [pt, pr, pb, pl] = schema.padding
  const contentWidth = Math.max(0, prepared.preparedAtWidth - pl - pr)

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
      const h = prepared.childHeights.get(child.field)
      return h !== undefined ? h : (child.minHeight > 0 ? child.minHeight : null)
    }

    case 'flex-wrap': {
      // flexWrap items aren't pre-measured in RN — fall back to single row estimate
      const value = prepared.data[child.field]
      if (!Array.isArray(value) || value.length === 0) return null
      // Without canvas measurement we can't predict wrapping.
      // Return single row as a conservative estimate.
      return child.itemHeight
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
