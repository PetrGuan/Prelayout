// Prepare phase: extract and cache text measurements from Pretext.
//
// Walks the schema, finds all text children, and calls Pretext's prepare()
// on the corresponding data fields. Also measures flex-wrap item widths via
// canvas. The result is a PreparedItem that holds opaque Pretext handles and
// cached tag widths — ready for pure-arithmetic layout at any width.

import { prepare, type PreparedText } from '@chenglou/pretext'
import type { Schema, SchemaChild } from './schema.js'

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (measureCtx !== null) return measureCtx
  if (typeof OffscreenCanvas !== 'undefined') {
    measureCtx = new OffscreenCanvas(1, 1).getContext('2d')!
    return measureCtx
  }
  if (typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d')!
    return measureCtx
  }
  throw new Error('Prelayout requires OffscreenCanvas or a DOM canvas context.')
}

export type PreparedItem = {
  textFields: Map<string, PreparedText>
  flexFields: Map<string, number[]> // field → array of item widths (text + padding)
  data: Record<string, unknown>
}

export function prepareItem(
  data: Record<string, unknown>,
  schema: Schema,
): PreparedItem {
  const textFields = new Map<string, PreparedText>()
  const flexFields = new Map<string, number[]>()
  for (const child of schema.children) {
    prepareChild(child, data, textFields, flexFields)
  }
  return { textFields, flexFields, data }
}

export function prepareItems(
  items: Record<string, unknown>[],
  schema: Schema,
): PreparedItem[] {
  return items.map(item => prepareItem(item, schema))
}

function prepareChild(
  child: SchemaChild,
  data: Record<string, unknown>,
  textFields: Map<string, PreparedText>,
  flexFields: Map<string, number[]>,
): void {
  switch (child.type) {
    case 'text': {
      const value = data[child.field]
      if (typeof value === 'string' && value.length > 0) {
        textFields.set(child.field, prepare(value, child.font))
      }
      break
    }
    case 'flex-wrap': {
      const value = data[child.field]
      if (Array.isArray(value) && value.length > 0) {
        const ctx = getMeasureContext()
        ctx.font = child.font
        const hPad = child.itemPadding[0] * 2 // left + right
        const widths: number[] = []
        for (let i = 0; i < value.length; i++) {
          const text = String(value[i])
          widths.push(ctx.measureText(text).width + hPad)
        }
        flexFields.set(child.field, widths)
      }
      break
    }
    case 'group': {
      for (const grandchild of child.children) {
        prepareChild(grandchild, data, textFields, flexFields)
      }
      break
    }
    case 'conditional': {
      if (data[child.field]) {
        prepareChild(child.child, data, textFields, flexFields)
      }
      break
    }
    case 'fixed':
      break
  }
}
