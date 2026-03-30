// Prepare phase: extract and cache text measurements from Pretext.
//
// Walks the schema, finds all text children, and calls Pretext's prepare()
// on the corresponding data fields. The result is a PreparedItem that holds
// opaque Pretext handles — ready for pure-arithmetic layout at any width.

import { prepare, type PreparedText } from '@chenglou/pretext'
import type { Schema, SchemaChild } from './schema.js'

export type PreparedItem = {
  textFields: Map<string, PreparedText>
  data: Record<string, unknown>
}

export function prepareItem(
  data: Record<string, unknown>,
  schema: Schema,
): PreparedItem {
  const textFields = new Map<string, PreparedText>()
  for (const child of schema.children) {
    prepareChild(child, data, textFields)
  }
  return { textFields, data }
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
): void {
  switch (child.type) {
    case 'text': {
      const value = data[child.field]
      if (typeof value === 'string' && value.length > 0) {
        textFields.set(child.field, prepare(value, child.font))
      }
      break
    }
    case 'conditional': {
      prepareChild(child.child, data, textFields)
      break
    }
    case 'fixed':
      break
  }
}
