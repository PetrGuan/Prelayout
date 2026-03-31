// Layout phase: pure arithmetic height calculation.
//
// Given a PreparedItem and a container width, walks the schema and sums up
// child heights with padding and gaps. Text children are laid out via
// Pretext's layout() — no DOM reads, no canvas calls, no string work.

import { layout } from '@chenglou/pretext'
import type { Schema, SchemaChild } from './schema.js'
import type { PreparedItem } from './prepare.js'

export type LayoutResult = {
  height: number
  childHeights: (number | null)[] // null = child was absent (conditional skipped)
}

export function layoutItem(
  prepared: PreparedItem,
  containerWidth: number,
  schema: Schema,
): number {
  const [pt, pr, pb, pl] = schema.padding
  const contentWidth = Math.max(0, containerWidth - pl - pr)

  let height = pt
  let visibleCount = 0

  for (const child of schema.children) {
    const childHeight = layoutChild(child, prepared, contentWidth)
    if (childHeight === null) continue

    if (visibleCount > 0) height += schema.gap
    height += childHeight
    visibleCount++
  }

  height += pb
  return height
}

export function layoutItemDetailed(
  prepared: PreparedItem,
  containerWidth: number,
  schema: Schema,
): LayoutResult {
  const [pt, pr, pb, pl] = schema.padding
  const contentWidth = Math.max(0, containerWidth - pl - pr)

  let height = pt
  let visibleCount = 0
  const childHeights: (number | null)[] = []

  for (const child of schema.children) {
    const childHeight = layoutChild(child, prepared, contentWidth)
    if (childHeight === null) {
      childHeights.push(null)
      continue
    }

    if (visibleCount > 0) height += schema.gap
    height += childHeight
    visibleCount++
    childHeights.push(childHeight)
  }

  height += pb
  return { height, childHeights }
}

function layoutChild(
  child: SchemaChild,
  prepared: PreparedItem,
  contentWidth: number,
): number | null {
  switch (child.type) {
    case 'fixed':
      return child.height

    case 'text': {
      const preparedText = prepared.textFields.get(child.field)
      if (preparedText === undefined) {
        // Field is empty or missing — still honor minHeight if set
        return child.minHeight > 0 ? child.minHeight : null
      }
      const result = layout(preparedText, contentWidth, child.lineHeight)
      if (result.lineCount === 0) {
        // Text normalized to empty (e.g. pure whitespace) — treat as absent
        // unless minHeight is set. Prevents a 0-height child from consuming
        // a gap slot when the DOM would collapse it via margin collapsing.
        return child.minHeight > 0 ? child.minHeight : null
      }
      const lines = child.maxLines !== null ? Math.min(result.lineCount, child.maxLines) : result.lineCount
      return Math.max(lines * child.lineHeight, child.minHeight)
    }

    case 'flex-wrap': {
      const itemWidths = prepared.flexFields.get(child.field)
      if (itemWidths === undefined || itemWidths.length === 0) return null
      // Greedy row packing — same algorithm as text line breaking
      let rowCount = 1
      let rowWidth = 0
      for (let i = 0; i < itemWidths.length; i++) {
        const w = itemWidths[i]!
        if (i === 0) {
          rowWidth = w
          continue
        }
        const nextWidth = rowWidth + child.columnGap + w
        if (nextWidth > contentWidth) {
          rowCount++
          rowWidth = w
        } else {
          rowWidth = nextWidth
        }
      }
      return rowCount * child.itemHeight + Math.max(0, rowCount - 1) * child.rowGap
    }

    case 'aspect-ratio': {
      // Use per-item ratio from data, or fall back to the fixed ratio
      let ratio = child.ratio
      if (child.field.length > 0) {
        const dataRatio = prepared.data[child.field]
        if (typeof dataRatio === 'number' && dataRatio > 0) {
          ratio = dataRatio
        }
      }
      if (ratio <= 0) return null
      const h = contentWidth * ratio
      return child.maxHeight !== null ? Math.min(h, child.maxHeight) : h
    }

    case 'row': {
      // Horizontal layout: distribute widths, take max child height.
      // 'flex' children split the remaining space equally.
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
        const cellHeight = layoutChild(child.children[i]!, prepared, cellWidth)
        if (cellHeight !== null) {
          hasVisible = true
          if (cellHeight > maxHeight) maxHeight = cellHeight
        }
      }
      return hasVisible ? maxHeight : null
    }

    case 'group': {
      const [pt, pr, pb, pl] = child.padding
      const innerWidth = Math.max(0, contentWidth - pl - pr)
      let h = pt
      let visibleCount = 0
      for (const grandchild of child.children) {
        const gh = layoutChild(grandchild, prepared, innerWidth)
        if (gh === null) continue
        if (visibleCount > 0) h += child.gap
        h += gh
        visibleCount++
      }
      h += pb
      if (visibleCount === 0 && child.minHeight === 0) return null
      h = Math.max(h, child.minHeight)
      if (child.maxHeight !== null) h = Math.min(h, child.maxHeight)
      return h
    }

    case 'conditional': {
      const value = prepared.data[child.field]
      if (!value) return null
      return layoutChild(child.child, prepared, contentWidth)
    }
  }
}
