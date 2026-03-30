import { describe, expect, test } from 'bun:test'
import { schema, fixed, text, conditional, layoutItem, layoutItemDetailed } from './index.js'
import type { PreparedItem } from './index.js'

// Unit tests for the pure-arithmetic layout phase.
// These use mock PreparedItems to avoid needing a real canvas context.

function mockPreparedItem(data: Record<string, unknown> = {}): PreparedItem {
  const textFields = new Map()
  return { textFields, data }
}

describe('schema builders', () => {
  test('fixed creates a fixed child', () => {
    const child = fixed(40)
    expect(child).toEqual({ type: 'fixed', height: 40 })
  })

  test('text creates a text child', () => {
    const child = text('body', { font: '16px Inter', lineHeight: 22 })
    expect(child).toEqual({ type: 'text', field: 'body', font: '16px Inter', lineHeight: 22 })
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
    // 12 (top) + 40 (child) + 12 (bottom) = 64
    expect(height).toBe(64)
  })

  test('multiple fixed children with gap', () => {
    const s = schema({ padding: 12, gap: 8, children: [fixed(40), fixed(24), fixed(30)] })
    const prepared = mockPreparedItem()
    const height = layoutItem(prepared, 320, s)
    // 12 + 40 + 8 + 24 + 8 + 30 + 12 = 134
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
    // 10 + 20 + 10 = 40 (conditional skipped, no gap added)
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
    // 10 + 20 + 8 + 200 + 10 = 248
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
})
