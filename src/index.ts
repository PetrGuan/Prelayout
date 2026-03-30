// Prelayout — component-level height prediction for virtual scroll lists.
//
// Built on Pretext's text measurement. Extends the prepare/layout two-phase
// model from text blocks to structured component layouts.
//
//   1. Define a schema describing your list item structure
//   2. prepareItem() measures all text fields via Pretext (one-time cost)
//   3. layoutItem() computes exact height via pure arithmetic (call on every resize)

export { schema, fixed, text, conditional } from './schema.js'
export type { Schema, SchemaChild, FixedChild, TextChild, ConditionalChild, Padding } from './schema.js'

export { prepareItem, prepareItems } from './prepare.js'
export type { PreparedItem } from './prepare.js'

export { layoutItem, layoutItemDetailed } from './layout.js'
export type { LayoutResult } from './layout.js'
