import { describe, expect, test } from 'bun:test'
import { createRoot, createSignal } from 'solid-js'
import { createVirtualStore } from 'virtua/unstable_core'
import { createPrelayoutVirtuaCache } from './solid-virtua.js'
import { schema, fixed } from './index.js'

describe('createPrelayoutVirtuaCache (Solid)', () => {
  test('returns Accessors for cache/widthKey/heights/totalHeight', () => {
    createRoot((dispose) => {
      const s = schema({ children: [fixed(27)] })
      const [items, _setItems] = createSignal<Record<string, unknown>[]>([
        { id: 1 },
        { id: 2 },
      ])
      const [width, _setWidth] = createSignal(400)

      const { cache, widthKey, heights, totalHeight } =
        createPrelayoutVirtuaCache(items, s, width)

      expect(heights()).toEqual([27, 27])
      expect(totalHeight()).toBe(54)
      expect(typeof widthKey()).toBe('string')

      const store = createVirtualStore(2, 40, 0, cache())
      expect(store.$getItemSize(0)).toBe(27)
      expect(store.$getItemSize(1)).toBe(27)

      dispose()
    })
  })

  test('widthKey changes when width signal changes', () => {
    createRoot((dispose) => {
      const s = schema({ children: [fixed(27)] })
      const [items] = createSignal<Record<string, unknown>[]>([{ id: 1 }])
      const [width, setWidth] = createSignal(400)

      const { widthKey } = createPrelayoutVirtuaCache(items, s, width)
      const initial = widthKey()

      setWidth(500)
      expect(widthKey()).not.toBe(initial)

      dispose()
    })
  })

  test('heights recompute when items signal changes', () => {
    createRoot((dispose) => {
      const s = schema({ children: [fixed(27)] })
      const [items, setItems] = createSignal<Record<string, unknown>[]>([{ id: 1 }])
      const [width] = createSignal(400)

      const { heights } = createPrelayoutVirtuaCache(items, s, width)
      expect(heights()).toEqual([27])

      setItems([{ id: 1 }, { id: 2 }, { id: 3 }])
      expect(heights()).toEqual([27, 27, 27])

      dispose()
    })
  })
})
