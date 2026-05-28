import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { createVirtualStore } from 'virtua/unstable_core'
import { usePrelayoutVirtuaCache } from './react-virtua.js'
import { schema, fixed } from './index.js'

describe('usePrelayoutVirtuaCache (React)', () => {
  test('returns a cache that virtua store accepts and reflects predictions', () => {
    const s = schema({ children: [fixed(42)] })
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]

    const { result } = renderHook(() => usePrelayoutVirtuaCache(items, s, 400))

    expect(result.current.heights).toEqual([42, 42, 42])
    expect(result.current.totalHeight).toBe(126)

    const store = createVirtualStore(3, 40, 0, result.current.cache)
    expect(store.$getItemSize(0)).toBe(42)
    expect(store.$getItemSize(2)).toBe(42)
  })

  test('widthKey encodes width, item count, and schema', () => {
    const s = schema({ children: [fixed(42)] })
    const items = [{ id: 1 }]

    const { result, rerender } = renderHook(
      ({ width }: { width: number }) => usePrelayoutVirtuaCache(items, s, width),
      { initialProps: { width: 400 } },
    )
    const firstKey = result.current.widthKey

    rerender({ width: 500 })
    expect(result.current.widthKey).not.toBe(firstKey)
  })

  test('widthKey is stable when only item content (not length) changes', () => {
    const s = schema({ children: [fixed(42)] })
    const initial: Record<string, unknown>[] = [{ id: 1 }, { id: 2 }]

    const { result, rerender } = renderHook(
      ({ items }: { items: Record<string, unknown>[] }) =>
        usePrelayoutVirtuaCache(items, s, 400),
      { initialProps: { items: initial } },
    )
    const firstKey = result.current.widthKey

    rerender({ items: [{ id: 1, body: 'edited' }, { id: 2 }] })
    expect(result.current.widthKey).toBe(firstKey)
  })

  test('widthKey changes when item count changes', () => {
    const s = schema({ children: [fixed(42)] })
    const { result, rerender } = renderHook(
      ({ items }: { items: Record<string, unknown>[] }) =>
        usePrelayoutVirtuaCache(items, s, 400),
      { initialProps: { items: [{ id: 1 }] } },
    )
    const firstKey = result.current.widthKey

    rerender({ items: [{ id: 1 }, { id: 2 }] })
    expect(result.current.widthKey).not.toBe(firstKey)
  })
})
