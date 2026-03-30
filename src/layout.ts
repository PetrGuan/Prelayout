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
      if (preparedText === undefined) return null
      const result = layout(preparedText, contentWidth, child.lineHeight)
      const lines = child.maxLines !== null ? Math.min(result.lineCount, child.maxLines) : result.lineCount
      return lines * child.lineHeight
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
      return visibleCount > 0 ? h : null
    }

    case 'conditional': {
      const value = prepared.data[child.field]
      if (!value) return null
      return layoutChild(child.child, prepared, contentWidth)
    }
  }
}
