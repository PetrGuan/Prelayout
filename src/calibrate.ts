// Auto-calibration: extract layout constants from a rendered DOM element.
//
// Usage:
//   1. Render a sample list item with data-pl attributes on each child:
//      <div ref={rootRef}>
//        <div data-pl="header">...</div>
//        <div data-pl="body">...</div>
//        <div data-pl="tags">...</div>
//      </div>
//
//   2. Call calibrate(rootRef.current) to extract:
//      - Container padding (from computed style, including borders)
//      - Gap between children (from spacing between rects)
//      - Per-child heights (from getBoundingClientRect)
//
//   3. Use the output to build or verify your schema.

export type CalibratedChild = {
  name: string
  height: number
  top: number
}

export type CalibrationResult = {
  padding: [number, number, number, number]
  gap: number
  children: CalibratedChild[]
  containerWidth: number
  totalHeight: number
}

/** Extract layout constants from a rendered DOM element.
 *  Returned padding values include border widths (matching the schema convention
 *  where padding should include borders, e.g. 13 = 12px padding + 1px border).
 *  Only direct children of the element with data-pl attributes are captured.
 *  Nested data-pl nodes inside groups are ignored — annotate the group
 *  container itself, not its inner children. */
export function calibrate(element: HTMLElement): CalibrationResult {
  const style = getComputedStyle(element)
  const pt = parseFloat(style.paddingTop) || 0
  const pr = parseFloat(style.paddingRight) || 0
  const pb = parseFloat(style.paddingBottom) || 0
  const pl = parseFloat(style.paddingLeft) || 0
  const bt = parseFloat(style.borderTopWidth) || 0
  const br = parseFloat(style.borderRightWidth) || 0
  const bb = parseFloat(style.borderBottomWidth) || 0
  const bl = parseFloat(style.borderLeftWidth) || 0

  const rootRect = element.getBoundingClientRect()
  const annotated = element.querySelectorAll<HTMLElement>('[data-pl]')
  const children: CalibratedChild[] = []

  for (let i = 0; i < annotated.length; i++) {
    const child = annotated[i]!
    // Only include direct-ish children (skip nested data-pl inside groups)
    if (child.parentElement !== element) continue
    const rect = child.getBoundingClientRect()
    children.push({
      name: child.getAttribute('data-pl')!,
      height: rect.height,
      top: rect.top - rootRect.top,
    })
  }

  // Compute gap from spacing between consecutive children
  let gap = 0
  if (children.length >= 2) {
    let totalGap = 0
    let gapCount = 0
    for (let i = 1; i < children.length; i++) {
      const prev = children[i - 1]!
      const curr = children[i]!
      const spacing = curr.top - (prev.top + prev.height)
      if (spacing > 0) {
        totalGap += spacing
        gapCount++
      }
    }
    if (gapCount > 0) gap = Math.round(totalGap / gapCount)
  }

  return {
    padding: [
      Math.round(pt + bt),
      Math.round(pr + br),
      Math.round(pb + bb),
      Math.round(pl + bl),
    ],
    gap,
    children,
    containerWidth: rootRect.width,
    totalHeight: rootRect.height,
  }
}

// Compare a calibration result against a schema and report differences.
// Useful for detecting drift when CSS changes but the schema wasn't updated.
//
// Matching strategy: calibrated children are matched to schema children by
// their data-pl name. For `fixed` children, the name is matched against the
// schema child's position label. For `text` and `flex-wrap` children, the
// name is matched against their `field` property.

import type { Schema, SchemaChild } from './schema.js'

export type DriftItem = {
  field: string
  expected: number
  actual: number
  diff: number
}

export type DriftReport = {
  hasDrift: boolean
  paddingDrift: DriftItem[]
  gapDrift: DriftItem | null
  childDrift: DriftItem[]
}

function buildSchemaNameMap(children: SchemaChild[]): Map<string, { type: string; height: number | null }> {
  const map = new Map<string, { type: string; height: number | null }>()
  let fixedIndex = 0
  for (const child of children) {
    switch (child.type) {
      case 'fixed':
        // Fixed children don't have a field name, so use positional label
        map.set(`fixed:${fixedIndex}`, { type: 'fixed', height: child.height })
        fixedIndex++
        break
      case 'text':
        map.set(child.field, { type: 'text', height: null })
        break
      case 'flex-wrap':
        map.set(child.field, { type: 'flex-wrap', height: null })
        break
      case 'conditional':
        // Recurse into the conditional's child
        if (child.child.type === 'fixed') {
          map.set(child.field, { type: 'fixed', height: child.child.height })
        } else if (child.child.type === 'text') {
          map.set(child.child.field, { type: 'text', height: null })
        } else if (child.child.type === 'flex-wrap') {
          map.set(child.child.field, { type: 'flex-wrap', height: null })
        }
        break
      case 'row':
        // Row children are handled by their individual cells
        for (const cellChild of child.children) {
          if (cellChild.type === 'text') map.set(cellChild.field, { type: 'text', height: null })
          else if (cellChild.type === 'flex-wrap') map.set(cellChild.field, { type: 'flex-wrap', height: null })
        }
        break
      case 'group':
        // Groups are opaque to drift detection — their internal padding
        // is not separately annotated in the DOM
        break
    }
  }
  return map
}

export function detectDrift(schema: Schema, calibration: CalibrationResult): DriftReport {
  const paddingDrift: DriftItem[] = []
  const labels = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const
  for (let i = 0; i < 4; i++) {
    const expected = schema.padding[i]!
    const actual = calibration.padding[i]!
    if (Math.abs(expected - actual) >= 1) {
      paddingDrift.push({ field: labels[i]!, expected, actual, diff: actual - expected })
    }
  }

  let gapDrift: DriftItem | null = null
  if (calibration.children.length >= 2 && Math.abs(schema.gap - calibration.gap) >= 1) {
    gapDrift = { field: 'gap', expected: schema.gap, actual: calibration.gap, diff: calibration.gap - schema.gap }
  }

  // Match calibrated children to schema children by name
  const nameMap = buildSchemaNameMap(schema.children)
  const childDrift: DriftItem[] = []

  for (const calChild of calibration.children) {
    const schemaEntry = nameMap.get(calChild.name)
    if (schemaEntry === undefined) continue // unmatched — not in schema
    if (schemaEntry.type !== 'fixed' || schemaEntry.height === null) continue // only compare fixed heights
    const diff = calChild.height - schemaEntry.height
    if (Math.abs(diff) >= 1) {
      childDrift.push({
        field: calChild.name,
        expected: schemaEntry.height,
        actual: calChild.height,
        diff,
      })
    }
  }

  return {
    hasDrift: paddingDrift.length > 0 || gapDrift !== null || childDrift.length > 0,
    paddingDrift,
    gapDrift,
    childDrift,
  }
}
