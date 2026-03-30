// Schema DSL for describing list item layout structure.
//
// A schema is a vertical stack of children with padding and gaps.
// Each child is either:
//   - fixed: a known constant height (avatar row, button bar, etc.)
//   - text:  a text field measured by Pretext (wraps based on width)
//   - group: a nested vertical stack with its own padding/gap (e.g. a quote box)
//   - conditional: a child that only appears when a data field is truthy

export type Padding = number | [number, number, number, number]

export type FixedChild = {
  type: 'fixed'
  height: number
}

export type TextChild = {
  type: 'text'
  field: string
  font: string
  lineHeight: number
}

export type GroupChild = {
  type: 'group'
  padding: [number, number, number, number]
  gap: number
  children: SchemaChild[]
}

export type ConditionalChild = {
  type: 'conditional'
  field: string
  child: SchemaChild
}

export type SchemaChild = FixedChild | TextChild | GroupChild | ConditionalChild

export type Schema = {
  padding: [number, number, number, number]
  gap: number
  children: SchemaChild[]
}

// --- Schema builders ---

export function schema(options: {
  padding?: Padding
  gap?: number
  children: SchemaChild[]
}): Schema {
  return {
    padding: normalizePadding(options.padding ?? 0),
    gap: options.gap ?? 0,
    children: options.children,
  }
}

export function fixed(height: number): FixedChild {
  return { type: 'fixed', height }
}

export function text(field: string, options: { font: string; lineHeight: number }): TextChild {
  return { type: 'text', field, font: options.font, lineHeight: options.lineHeight }
}

export function group(options: { padding?: Padding; gap?: number; children: SchemaChild[] }): GroupChild {
  return {
    type: 'group',
    padding: normalizePadding(options.padding ?? 0),
    gap: options.gap ?? 0,
    children: options.children,
  }
}

export function conditional(field: string, child: SchemaChild): ConditionalChild {
  return { type: 'conditional', field, child }
}

function normalizePadding(p: Padding): [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p]
  return p
}
