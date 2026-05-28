# Prelayout × virtua Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four `prelayout/*-virtua` integration entry points (React/Vue/Solid/Svelte) plus a new `prelayout/solid` core hook, enabling Prelayout's predicted heights to seed virtua's `cache` prop so virtual lists hit first paint with exact item sizes.

**Architecture:** Each `*-virtua.ts` is a thin wrapper around the framework's existing core `usePrelayout` (or `createPrelayout` for Svelte/Solid). It builds a synthetic `CacheSnapshot` — virtua's internal `[sizes: number[], defaultSize: number]` tuple — plus a `widthKey` string. Users choose between **static mode** (pass `cache` only; virtua's ResizeObserver tracks subsequent resizes) or **reset mode** (also pass `key={widthKey}` to force remount on width change). No changes to virtua upstream; no wrapper components.

**Tech Stack:** TypeScript (strict), bun test, virtua ≥0.40.0 (optional peer), solid-js ≥1.8.0 (optional peer), happy-dom for React hook tests.

**Spec:** `Prelayout/docs/superpowers/specs/2026-05-28-prelayout-virtua-integration-design.md`

---

## File Structure

```
Prelayout/
├── src/
│   ├── cache-utils.ts                 ← NEW (shared buildCache + buildWidthKey)
│   ├── cache-utils.test.ts            ← NEW (pure unit + contract against virtua)
│   ├── solid.ts                       ← NEW (Solid core createPrelayout)
│   ├── solid.test.ts                  ← NEW
│   ├── react-virtua.ts                ← NEW
│   ├── react-virtua.test.ts           ← NEW (unit + happy-dom renderHook)
│   ├── vue-virtua.ts                  ← NEW
│   ├── vue-virtua.test.ts             ← NEW
│   ├── solid-virtua.ts                ← NEW
│   ├── solid-virtua.test.ts           ← NEW
│   ├── svelte-virtua.ts               ← NEW
│   └── svelte-virtua.test.ts          ← NEW
├── package.json                        ← MODIFY (exports + peerDeps + devDeps)
├── bunfig.toml                         ← NEW (preload happy-dom for React tests)
├── happydom.ts                         ← NEW (happy-dom registrator)
└── README.md                           ← MODIFY (new "virtua Integration" section)
```

**Boundaries:** `cache-utils.ts` owns the cache shape contract with virtua. Each `*-virtua.ts` owns one framework's reactive wiring and does nothing else — they delegate height prediction to existing core hooks. `solid.ts` mirrors `svelte.ts`'s factory pattern with Solid signals.

---

## Task 1: Shared cache utilities (foundation)

**Files:**
- Create: `Prelayout/src/cache-utils.ts`
- Create: `Prelayout/src/cache-utils.test.ts`
- Modify: `Prelayout/package.json` (add `virtua` to devDependencies)

These pure functions are the contract surface with virtua. Build first so every framework hook can import them.

- [ ] **Step 1.0: Install virtua as a dev dependency**

`cache-utils.ts` imports `CacheSnapshot` type from virtua, so we install it before writing any code. (Production peer-dependency entry comes in Task 8.)

Run from `Prelayout/`:

```bash
bun add -d virtua
```

Verify the unstable_core entry exposes `createVirtualStore`:

```bash
bun -e "import('virtua/unstable_core').then(m => console.log(typeof m.createVirtualStore))"
```

Expected output: `function`

- [ ] **Step 1.1: Write the failing test file**

Create `Prelayout/src/cache-utils.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { buildCache, buildWidthKey, type VirtuaCacheTuple } from './cache-utils.js'

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
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run from `Prelayout/`:

```bash
bun test src/cache-utils.test.ts
```

Expected: FAIL with "Cannot find module './cache-utils.js'" or equivalent.

- [ ] **Step 1.3: Implement `cache-utils.ts`**

Create `Prelayout/src/cache-utils.ts`:

```ts
// Shared utilities for virtua framework integrations.
//
// virtua's CacheSnapshot is publicly opaque (interface { [cacheSymbol]: never })
// but internally is a tuple: [sizes: number[], defaultSize: number].
//
// This module pins that contract in one place so all four framework integrations
// (react-virtua, vue-virtua, solid-virtua, svelte-virtua) share the same shape.
// We re-export virtua's CacheSnapshot type so consumer code can pass our cache
// directly to <Virtualizer cache={...}> with no further casts.

import type { CacheSnapshot } from 'virtua'

/** virtua's internal cache shape — kept as a named type for clarity in tests. */
export type VirtuaCacheTuple = [sizes: number[], defaultSize: number]

/** Re-export so callers don't need a separate import. */
export type { CacheSnapshot } from 'virtua'

/**
 * Build a synthetic CacheSnapshot from Prelayout's predicted heights.
 *
 * defaultSize is the mean of predicted heights (or 40 when empty), used by virtua
 * as the placeholder size for any items appended to the list after mount.
 *
 * The heights array is copied because virtua mutates _sizes internally when
 * ResizeObserver fires with a different measurement.
 */
export function buildCache(heights: number[]): CacheSnapshot {
  const defaultSize =
    heights.length > 0
      ? heights.reduce((sum, h) => sum + h, 0) / heights.length
      : 40
  const tuple: VirtuaCacheTuple = [heights.slice(), defaultSize]
  return tuple as unknown as CacheSnapshot
}

/**
 * Build a stable key string from inputs that should trigger remount.
 *
 * Excludes `items` reference itself — content edits with unchanged length
 * are handled by virtua's per-item ResizeObserver, not remount.
 */
export function buildWidthKey(
  width: number,
  itemCount: number,
  schemaKey: string,
): string {
  return `${width}|${itemCount}|${schemaKey}`
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run:

```bash
bun test src/cache-utils.test.ts
```

Expected: PASS, all 9 tests green.

- [ ] **Step 1.5: Commit**

Stage the source/test files plus the package.json change from Step 1.0 (and whichever lockfile your repo uses — `bun.lockb` or `package-lock.json`):

```bash
git add src/cache-utils.ts src/cache-utils.test.ts package.json
git add bun.lockb 2>/dev/null || git add package-lock.json 2>/dev/null || true
git commit -m "feat(cache-utils): add buildCache and buildWidthKey for virtua integration"
```

---

## Task 2: Contract test — buildCache plugs into virtua's actual store

**Files:**
- Modify: `Prelayout/src/cache-utils.test.ts` (append)

This is the most important test in the entire plan. It catches the day virtua changes its internal `InternalCacheSnapshot` shape, breaking our integration.

- [ ] **Step 2.1: Append the contract test to `cache-utils.test.ts`**

Add this block to the end of `Prelayout/src/cache-utils.test.ts`:

```ts
// ---- Contract test ----
// Verifies our buildCache produces a value virtua's actual store accepts.
// If virtua changes InternalCacheSnapshot shape upstream, this fails.

import { createVirtualStore } from 'virtua/unstable_core'

describe('buildCache ↔ virtua contract', () => {
  test('virtua store reflects predicted heights via getItemSize', () => {
    const cache = buildCache([10, 20, 30])
    // Args: elementsCount, itemSize, ssrCount, cacheSnapshot, shouldAutoEstimate
    const store = createVirtualStore(3, 40, 0, cache as unknown as never)
    expect(store.$getItemSize(0)).toBe(10)
    expect(store.$getItemSize(1)).toBe(20)
    expect(store.$getItemSize(2)).toBe(30)
  })

  test('empty cache + virtua store uses defaultSize for index lookups', () => {
    const cache = buildCache([])
    const store = createVirtualStore(3, 40, 0, cache as unknown as never)
    // No sizes in cache → virtua falls back to its default (40 from buildCache).
    expect(store.$getItemSize(0)).toBe(40)
  })
})
```

- [ ] **Step 2.2: Run the new contract tests**

Run:

```bash
bun test src/cache-utils.test.ts
```

Expected: all tests including the 2 new contract tests PASS. If they fail with TypeError or unexpected size values, virtua's cache contract has changed — investigate `virtua/src/core/types.ts` for the new shape.

- [ ] **Step 2.3: Commit**

```bash
git add src/cache-utils.test.ts
git commit -m "test(cache-utils): pin virtua cache contract via createVirtualStore"
```

---

## Task 3: Solid core hook (`prelayout/solid`)

**Files:**
- Create: `Prelayout/src/solid.ts`
- Create: `Prelayout/src/solid.test.ts`
- Modify: `Prelayout/package.json` (add `solid-js` to devDependencies)

Solid wasn't supported by Prelayout core before. We add it now because `solid-virtua` (Task 6) needs to call into it. Mirror `svelte.ts`'s factory pattern but use Solid signals.

- [ ] **Step 3.0: Install solid-js as a dev dependency**

`solid.ts` imports `createMemo`, `Accessor` from solid-js, so install it before writing any code. (Production peer-dependency entry comes in Task 8.)

Run from `Prelayout/`:

```bash
bun add -d solid-js
```

- [ ] **Step 3.1: Write the failing test**

Create `Prelayout/src/solid.test.ts`:

```ts
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
```

- [ ] **Step 3.2: Run the test to verify it fails**

```bash
bun test src/solid.test.ts
```

Expected: FAIL with "Cannot find module './solid.js'".

- [ ] **Step 3.3: Implement `solid.ts`**

Create `Prelayout/src/solid.ts`:

```ts
// Solid integration for Prelayout.
//
// createPrelayout() returns a factory with its own cache (mirrors svelte.ts).
// Each factory instance is independent — safe for multiple lists on the same page.
//
// Usage:
//
//   import { createPrelayout } from 'prelayout/solid'
//
//   const prelayout = createPrelayout()
//   const result = prelayout.computeHeights(items, schema, width)
//   // result.heights() — Accessor<number[]>
//   // result.totalHeight() — Accessor<number>
//   // result.getItemHeight(index) — plain function (not reactive)

import { createMemo, type Accessor } from 'solid-js'
import type { Schema } from './schema.js'
import { prepareItem, type PreparedItem } from './prepare.js'
import { layoutItem } from './layout.js'

export type PrelayoutSolidResult = {
  heights: Accessor<number[]>
  totalHeight: Accessor<number>
  getItemHeight: (index: number) => number
}

export function createPrelayout() {
  let cachedItems: Record<string, unknown>[] = []
  let cachedPrepared: PreparedItem[] = []
  let cachedSchemaRef: Schema | null = null
  let cachedSchemaKey = ''

  function computeHeights(
    items: Accessor<Record<string, unknown>[]>,
    schema: Schema,
    containerWidth: Accessor<number>,
  ): PrelayoutSolidResult {
    const prepared = createMemo<PreparedItem[]>(() => {
      const currentItems = items()
      let schemaChanged = false
      if (schema !== cachedSchemaRef) {
        const key = JSON.stringify(schema)
        schemaChanged = key !== cachedSchemaKey
        cachedSchemaKey = key
        cachedSchemaRef = schema
      }

      const next: PreparedItem[] = new Array(currentItems.length)
      for (let i = 0; i < currentItems.length; i++) {
        if (!schemaChanged && i < cachedItems.length && cachedItems[i] === currentItems[i]) {
          next[i] = cachedPrepared[i]!
        } else {
          next[i] = prepareItem(currentItems[i]!, schema)
        }
      }
      cachedItems = currentItems
      cachedPrepared = next
      return next
    })

    const heights = createMemo<number[]>(() => {
      const width = containerWidth()
      return prepared().map((p) => layoutItem(p, width, schema))
    })

    const totalHeight = createMemo(() => {
      let total = 0
      for (const h of heights()) total += h
      return total
    })

    function getItemHeight(index: number): number {
      return heights()[index] ?? 0
    }

    return { heights, totalHeight, getItemHeight }
  }

  return { computeHeights }
}

/** One-off measurement, no caching. */
export function computeItemHeight(
  data: Record<string, unknown>,
  schema: Schema,
  containerWidth: number,
): number {
  const prepared = prepareItem(data, schema)
  return layoutItem(prepared, containerWidth, schema)
}
```

- [ ] **Step 3.4: Run the test to verify it passes**

```bash
bun test src/solid.test.ts
```

Expected: PASS, all 3 tests green.

- [ ] **Step 3.5: Commit**

Include the package.json change from Step 3.0:

```bash
git add src/solid.ts src/solid.test.ts package.json
git add bun.lockb 2>/dev/null || git add package-lock.json 2>/dev/null || true
git commit -m "feat(solid): add createPrelayout core hook for Solid"
```

---

## Task 4: React virtua integration (`prelayout/react-virtua`)

**Files:**
- Create: `Prelayout/src/react-virtua.ts`
- Create: `Prelayout/src/react-virtua.test.ts`
- Create: `Prelayout/bunfig.toml`
- Create: `Prelayout/happydom.ts`
- Modify: `Prelayout/package.json` (add @testing-library/react, react-dom, @happy-dom/global-registrator)

React hook tests need DOM (happy-dom) because `renderHook` from @testing-library/react relies on it. Other frameworks' hook tests don't need DOM.

- [ ] **Step 4.1: Install DOM test deps**

```bash
bun add -d @testing-library/react react-dom @types/react-dom @happy-dom/global-registrator
```

- [ ] **Step 4.2: Set up happy-dom preload**

Create `Prelayout/happydom.ts`:

```ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'
GlobalRegistrator.register()
```

Create `Prelayout/bunfig.toml`:

```toml
[test]
preload = ["./happydom.ts"]
```

- [ ] **Step 4.3: Verify existing tests still pass under happy-dom**

```bash
bun test src/index.test.ts src/cache-utils.test.ts src/solid.test.ts
```

Expected: all pass. happy-dom registration is a no-op for pure-arithmetic tests.

- [ ] **Step 4.4: Write the failing React virtua test**

Create `Prelayout/src/react-virtua.test.ts`:

```ts
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

    const store = createVirtualStore(3, 40, 0, result.current.cache as unknown as never)
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
    const initial = [{ id: 1 }, { id: 2 }]

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
```

- [ ] **Step 4.5: Run the test to verify it fails**

```bash
bun test src/react-virtua.test.ts
```

Expected: FAIL with "Cannot find module './react-virtua.js'".

- [ ] **Step 4.6: Implement `react-virtua.ts`**

Create `Prelayout/src/react-virtua.ts`:

```ts
// virtua integration for React.
//
// Returns a synthetic CacheSnapshot built from Prelayout's predicted heights,
// plus a widthKey string for optional remount-on-resize.
//
// Usage:
//
//   import { usePrelayoutVirtuaCache } from 'prelayout/react-virtua'
//   import { VList } from 'virtua'
//
//   const { cache, widthKey } = usePrelayoutVirtuaCache(items, schema, width)
//
//   // Static mode — virtua's ResizeObserver tracks subsequent resizes
//   <VList cache={cache}>{(item, i) => <Card item={item} />}</VList>
//
//   // Reset mode — force remount when width changes
//   <VList key={widthKey} cache={cache}>{(item, i) => <Card item={item} />}</VList>

import { useMemo } from 'react'
import type { Schema } from './schema.js'
import { usePrelayout } from './react.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutVirtuaCacheResult = {
  cache: CacheSnapshot
  widthKey: string
  heights: number[]
  totalHeight: number
}

export function usePrelayoutVirtuaCache(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): PrelayoutVirtuaCacheResult {
  const { heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const cache = useMemo(() => buildCache(heights), [heights])

  // Reuse usePrelayout's stabilized schema key by re-serializing here — cheap
  // (the schema object identity is already stable across renders unless really
  // changed) and keeps this hook decoupled from internal state.
  const widthKey = useMemo(
    () => buildWidthKey(containerWidth, items.length, JSON.stringify(schema)),
    [containerWidth, items.length, schema],
  )

  return { cache, widthKey, heights, totalHeight }
}
```

- [ ] **Step 4.7: Run the test to verify it passes**

```bash
bun test src/react-virtua.test.ts
```

Expected: PASS, all 4 tests green.

- [ ] **Step 4.8: Commit**

```bash
git add src/react-virtua.ts src/react-virtua.test.ts bunfig.toml happydom.ts package.json bun.lockb 2>/dev/null
git commit -m "feat(react-virtua): add usePrelayoutVirtuaCache hook for virtua"
```

---

## Task 5: Vue virtua integration (`prelayout/vue-virtua`)

**Files:**
- Create: `Prelayout/src/vue-virtua.ts`
- Create: `Prelayout/src/vue-virtua.test.ts`

Vue's `ref` and `computed` work in bun without DOM. No happy-dom needed for this test file.

- [ ] **Step 5.1: Write the failing test**

Create `Prelayout/src/vue-virtua.test.ts`:

```ts
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

    const store = createVirtualStore(2, 40, 0, cache.value as unknown as never)
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
```

- [ ] **Step 5.2: Run the test to verify it fails**

```bash
bun test src/vue-virtua.test.ts
```

Expected: FAIL with "Cannot find module './vue-virtua.js'".

- [ ] **Step 5.3: Implement `vue-virtua.ts`**

Create `Prelayout/src/vue-virtua.ts`:

```ts
// virtua integration for Vue.
//
// Returns reactive computeds for cache, widthKey, heights, totalHeight.
//
// Usage:
//
//   <script setup>
//   import { ref } from 'vue'
//   import { VList } from 'virtua/vue'
//   import { usePrelayoutVirtuaCache } from 'prelayout/vue-virtua'
//
//   const items = ref([...])
//   const width = ref(480)
//   const { cache, widthKey } = usePrelayoutVirtuaCache(items, schema, width)
//   </script>
//
//   <template>
//     <!-- static mode -->
//     <VList :cache="cache">...</VList>
//     <!-- reset mode -->
//     <VList :key="widthKey" :cache="cache">...</VList>
//   </template>

import { computed, isRef, type Ref, type ComputedRef } from 'vue'
import type { Schema } from './schema.js'
import { usePrelayout } from './vue.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutVueVirtuaCacheResult = {
  cache: ComputedRef<CacheSnapshot>
  widthKey: ComputedRef<string>
  heights: ComputedRef<number[]>
  totalHeight: ComputedRef<number>
}

export function usePrelayoutVirtuaCache(
  items: Ref<Record<string, unknown>[]>,
  schema: Ref<Schema> | Schema,
  containerWidth: Ref<number>,
): PrelayoutVueVirtuaCacheResult {
  const { heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const cache = computed(() => buildCache(heights.value))

  const widthKey = computed(() => {
    const schemaValue = isRef(schema) ? schema.value : schema
    return buildWidthKey(
      containerWidth.value,
      items.value.length,
      JSON.stringify(schemaValue),
    )
  })

  return { cache, widthKey, heights, totalHeight }
}
```

- [ ] **Step 5.4: Run the test to verify it passes**

```bash
bun test src/vue-virtua.test.ts
```

Expected: PASS, all 3 tests green.

- [ ] **Step 5.5: Commit**

```bash
git add src/vue-virtua.ts src/vue-virtua.test.ts
git commit -m "feat(vue-virtua): add usePrelayoutVirtuaCache composable for virtua"
```

---

## Task 6: Solid virtua integration (`prelayout/solid-virtua`)

**Files:**
- Create: `Prelayout/src/solid-virtua.ts`
- Create: `Prelayout/src/solid-virtua.test.ts`

Builds on Task 3's `solid.ts` core hook.

- [ ] **Step 6.1: Write the failing test**

Create `Prelayout/src/solid-virtua.test.ts`:

```ts
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

      const store = createVirtualStore(2, 40, 0, cache() as unknown as never)
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
```

- [ ] **Step 6.2: Run the test to verify it fails**

```bash
bun test src/solid-virtua.test.ts
```

Expected: FAIL with "Cannot find module './solid-virtua.js'".

- [ ] **Step 6.3: Implement `solid-virtua.ts`**

Create `Prelayout/src/solid-virtua.ts`:

```ts
// virtua integration for Solid.
//
// Returns Accessors for cache/widthKey/heights/totalHeight.
//
// Usage:
//
//   import { createSignal } from 'solid-js'
//   import { VList } from 'virtua/solid'
//   import { createPrelayoutVirtuaCache } from 'prelayout/solid-virtua'
//
//   const [items, setItems] = createSignal([...])
//   const [width, setWidth] = createSignal(480)
//   const { cache, widthKey } = createPrelayoutVirtuaCache(items, schema, width)
//
//   // static mode
//   <VList cache={cache()}>{...}</VList>
//   // reset mode
//   <VList key={widthKey()} cache={cache()}>{...}</VList>

import { createMemo, type Accessor } from 'solid-js'
import type { Schema } from './schema.js'
import { createPrelayout } from './solid.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutSolidVirtuaCacheResult = {
  cache: Accessor<CacheSnapshot>
  widthKey: Accessor<string>
  heights: Accessor<number[]>
  totalHeight: Accessor<number>
}

// Per-call cache instance — multiple components on one page are safe because
// each call to createPrelayoutVirtuaCache gets its own createPrelayout factory.
export function createPrelayoutVirtuaCache(
  items: Accessor<Record<string, unknown>[]>,
  schema: Schema,
  containerWidth: Accessor<number>,
): PrelayoutSolidVirtuaCacheResult {
  const prelayout = createPrelayout()
  const { heights, totalHeight } = prelayout.computeHeights(items, schema, containerWidth)

  const cache = createMemo(() => buildCache(heights()))
  const widthKey = createMemo(() =>
    buildWidthKey(containerWidth(), items().length, JSON.stringify(schema)),
  )

  return { cache, widthKey, heights, totalHeight }
}
```

- [ ] **Step 6.4: Run the test to verify it passes**

```bash
bun test src/solid-virtua.test.ts
```

Expected: PASS, all 3 tests green.

- [ ] **Step 6.5: Commit**

```bash
git add src/solid-virtua.ts src/solid-virtua.test.ts
git commit -m "feat(solid-virtua): add createPrelayoutVirtuaCache for virtua"
```

---

## Task 7: Svelte virtua integration (`prelayout/svelte-virtua`)

**Files:**
- Create: `Prelayout/src/svelte-virtua.ts`
- Create: `Prelayout/src/svelte-virtua.test.ts`
- Modify: `Prelayout/package.json` (add svelte to devDependencies if missing)

Svelte 5 is already a peer dep but may not be in devDeps for tests. Install if needed.

- [ ] **Step 7.1: Install svelte devDep if not present**

Check if svelte is in `Prelayout/package.json` devDependencies. If not:

```bash
bun add -d svelte
```

If already present, skip.

- [ ] **Step 7.2: Write the failing test**

Create `Prelayout/src/svelte-virtua.test.ts`:

```ts
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

    const store = createVirtualStore(3, 40, 0, result.cache as unknown as never)
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
```

- [ ] **Step 7.3: Run the test to verify it fails**

```bash
bun test src/svelte-virtua.test.ts
```

Expected: FAIL with "Cannot find module './svelte-virtua.js'".

- [ ] **Step 7.4: Implement `svelte-virtua.ts`**

Create `Prelayout/src/svelte-virtua.ts`:

```ts
// virtua integration for Svelte 5.
//
// Factory function returns computeCache(items, schema, width) — call it inside
// $derived(...) for Svelte 5 reactivity.
//
// Usage:
//
//   <script>
//     import { VList } from 'virtua/svelte'
//     import { createPrelayoutVirtuaCache } from 'prelayout/svelte-virtua'
//
//     let items = $state([...])
//     let width = $state(480)
//     const factory = createPrelayoutVirtuaCache()
//     let result = $derived(factory.computeCache(items, schema, width))
//   </script>
//
//   <!-- static mode -->
//   <VList cache={result.cache}>...</VList>
//   <!-- reset mode -->
//   {#key result.widthKey}
//     <VList cache={result.cache}>...</VList>
//   {/key}

import type { Schema } from './schema.js'
import { createPrelayout } from './svelte.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutSvelteVirtuaCacheResult = {
  cache: CacheSnapshot
  widthKey: string
  heights: number[]
  totalHeight: number
}

export function createPrelayoutVirtuaCache() {
  const prelayout = createPrelayout()

  function computeCache(
    items: Record<string, unknown>[],
    schema: Schema,
    containerWidth: number,
  ): PrelayoutSvelteVirtuaCacheResult {
    const { heights, totalHeight } = prelayout.computeHeights(items, schema, containerWidth)
    const cache = buildCache(heights)
    const widthKey = buildWidthKey(containerWidth, items.length, JSON.stringify(schema))
    return { cache, widthKey, heights, totalHeight }
  }

  return { computeCache }
}
```

- [ ] **Step 7.5: Run the test to verify it passes**

```bash
bun test src/svelte-virtua.test.ts
```

Expected: PASS, all 3 tests green.

- [ ] **Step 7.6: Commit**

```bash
git add src/svelte-virtua.ts src/svelte-virtua.test.ts package.json bun.lockb 2>/dev/null
git commit -m "feat(svelte-virtua): add createPrelayoutVirtuaCache factory for virtua"
```

---

## Task 8: Wire up package.json exports + peer dependencies

**Files:**
- Modify: `Prelayout/package.json`

Five new public entry points (`./solid`, `./react-virtua`, `./vue-virtua`, `./solid-virtua`, `./svelte-virtua`), plus two new optional peer dependencies (`virtua`, `solid-js`).

- [ ] **Step 8.1: Add new exports**

In `Prelayout/package.json`, add these entries under `"exports"`. Keep the existing entries; insert the new ones to maintain alphabetical/logical grouping:

```jsonc
{
  "exports": {
    /* ... existing entries unchanged ... */
    "./solid": {
      "types": "./dist/solid.d.ts",
      "import": "./dist/solid.js",
      "default": "./dist/solid.js"
    },
    "./react-virtua": {
      "types": "./dist/react-virtua.d.ts",
      "import": "./dist/react-virtua.js",
      "default": "./dist/react-virtua.js"
    },
    "./vue-virtua": {
      "types": "./dist/vue-virtua.d.ts",
      "import": "./dist/vue-virtua.js",
      "default": "./dist/vue-virtua.js"
    },
    "./solid-virtua": {
      "types": "./dist/solid-virtua.d.ts",
      "import": "./dist/solid-virtua.js",
      "default": "./dist/solid-virtua.js"
    },
    "./svelte-virtua": {
      "types": "./dist/svelte-virtua.d.ts",
      "import": "./dist/svelte-virtua.js",
      "default": "./dist/svelte-virtua.js"
    }
  }
}
```

- [ ] **Step 8.2: Add peer dependencies**

In the same `package.json`, add these to `peerDependencies`:

```jsonc
{
  "peerDependencies": {
    /* ... existing entries unchanged ... */
    "virtua": ">=0.40.0",
    "solid-js": ">=1.8.0"
  }
}
```

And add to `peerDependenciesMeta` (so users without virtua/solid don't get installation warnings):

```jsonc
{
  "peerDependenciesMeta": {
    /* ... existing entries unchanged ... */
    "virtua": { "optional": true },
    "solid-js": { "optional": true }
  }
}
```

- [ ] **Step 8.3: Verify production build emits all new entry types**

Run from `Prelayout/`:

```bash
bun run build
```

Expected: `dist/` populated. Check the new files exist:

```bash
ls dist/solid.d.ts dist/solid.js dist/react-virtua.d.ts dist/react-virtua.js dist/vue-virtua.d.ts dist/vue-virtua.js dist/solid-virtua.d.ts dist/solid-virtua.js dist/svelte-virtua.d.ts dist/svelte-virtua.js
```

Expected: all 10 files listed (no "No such file" errors).

- [ ] **Step 8.4: Verify type check still passes**

```bash
bun run check
```

Expected: no errors. (`bun run check` runs `tsc` against the no-emit `tsconfig.json` which includes test files; this catches any type drift in tests or implementation.)

- [ ] **Step 8.5: Commit**

```bash
git add package.json
git commit -m "build: expose virtua integration entry points and peer deps"
```

---

## Task 9: README documentation

**Files:**
- Modify: `Prelayout/README.md`

Add a new top-level section "virtua Integration" after the "Vue Integration" or "Svelte" section. Mirror the structure of existing framework sections.

- [ ] **Step 9.1: Find the insertion point**

Open `Prelayout/README.md`. Find the section headed `## Svelte` (or whichever framework section is currently last before "React Native"). The new "virtua Integration" section will go right after Svelte (or before React Native — pick the most logical spot in the existing flow).

- [ ] **Step 9.2: Append the new section**

Insert this content (preserve existing surrounding sections):

````markdown
## virtua Integration

[virtua](https://github.com/inokawa/virtua) is a zero-config virtual list library for React/Vue/Solid/Svelte. Its `cache` prop accepts a `CacheSnapshot` at mount time — we feed it Prelayout's predicted heights so the list paints with exact sizes from the first frame.

### React

```tsx
import { VList } from 'virtua'
import { usePrelayoutVirtuaCache } from 'prelayout/react-virtua'

function CommentList({ items, width }) {
  const { cache, widthKey } = usePrelayoutVirtuaCache(items, commentSchema, width)

  // Static mode — virtua's internal ResizeObserver tracks any post-mount resizes
  return <VList cache={cache}>{(item, i) => <Comment item={item} />}</VList>

  // Reset mode — force a remount when width changes
  // return <VList key={widthKey} cache={cache}>{(item, i) => <Comment item={item} />}</VList>
}
```

### Vue

```vue
<script setup>
import { ref } from 'vue'
import { VList } from 'virtua/vue'
import { usePrelayoutVirtuaCache } from 'prelayout/vue-virtua'

const items = ref([...])
const width = ref(480)
const { cache, widthKey } = usePrelayoutVirtuaCache(items, commentSchema, width)
</script>

<template>
  <!-- static mode -->
  <VList :cache="cache">...</VList>
  <!-- reset mode -->
  <VList :key="widthKey" :cache="cache">...</VList>
</template>
```

### Solid

```tsx
import { createSignal } from 'solid-js'
import { VList } from 'virtua/solid'
import { createPrelayoutVirtuaCache } from 'prelayout/solid-virtua'

const [items, setItems] = createSignal([...])
const [width, setWidth] = createSignal(480)
const { cache, widthKey } = createPrelayoutVirtuaCache(items, commentSchema, width)

// static mode
<VList cache={cache()}>...</VList>
// reset mode
<VList key={widthKey()} cache={cache()}>...</VList>
```

### Svelte 5

```svelte
<script>
  import { VList } from 'virtua/svelte'
  import { createPrelayoutVirtuaCache } from 'prelayout/svelte-virtua'

  let items = $state([...])
  let width = $state(480)
  const factory = createPrelayoutVirtuaCache()
  let result = $derived(factory.computeCache(items, commentSchema, width))
</script>

<!-- static mode -->
<VList cache={result.cache}>...</VList>

<!-- reset mode -->
{#key result.widthKey}
  <VList cache={result.cache}>...</VList>
{/key}
```

### How it works

`cache` is virtua's `CacheSnapshot` — an opaque value containing the predicted height for each item. virtua consumes it at mount time, so `getItemSize`, `scrollToIndex`, and the scrollbar are exact from the first paint.

virtua's internal ResizeObserver still runs after mount. If a prediction is exact, the observer is a no-op. If your schema drifts slightly from CSS, virtua silently corrects the per-item size. If a prediction is badly wrong, the item will visibly snap to the real size — fix your schema.

### Scroll position on reset mode

Reset mode discards virtua's internal store (new mount, fresh state) so the scroll position resets to 0. To preserve it across width changes, snapshot the offset before remount and restore after:

```tsx
const ref = useRef<VirtualizerHandle>(null)
const lastOffset = useRef(0)

useEffect(() => {
  return () => {
    if (ref.current) lastOffset.current = ref.current.scrollOffset
  }
}, [widthKey])

useLayoutEffect(() => {
  if (ref.current && lastOffset.current) ref.current.scrollTo(lastOffset.current)
}, [widthKey])

<VList ref={ref} key={widthKey} cache={cache}>...</VList>
```

(Adapt per framework — the virtua handle exposes `scrollOffset` and `scrollTo` in all four bindings.)

### Limitations

- **Horizontal lists are not supported.** Prelayout predicts heights only. virtua's `horizontal: true` mode would need width prediction.
- **VGrid is not supported in this release.** VGrid lacks a `cache` prop, and width prediction requires 2D schema support. Tracked as future work.
- **`ssrCount` overrides cache for SSR.** If you also pass `ssrCount`, virtua renders that many items in SSR but still seeds the cache on hydration.
````

- [ ] **Step 9.3: Update the "Package Exports" table**

Find the existing table headed by `| Entry point | Description |` near the end of the README. Add these rows:

```markdown
| `prelayout/solid` | `createPrelayout()`, `computeItemHeight()` for Solid signals |
| `prelayout/react-virtua` | `usePrelayoutVirtuaCache()` for virtua (React) |
| `prelayout/vue-virtua` | `usePrelayoutVirtuaCache()` for virtua (Vue) |
| `prelayout/solid-virtua` | `createPrelayoutVirtuaCache()` for virtua (Solid) |
| `prelayout/svelte-virtua` | `createPrelayoutVirtuaCache()` for virtua (Svelte 5) |
```

- [ ] **Step 9.4: Update the "Install" section**

Find the "Install" section. Add new installation snippets after the existing ones:

```bash
# React + virtua
npm install prelayout @chenglou/pretext virtua

# Vue + virtua
npm install prelayout @chenglou/pretext vue virtua

# Solid + virtua
npm install prelayout @chenglou/pretext solid-js virtua

# Svelte + virtua
npm install prelayout @chenglou/pretext svelte virtua
```

- [ ] **Step 9.5: Commit**

```bash
git add README.md
git commit -m "docs: add virtua integration section to README"
```

---

## Final verification

Run the full test suite and type check to make sure nothing regressed:

- [ ] **Step F.1: Full test suite**

```bash
bun test
```

Expected: all tests green, including pre-existing `src/index.test.ts` and the 6 new test files (`cache-utils`, `solid`, `react-virtua`, `vue-virtua`, `solid-virtua`, `svelte-virtua`).

- [ ] **Step F.2: Type check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step F.3: Production build**

```bash
bun run build
```

Expected: `dist/` regenerated with all entry points (re-verify the 10 files from Step 8.3).

---

## Acceptance criteria (from spec §10)

Mark each as complete:

- [ ] Four `*-virtua` entry points built; `dist/` contains their `.js` + `.d.ts`
- [ ] `prelayout/solid` core hook built; mirrors React/Vue/Svelte cache behavior
- [ ] Contract test (`cache-utils.test.ts`) passes — virtua's `createVirtualStore` accepts our `buildCache` output and `getItemSize` returns predicted heights
- [ ] Four framework-specific hook tests pass (`react-virtua.test.ts`, `vue-virtua.test.ts`, `solid-virtua.test.ts`, `svelte-virtua.test.ts`) — each exercises the hook + verifies cache against virtua's store
- [ ] Reset / static mode behavior verified by widthKey tests
- [ ] README has "virtua Integration" section with all 4 frameworks + scroll restoration template
- [ ] `peerDependenciesMeta` marks `virtua` and `solid-js` as optional — existing Prelayout users without them are unaffected

---

## Notes / decisions deferred to implementer

- **Schema-key utility extraction** (spec §4 "可选"): if you find yourself touching `react.ts`/`vue.ts`/`svelte.ts` to deduplicate the `JSON.stringify(schema)` logic, do it in a separate commit after Task 9. Not required for acceptance.
- **Bun vs vitest for framework DOM tests:** this plan uses bun + happy-dom for React. Vue/Solid/Svelte hook tests run without DOM. If you want full `<Virtualizer>`-mount tests for the non-React frameworks, that's separate scope — the cache contract test already covers the integration-correctness path.
- **lockfile**: this plan assumes bun lockfile (`bun.lockb`). If your local copy uses npm, substitute `package-lock.json` in the `git add` lines.
