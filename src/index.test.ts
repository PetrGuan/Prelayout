import { describe, expect, test } from 'bun:test'
import { schema, fixed, text, flexWrap, aspectRatio, group, conditional, layoutItem, layoutItemDetailed } from './index.js'
import type { PreparedItem } from './index.js'

// Unit tests for the pure-arithmetic layout phase.
// These use mock PreparedItems to avoid needing a real canvas context.

function mockPreparedItem(
  data: Record<string, unknown> = {},
  flexFields?: Map<string, number[]>,
): PreparedItem {
  const textFields = new Map()
  return { textFields, flexFields: flexFields ?? new Map(), data }
}

describe('schema builders', () => {
  test('fixed creates a fixed child', () => {
    const child = fixed(40)
    expect(child).toEqual({ type: 'fixed', height: 40 })
  })

  test('text creates a text child', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22 })
    expect(child).toEqual({ type: 'text', field: 'body', font: '16px Inter', lineHeight: 22, maxLines: null, minHeight: 0 })
  })

  test('conditional creates a conditional child', () => {
    const child = conditional('image', fixed(200))
    expect(child).toEqual({ type: 'conditional', field: 'image', child: { type: 'fixed', height: 200 } })
  })

  test('schema normalizes number padding to [t, r, b, l]', () => {
    const s = schema({ padding: 12, gap: 8, children: [] })
    expect(s.padding).toEqual([12, 12, 12, 12])
  })

  test('schema passes through array padding', () => {
    const s = schema({ padding: [10, 20, 30, 40], gap: 4, children: [] })
    expect(s.padding).toEqual([10, 20, 30, 40])
  })

  test('schema defaults padding to 0 and gap to 0', () => {
    const s = schema({ children: [] })
    expect(s.padding).toEqual([0, 0, 0, 0])
    expect(s.gap).toBe(0)
  })
})

describe('layoutItem with fixed-only schemas', () => {
  test('single fixed child with padding', () => {
    const s = schema({ padding: 12, children: [fixed(40)] })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 320, s)
    expect(height).toBe(64)
  })

  test('multiple fixed children with gap', () => {
    const s = schema({ padding: 12, gap: 8, children: [fixed(40), fixed(24), fixed(30)] })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 320, s)
    expect(height).toBe(134)
  })

  test('conditional child excluded when field is falsy', () => {
    const s = schema({
      padding: 10,
      gap: 8,
      children: [fixed(20), conditional('image', fixed(200))],
    })
    const prepared = mockPreparedItem({ image: null })
    const height = layoutItem(prepared, 320, s)
    expect(height).toBe(40)
  })

  test('conditional child included when field is truthy', () => {
    const s = schema({
      padding: 10,
      gap: 8,
      children: [fixed(20), conditional('image', fixed(200))],
    })
    const prepared = mockPreparedItem({ image: 'https://example.com/img.jpg' })
    const height = layoutItem(prepared, 320, s)
    expect(height).toBe(248)
  })
})

describe('layoutItemDetailed', () => {
  test('returns per-child heights', () => {
    const s = schema({ padding: 10, gap: 4, children: [fixed(30), fixed(20)] })
    const prepared = mockPreparedItem()
    const result = layoutItemDetailed(prepared, 320, s)
    expect(result.height).toBe(10 + 30 + 4 + 20 + 10)
    expect(result.childHeights).toEqual([30, 20])
  })

  test('returns null for skipped conditional children', () => {
    const s = schema({
      padding: 10,
      gap: 8,
      children: [fixed(20), conditional('image', fixed(200)), fixed(24)],
    })
    const prepared = mockPreparedItem({ image: null })
    const result = layoutItemDetailed(prepared, 320, s)
    expect(result.height).toBe(10 + 20 + 8 + 24 + 10)
    expect(result.childHeights).toEqual([20, null, 24])
  })
})

