// SSR support for Prelayout.
//
// On the server, canvas is not available for text measurement. This module
// provides utilities to:
//   1. Serialize PreparedItems on the client (after prepare)
//   2. Deserialize and layout on the server (pure arithmetic, no canvas)
//   3. Inject pre-computed heights into SSR HTML to eliminate CLS
//
// Workflow:
//   Client (first visit):
//     const prepared = prepareItem(data, schema)
//     const serialized = serializePrepared(prepared)
//     // send to server or cache
//
//   Server (SSR):
//     const prepared = deserializePrepared(serialized, data)
//     const height = layoutItem(prepared, containerWidth, schema)
//     // inject into HTML: style="height: ${height}px"
//
//   Client (subsequent visits):
//     // heights are already in the HTML — zero CLS

import type { PreparedText } from '@chenglou/pretext'
import type { PreparedItem } from './prepare.js'

export type SerializedPreparedItem = {
  textFields: [string, unknown][] // field → opaque PreparedText (serialized)
  flexFields: [string, number[]][] // field → item widths
}

export function serializePrepared(prepared: PreparedItem): SerializedPreparedItem {
  const textFields: [string, unknown][] = []
  for (const [key, value] of prepared.textFields) {
    // PreparedText is an opaque object with numeric arrays — JSON-safe
    textFields.push([key, value])
  }
  const flexFields: [string, number[]][] = []
  for (const [key, value] of prepared.flexFields) {
    flexFields.push([key, value])
  }
  return { textFields, flexFields }
}

export function deserializePrepared(
  serialized: SerializedPreparedItem,
  data: Record<string, unknown>,
): PreparedItem {
  const textFields = new Map<string, PreparedText>()
  for (const [key, value] of serialized.textFields) {
    textFields.set(key, value as PreparedText)
  }
  const flexFields = new Map<string, number[]>()
  for (const [key, value] of serialized.flexFields) {
    flexFields.set(key, value)
  }
  return { textFields, flexFields, data }
}

// Convenience: pre-compute heights for a list of items at multiple breakpoints.
// Returns a map from breakpoint width to an array of heights.
// Useful for injecting CSS custom properties per breakpoint.

import { layoutItem } from './layout.js'
import type { Schema } from './schema.js'

export function precomputeHeights(
  preparedItems: PreparedItem[],
  schema: Schema,
  breakpoints: number[],
): Map<number, number[]> {
  const result = new Map<number, number[]>()
  for (const width of breakpoints) {
    const heights: number[] = []
    for (const prepared of preparedItems) {
      heights.push(layoutItem(prepared, width, schema))
    }
    result.set(width, heights)
  }
  return result
}
