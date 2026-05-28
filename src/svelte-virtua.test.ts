import { describe, expect, test } from 'bun:test'
import { createVirtualStore } from 'virtua/unstable_core'
import { createPrelayoutVirtuaCache } from './svelte-virtua.js'
import { schema, fixed } from './index.js'

describe('createPrelayoutVirtuaCache (Svelte)', () => {
  test('factory returns computeCache; computeCache returns valid cache + widthKey', () => {
    const s = schema({ children: [fixed(55)] })
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]

    const factory = createPrelayoutVirtuaCache()
    const result = factory.computeCache(items, s, 400)

    expect(result.heights).toEqual([55, 55, 55])
    expect(result.totalHeight).toBe(165)
    expect(typeof result.widthKey).toBe('string')

    const store = createVirtualStore(3, 40, 0, result.cache)
    expect(store.$getItemSize(0)).toBe(55)
    expect(store.$getItemSize(2)).toBe(55)
  })

  test('widthKey changes when width changes', () => {
    const s = schema({ children: [fixed(55)] })
    const items = [{ id: 1 }]
    const factory = createPrelayoutVirtuaCache()

    const a = factory.computeCache(items, s, 400)
    const b = factory.computeCache(items, s, 500)
    expect(a.widthKey).not.toBe(b.widthKey)
  })

  test('two factory instances have independent caches', () => {
    const s = schema({ children: [fixed(55)] })
    const items = [{ id: 1 }, { id: 2 }]
    const a = createPrelayoutVirtuaCache()
    const b = createPrelayoutVirtuaCache()
    expect(a.computeCache(items, s, 400).heights).toEqual([55, 55])
    expect(b.computeCache(items, s, 400).heights).toEqual([55, 55])
    // Smoke test — primary contract is "no cross-talk crash"
  })
})
