import { describe, expect, test } from 'bun:test'
import { buildCache, buildWidthKey } from './cache-utils.js'

type VirtuaCacheTuple = [sizes: number[], defaultSize: number]

// Helper: peek into the opaque CacheSnapshot to assert the underlying tuple.
const asTuple = (c: ReturnType<typeof buildCache>) => c as unknown as VirtuaCacheTuple

describe('buildCache', () => {
  test('wraps heights into [sizes, defaultSize=mean] tuple', () => {
    const cache = asTuple(buildCache([10, 20, 30]))
    expect(cache[0]).toEqual([10, 20, 30])
    expect(cache[1]).toBe(20) // mean of 10, 20, 30
  })

  test('empty heights produce empty sizes + defaultSize=40', () => {
    const cache = asTuple(buildCache([]))
    expect(cache[0]).toEqual([])
    expect(cache[1]).toBe(40)
  })

  test('copies heights so external mutation does not bleed into cache', () => {
    const heights = [10, 20]
    const cache = asTuple(buildCache(heights))
    heights[0] = 999
    expect(cache[0]).toEqual([10, 20])
  })

  test('mutating cache sizes does not bleed into next buildCache call', () => {
    // Simulates virtua mutating _sizes internally on resize observations.
    const heights = [10, 20]
    const cache1 = asTuple(buildCache(heights))
    cache1[0][0] = 999
    const cache2 = asTuple(buildCache(heights))
    expect(cache2[0]).toEqual([10, 20])
  })
})

describe('buildWidthKey', () => {
  test('encodes width, itemCount, and schemaKey', () => {
    expect(buildWidthKey(480, 100, 'abc')).toBe('480|100|abc')
  })

  test('different widths produce different keys', () => {
    expect(buildWidthKey(480, 100, 'x')).not.toBe(buildWidthKey(481, 100, 'x'))
  })

  test('different itemCounts produce different keys', () => {
    expect(buildWidthKey(480, 100, 'x')).not.toBe(buildWidthKey(480, 101, 'x'))
  })

  test('different schemaKeys produce different keys', () => {
    expect(buildWidthKey(480, 100, 'a')).not.toBe(buildWidthKey(480, 100, 'b'))
  })

  test('same inputs produce same key (stable hash)', () => {
    expect(buildWidthKey(480, 100, 'x')).toBe(buildWidthKey(480, 100, 'x'))
  })
})
