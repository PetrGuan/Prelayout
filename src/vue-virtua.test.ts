import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'
import { createVirtualStore } from 'virtua/unstable_core'
import { usePrelayoutVirtuaCache } from './vue-virtua.js'
import { schema, fixed } from './index.js'

describe('usePrelayoutVirtuaCache (Vue)', () => {
  test('returns reactive cache that virtua store accepts', () => {
    const s = schema({ children: [fixed(33)] })
    const items = ref<Record<string, unknown>[]>([{ id: 1 }, { id: 2 }])
    const width = ref(400)

    const { cache, widthKey, heights, totalHeight } = usePrelayoutVirtuaCache(
      items,
      s,
      width,
    )

    expect(heights.value).toEqual([33, 33])
    expect(totalHeight.value).toBe(66)
    expect(typeof widthKey.value).toBe('string')

    const store = createVirtualStore(2, 40, 0, cache.value)
    expect(store.$getItemSize(0)).toBe(33)
    expect(store.$getItemSize(1)).toBe(33)
  })

  test('widthKey changes when width changes', () => {
    const s = schema({ children: [fixed(33)] })
    const items = ref<Record<string, unknown>[]>([{ id: 1 }])
    const width = ref(400)

    const { widthKey } = usePrelayoutVirtuaCache(items, s, width)
    const initial = widthKey.value

    width.value = 500
    expect(widthKey.value).not.toBe(initial)
  })

  test('heights recompute when items change', () => {
    const s = schema({ children: [fixed(33)] })
    const items = ref<Record<string, unknown>[]>([{ id: 1 }])
    const width = ref(400)

    const { heights } = usePrelayoutVirtuaCache(items, s, width)
    expect(heights.value).toEqual([33])

    items.value = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(heights.value).toEqual([33, 33, 33])
  })
})
