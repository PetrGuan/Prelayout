// Schema DSL for describing list item layout structure.
//
// A schema is a vertical stack of children with padding and gaps.
// Each child is either:
//   - fixed: a known constant height (avatar row, button bar, etc.)
//   - text:  a text field measured by Pretext (wraps based on width)
//   - flexWrap: tag/chip row that wraps based on width
//   - aspectRatio: element whose height = width * ratio (images, video)
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
  maxLines: number | null
  minHeight: number
}

export type FlexWrapChild = {
  type: 'flex-wrap'
  field: string
  font: string
  itemHeight: number // total rendered height per item (includes any vertical padding)
  itemHorizontalPadding: number // left + right padding added to text width per item
  rowGap: number
  columnGap: number
}

export type AspectRatioChild = {
  type: 'aspect-ratio'
  field: string // data field that holds the ratio (number), or '' to use the fixed ratio
  ratio: number // fixed ratio (height/width). Use 0 with a field to make it data-driven only
  maxHeight: number | null
}

export type RowChild = {
  type: 'row'
  widths: ('flex' | number)[]
  gap: number
  children: SchemaChild[]
}

export type GroupChild = {
  type: 'group'
  padding: [number, number, number, number]
  gap: number
  minHeight: number
  maxHeight: number | null
  children: SchemaChild[]
}

export type ConditionalChild = {
  type: 'conditional'
  field: string
  child: SchemaChild
}

export type SchemaChild = FixedChild | TextChild | FlexWrapChild | AspectRatioChild | RowChild | GroupChild | ConditionalChild

export type Schema = {
  /** [top, right, bottom, left] in pixels. Include border widths in these
   *  values (e.g. 13 = 12px CSS padding + 1px border). */
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

export function text(field: string, options: {
  font: string
  lineHeight: number
  maxLines?: number
  minHeight?: number
}): TextChild {
  const maxLines = options.maxLines ?? null
  if (maxLines !== null && maxLines < 1) {
    throw new Error('maxLines must be >= 1')
  }
  return {
    type: 'text',
    field,
    font: options.font,
    lineHeight: options.lineHeight,
    maxLines,
    minHeight: options.minHeight ?? 0,
  }
}

export function flexWrap(field: string, options: {
  font: string
  itemHeight: number
  itemPadding?: number
  rowGap?: number
  columnGap?: number
}): FlexWrapChild {
  return {
    type: 'flex-wrap',
    field,
    font: options.font,
    itemHeight: options.itemHeight,
    itemHorizontalPadding: (options.itemPadding ?? 0) * 2,
    rowGap: options.rowGap ?? 0,
    columnGap: options.columnGap ?? 0,
  }
}

export function aspectRatio(ratio: number, options?: {
  field?: string
  maxHeight?: number
}): AspectRatioChild {
  return {
    type: 'aspect-ratio',
    field: options?.field ?? '',
    ratio,
    maxHeight: options?.maxHeight ?? null,
  }
}

export function row(options: { widths: ('flex' | number)[]; gap?: number; children: SchemaChild[] }): RowChild {
  if (options.widths.length !== options.children.length) {
    throw new Error(`row() widths length (${options.widths.length}) must match children length (${options.children.length})`)
  }
  return {
    type: 'row',
    widths: options.widths,
    gap: options.gap ?? 0,
    children: options.children,
  }
}

export function group(options: {
  padding?: Padding
  gap?: number
  minHeight?: number
  maxHeight?: number
  children: SchemaChild[]
}): GroupChild {
  const minHeight = options.minHeight ?? 0
  const maxHeight = options.maxHeight ?? null
  if (minHeight < 0) throw new Error('group minHeight must be >= 0')
  if (maxHeight !== null && maxHeight < 0) throw new Error('group maxHeight must be >= 0')
  if (maxHeight !== null && minHeight > maxHeight) throw new Error('group minHeight must be <= maxHeight')
  return {
    type: 'group',
    padding: normalizePadding(options.padding ?? 0),
    gap: options.gap ?? 0,
    minHeight,
    maxHeight,
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
