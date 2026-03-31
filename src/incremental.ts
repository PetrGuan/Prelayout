// Incremental prepare: only re-measure fields that actually changed.
//
// Problem: when one field in a list item changes (e.g. user edits the body
// text), calling prepareItem() re-measures ALL text fields from scratch.
// For items with many text fields, this wastes canvas measurement work.
//
// Solution: prepareItemIncremental() takes the previous PreparedItem and
// the new data, and only re-measures fields whose values have changed.
// Unchanged fields reuse their cached PreparedText handles.

import { prepare, type PreparedText } from '@chenglou/pretext'
import type { Schema, SchemaChild } from './schema.js'
import type { PreparedItem } from './prepare.js'
import { getMeasureContext } from './canvas.js'

export function prepareItemIncremental(
  prevPrepared: PreparedItem,
  prevData: Record<string, unknown>,
  newData: Record<string, unknown>,
  schema: Schema,
): PreparedItem {
  const textFields = new Map<string, PreparedText>(prevPrepared.textFields)
  const flexFields = new Map<string, number[]>(prevPrepared.flexFields)

  for (const child of schema.children) {
    updateChild(child, prevData, newData, textFields, flexFields)
  }

  return { textFields, flexFields, data: newData }
}

function updateChild(
  child: SchemaChild,
  prevData: Record<string, unknown>,
  newData: Record<string, unknown>,
  textFields: Map<string, PreparedText>,
  flexFields: Map<string, number[]>,
): void {
  switch (child.type) {
    case 'text': {
      const prevValue = prevData[child.field]
      const newValue = newData[child.field]
      if (prevValue === newValue) break // unchanged — reuse cached handle

      // Value changed — re-measure
      textFields.delete(child.field)
      if (typeof newValue === 'string' && newValue.length > 0) {
        textFields.set(child.field, prepare(newValue, child.font))
      }
      break
    }

    case 'flex-wrap': {
      const prevValue = prevData[child.field]
      const newValue = newData[child.field]
      if (prevValue === newValue) break

      flexFields.delete(child.field)
      if (Array.isArray(newValue) && newValue.length > 0) {
        const ctx = getMeasureContext()
        ctx.font = child.font
        const hPad = child.itemHorizontalPadding
        const widths: number[] = []
        for (let i = 0; i < newValue.length; i++) {
          widths.push(ctx.measureText(String(newValue[i])).width + hPad)
        }
        flexFields.set(child.field, widths)
      }
      break
    }

    case 'group': {
      for (const grandchild of child.children) {
        updateChild(grandchild, prevData, newData, textFields, flexFields)
      }
      break
    }

    case 'conditional': {
      const prevGate = prevData[child.field]
      const newGate = newData[child.field]
      if (!prevGate && !newGate) break // both falsy — nothing to do
      if (!newGate) {
        // Became falsy — clean up
        cleanupChild(child.child, textFields, flexFields)
        break
      }
      if (!prevGate && newGate) {
        // Became truthy — must prepare from scratch (previous PreparedItem
        // would not have contained this child's measurements)
        cleanupChild(child.child, textFields, flexFields)
        forceUpdateChild(child.child, newData, textFields, flexFields)
        break
      }
      // Was truthy, still truthy — check if inner content changed
      updateChild(child.child, prevData, newData, textFields, flexFields)
      break
    }

    case 'row': {
      for (const cellChild of child.children) {
        updateChild(cellChild, prevData, newData, textFields, flexFields)
      }
      break
    }

    case 'aspect-ratio':
    case 'fixed':
      break
  }
}

function cleanupChild(
  child: SchemaChild,
  textFields: Map<string, PreparedText>,
  flexFields: Map<string, number[]>,
): void {
  switch (child.type) {
    case 'text':
      textFields.delete(child.field)
      break
    case 'flex-wrap':
      flexFields.delete(child.field)
      break
    case 'row':
      for (const cellChild of child.children) {
        cleanupChild(cellChild, textFields, flexFields)
      }
      break
    case 'group':
      for (const grandchild of child.children) {
        cleanupChild(grandchild, textFields, flexFields)
      }
      break
    case 'conditional':
      cleanupChild(child.child, textFields, flexFields)
      break
    case 'aspect-ratio':
    case 'fixed':
      break
  }
}

// Force-prepare a child regardless of previous data state.
// Used when a conditional transitions from falsy to truthy.
function forceUpdateChild(
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
        const hPad = child.itemHorizontalPadding
        const widths: number[] = []
        for (let i = 0; i < value.length; i++) {
          widths.push(ctx.measureText(String(value[i])).width + hPad)
        }
        flexFields.set(child.field, widths)
      }
      break
    }
    case 'row': {
      for (const cellChild of child.children) {
        forceUpdateChild(cellChild, data, textFields, flexFields)
      }
      break
    }
    case 'group': {
      for (const grandchild of child.children) {
        forceUpdateChild(grandchild, data, textFields, flexFields)
      }
      break
    }
    case 'conditional': {
      if (data[child.field]) {
        forceUpdateChild(child.child, data, textFields, flexFields)
      }
      break
    }
    case 'aspect-ratio':
    case 'fixed':
      break
  }
}