describe('edge cases', () => {
  test('zero container width does not produce negative heights', () => {
    const s = schema({ padding: [10, 20, 10, 20], gap: 8, children: [fixed(30)] })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 0, s)
    expect(height).toBe(10 + 30 + 10)
  })

  test('group with padding', () => {
    const s = schema({
      padding: 0,
      children: [group({ padding: [8, 12, 8, 12], children: [fixed(20)] })],
    })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 320, s)
    expect(height).toBe(8 + 20 + 8)
  })

  test('text with maxLines creates correct schema', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22, maxLines: 3 })
    expect(child.maxLines).toBe(3)
  })

  test('text without maxLines defaults to null', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22 })
    expect(child.maxLines).toBeNull()
  })

  test('maxLines: 0 throws', () => {
    expect(() => text('body', { font: '16px Inter', lineHeight: 22, maxLines: 0 })).toThrow()
  })

  test('text with minHeight creates correct schema', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22, minHeight: 44 })
    expect(child.minHeight).toBe(44)
  })

  test('text without minHeight defaults to 0', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22 })
    expect(child.minHeight).toBe(0)
  })
})

describe('flexWrap layout', () => {
  test('all tags fit in one row', () => {
    const flex = new Map([['tags', [50, 50, 50]]])
    const s = schema({
      padding: 0,
      children: [flexWrap('tags', { font: '14px Inter', itemHeight: 28, columnGap: 8 })],
    })
    const prepared = mockPreparedItem({ tags: ['a', 'b', 'c'] }, flex)
    const height = layoutItem(prepared, 200, s)
    expect(height).toBe(28)
  })

  test('tags wrap to multiple rows', () => {
    const flex = new Map([['tags', [80, 80, 80]]])
    const s = schema({
      padding: 0,
      children: [flexWrap('tags', { font: '14px Inter', itemHeight: 28, rowGap: 4, columnGap: 8 })],
    })
    const prepared = mockPreparedItem({ tags: ['a', 'b', 'c'] }, flex)
    const height = layoutItem(prepared, 150, s)
    expect(height).toBe(92)
  })

  test('two tags per row', () => {
    const flex = new Map([['tags', [60, 60, 60, 60]]])
    const s = schema({
      padding: 0,
      children: [flexWrap('tags', { font: '14px Inter', itemHeight: 28, rowGap: 4, columnGap: 8 })],
    })
    const prepared = mockPreparedItem({ tags: ['a', 'b', 'c', 'd'] }, flex)
    const height = layoutItem(prepared, 150, s)
    expect(height).toBe(60)
  })

  test('empty tags array returns null height', () => {
    const s = schema({
      padding: 10,
      gap: 8,
      children: [fixed(20), flexWrap('tags', { font: '14px Inter', itemHeight: 28 })],
    })
    const prepared = mockPreparedItem({ tags: [] })
    const height = layoutItem(prepared, 300, s)
    expect(height).toBe(10 + 20 + 10)
  })
})

describe('aspectRatio layout', () => {
  test('fixed ratio computes height from width', () => {
    // Container 320px, padding 10 each side → content 300px
    // ratio 0.5625 (16:9) → 300 * 0.5625 = 168.75
    const s = schema({
      padding: [0, 10, 0, 10],
      children: [aspectRatio(9 / 16)],
    })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 320, s)
    expect(height).toBeCloseTo(168.75)
  })

  test('per-item ratio from data field', () => {
    const s = schema({
      padding: 0,
      children: [aspectRatio(0, { field: 'imageRatio' })],
    })
    const prepared = mockPreparedItem({ imageRatio: 0.75 })
    const height = layoutItem(prepared, 400, s)
    expect(height).toBe(300)
  })

  test('maxHeight caps the result', () => {
    const s = schema({
      padding: 0,
      children: [aspectRatio(1, { maxHeight: 200 })],
    })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 400, s)
    // ratio 1 → 400px, but capped at 200
    expect(height).toBe(200)
  })

  test('null ratio with no data field returns null', () => {
    const s = schema({
      padding: 10,
      gap: 8,
      children: [fixed(20), aspectRatio(0, { field: 'ratio' })],
    })
    const prepared = mockPreparedItem({ ratio: null })
    const height = layoutItem(prepared, 300, s)
    // aspectRatio returns null, no gap
    expect(height).toBe(10 + 20 + 10)
  })
})
