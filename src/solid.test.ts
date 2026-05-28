import { describe, expect, test } from 'bun:test'
import { createRoot, createSignal } from 'solid-js'
import { createPrelayout, computeItemHeight } from './solid.js'
import { schema, fixed } from './index.js'

describe('createPrelayout (Solid)', () => {
  test('returns reactive heights and totalHeight for a fixed-height schema', () => {
    createRoot((dispose) => {
      const s = schema({ children: [fixed(50)] })
      const [items, setItems] = createSignal([{ id: 1 }, { id: 2 }])
      const [width, _setWidth] = createSignal(400)

      const prelayout = createPrelayout()
      const result = prelayout.computeHeights(items, s, width)

      expect(result.heights()).toEqual([50, 50])
      expect(result.totalHeight()).toBe(100)
      expect(result.getItemHeight(0)).toBe(50)
      expect(result.getItemHeight(1)).toBe(50)

      setItems([{ id: 1 }, { id: 2 }, { id: 3 }])
      expect(result.heights()).toEqual([50, 50, 50])
      expect(result.totalHeight()).toBe(150)

      dispose()
    })
  })

  test('cache reuses prepared items by reference', () => {
    createRoot((dispose) => {
      const s = schema({ children: [fixed(50)] })
      const item1 = { id: 1 }
      const item2 = { id: 2 }
      const [items, setItems] = createSignal([item1, item2])
      const [width] = createSignal(400)

      const prelayout = createPrelayout()
      const result = prelayout.computeHeights(items, s, width)
      expect(result.heights().length).toBe(2)

      // Swap order — references unchanged, should not throw or compute differently
      setItems([item2, item1])
      expect(result.heights()).toEqual([50, 50])

      dispose()
    })
  })
})

describe('computeItemHeight (Solid one-off)', () => {
  test('measures a single item without caching', () => {
    const s = schema({ children: [fixed(72)] })
    expect(computeItemHeight({ id: 1 }, s, 400)).toBe(72)
  })
})
