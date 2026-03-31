# Prelayout

Component-level height prediction for virtual scroll lists. Built on [Pretext](https://github.com/chenglou/pretext).

## The Problem

Virtual lists need item heights before rendering. Today you either assume fixed heights (inaccurate), use `measureElement` + `useLayoutEffect` (works well for sequential scrolling, but scroll-to-index and scrollbar size are based on estimates until items are measured), or use `ResizeObserver` (causes jumping).

## The Solution

Prelayout extends Pretext's two-phase model from text blocks to component layouts:

1. **Define a schema** describing your list item structure
2. **`prepareItem()`** measures all text fields via Pretext (one-time cost)
3. **`layoutItem()`** computes exact height via pure arithmetic (call on every resize)

```ts
import { schema, fixed, text, flexWrap, aspectRatio, row, group, conditional, prepareItem, layoutItem } from 'prelayout'

const commentSchema = schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(40),                                              // avatar + name row
    text('body', { font: '16px Inter', lineHeight: 22 }),   // comment text
    conditional('hasQuote', group({                          // quote box with its own padding
      padding: [8, 12, 8, 12],
      children: [text('quoteText', { font: '14px Inter', lineHeight: 20 })],
    })),
    conditional('hasImage', aspectRatio(9/16, { maxHeight: 400 })),  // responsive image
    flexWrap('tags', { font: '12px Inter', itemHeight: 24, itemPadding: 8, columnGap: 6, rowGap: 4 }),
    fixed(24),                                              // reaction bar
  ],
})

// Data shape — fields referenced by the schema above
const item = {
  body: 'This is a comment...',       // text('body')
  hasQuote: true,                      // conditional('hasQuote')
  quoteText: 'Original post...',       // text('quoteText')
  hasImage: true,                      // conditional('hasImage')
  tags: ['React', 'TypeScript'],       // flexWrap('tags')
}

// Prepare each item once (measures text via canvas)
const prepared = items.map(item => prepareItem(item, commentSchema))

// Layout on every resize — pure arithmetic, ~0.5µs per item
const heights = prepared.map(p => layoutItem(p, containerWidth, commentSchema))
```

## How It Works

Prelayout does **not** predict heights from scratch. It uses the browser's own measurement APIs once, then replays the layout decisions with pure arithmetic:

```
Phase 1 — prepare (one-time per item):
  Pretext segments text via Intl.Segmenter
  → measures each segment via canvas.measureText()
  → caches widths in a compact array
  flexWrap tags measured via canvas.measureText()

Phase 2 — layout (on every resize):
  Walks the schema children:
    fixed(40)        → add 40
    text('body')     → Pretext replays line-breaking with cached widths (pure addition)
    flexWrap('tags') → greedy row packing with cached tag widths (same algorithm)
    aspectRatio(r)   → contentWidth * r, capped by maxHeight
    group(...)       → recurse with inner padding
    conditional()    → check data field, skip or include
  Sum up with padding + gaps → exact height
```

The key insight: `layout()` never touches the DOM or canvas. It is pure arithmetic on cached numbers.

## Performance

Benchmarked on 10,000 comment items at 480px width (MacBook Pro):

| Phase | Total | Per item | Notes |
|-------|-------|----------|-------|
| `prepare()` | 346ms | 35µs | One-time cost — text segmentation + canvas measurement |
| `layout()` | 5.4ms | 0.5µs | Resize hot path — pure arithmetic |
| DOM measure | 511ms | 51µs | Baseline — render + `getBoundingClientRect` |

**`layout()` is ~100x faster than DOM measurement on the resize hot path.**

## Accuracy

Tested against 500 rendered comment items with variable text lengths, quotes, and images:

| Metric | Result |
|--------|--------|
| Exact match (<1px error) | **500/500 (100%)** |
| Average error | **0.00px** |
| Max error | **0.0px** |

Accuracy depends on the schema correctly describing your component's layout constants (padding, gaps, fixed heights, borders).

## Schema Primitives

| Primitive | Description |
|-----------|-------------|
| `fixed(height)` | Constant-height element (avatar row, button bar, divider) |
| `text(field, { font, lineHeight, maxLines?, minHeight? })` | Text field measured by Pretext. `maxLines` caps line count (CSS `-webkit-line-clamp`). `minHeight` sets a floor height |
| `flexWrap(field, { font, itemHeight, itemPadding?, columnGap?, rowGap? })` | Tag/chip row that wraps. `field` points to a `string[]` in data |
| `aspectRatio(ratio, { field?, maxHeight? })` | Element whose height = contentWidth × ratio (images, video). `field` overrides ratio per item from data. `maxHeight` caps the result |
| `row({ widths, gap?, children })` | Horizontal flex row — distributes widths to children, height = max child height. `widths` is `(number \| 'flex')[]` where `'flex'` splits remaining space equally |
| `group({ padding, gap, children })` | Nested vertical stack with its own padding (e.g. a quote box) |
| `conditional(field, child)` | Child included only when `data[field]` is truthy |
| `schema({ padding, gap, children })` | Top-level container defining the item structure |

`padding` accepts a number (uniform) or `[top, right, bottom, left]`. Include borders in padding (e.g. `13` = 12px padding + 1px border).

## React Integration

### @tanstack/react-virtual

```tsx
import { usePrelayout } from 'prelayout/react'

const { getItemHeight } = usePrelayout(items, commentSchema, width)

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: getItemHeight,  // exact — no measureElement needed
})
```

### react-window

```tsx
import { usePrelayoutItemSize } from 'prelayout/react-window'

const { itemSize } = usePrelayoutItemSize(items, commentSchema, width)

<VariableSizeList
  height={600}
  itemCount={items.length}
  itemSize={itemSize}
  width={width}
>
  {Row}
</VariableSizeList>
```

### Tanstack convenience wrapper

```tsx
import { useVirtualLayout } from 'prelayout/react-virtual'

const { virtualizer } = useVirtualLayout({
  items,
  schema: commentSchema,
  containerWidth: width,
  getScrollElement: () => scrollRef.current,
})
```

The React hooks handle memoization internally:
- Re-prepares only when items change (incremental — unchanged items reuse cached handles)
- Re-layouts only when `containerWidth` changes
- `schema` is stabilized by value — inline `schema({...})` is safe

## Vue Integration

### Core composable

```vue
<script setup>
import { ref } from 'vue'
import { usePrelayout } from 'prelayout/vue'

const items = ref([...])
const containerWidth = ref(480)

const { getItemHeight, heights, totalHeight } = usePrelayout(items, commentSchema, containerWidth)

// getItemHeight(index) — plain function, returns number
// heights.value — ComputedRef<number[]>, use .value in script
// totalHeight.value — ComputedRef<number>, auto-unwrapped in templates
</script>
```

Vue's fine-grained reactivity handles dependency tracking automatically — no manual dependency arrays.

### @tanstack/vue-virtual

```vue
<script setup>
import { ref } from 'vue'
import { useVirtualLayout } from 'prelayout/vue-virtual'

const items = ref([...])
const containerWidth = ref(480)
const scrollRef = ref(null)

const { virtualizer } = useVirtualLayout({
  items,
  schema: commentSchema,
  containerWidth,
  getScrollElement: () => scrollRef.value,
})
</script>
```

## Svelte

```svelte
<script>
  import { computeHeights } from 'prelayout/svelte'

  let items = $state([...])
  let containerWidth = $state(480)

  // $derived automatically recomputes when items or width change
  let result = $derived(computeHeights(items, commentSchema, containerWidth))

  // Use with @tanstack/svelte-virtual or any virtual list
  // result.getItemHeight(index) — returns height for item at index
  // result.heights — full height array
  // result.totalHeight — sum of all heights
</script>
```

Internally caches PreparedItem handles — unchanged items skip canvas measurement.

## React Native

Prelayout works in React Native with a custom text measurement function (since RN has no canvas):

```ts
import { prepareItemsRN, layoutItemRN, buildGetItemLayout } from 'prelayout/react-native'

// Provide your own text measure function (e.g. using react-native-text-size)
const measureText = async (text, font, maxWidth) => {
  const fontSize = parseInt(font) || 14
  const result = await measure({ text, fontSize, fontFamily: 'Inter', width: maxWidth })
  return { height: result.height, lineCount: result.lineCount }
}

// Prepare is async (measures text via native bridge at a specific width)
const prepared = await prepareItemsRN(items, schema, containerWidth, measureText)

// Layout is sync (pure arithmetic — sums prepared heights + padding/gaps)
const heights = prepared.map(p => layoutItemRN(p, schema))

// FlatList integration — enables instant scroll-to-index
const getItemLayout = buildGetItemLayout(heights)
<FlatList data={items} getItemLayout={getItemLayout} renderItem={...} />
```

**Important:** Unlike web, RN's `prepareItemsRN()` / `prepareItemRN()` bake in the container width during measurement. If the width changes (e.g. device rotation), re-prepare all items.

Same schema primitives as web — `fixed`, `text`, `row`, `aspectRatio`, `group`, `conditional` all work. `flexWrap` falls back to single-row estimate in RN (no canvas for tag width measurement).

## DevTools

Visual overlay that highlights predicted vs actual height differences:

```ts
import { createDevOverlay } from 'prelayout/devtools'

const overlay = createDevOverlay()

// Measure each visible item
for (const item of visibleItems) {
  overlay.measure(domElement, predictedHeight)
}

overlay.show()  // snapshot: renders colored borders on mismatched items + summary badge
overlay.hide()  // remove overlay
overlay.destroy()  // clean up

// Programmatic summary
const { exactMatches, totalItems, avgError, maxError } = overlay.summary()
```

## SSR Support

Pre-compute heights on the server to eliminate Cumulative Layout Shift (CLS):

```ts
import { serializePrepared, deserializePrepared, precomputeHeights } from 'prelayout/ssr'

// Client: serialize after prepare
const serialized = serializePrepared(prepared)

// Server: deserialize and layout (pure arithmetic, no canvas)
const restored = deserializePrepared(serialized, data)
const height = layoutItem(restored, containerWidth, schema)

// Or pre-compute for multiple breakpoints at once
const heightMap = precomputeHeights(preparedItems, schema, [320, 768, 1024, 1440])
// Map { 320 → [h1, h2, ...], 768 → [h1, h2, ...], ... }
```

> **Note:** SSR serialization relies on Pretext's `PreparedText` internal structure being JSON-safe. This is not a documented Pretext API guarantee. Pin your `@chenglou/pretext` version when using SSR serialization.

## Runtime Auto-Calibration

Schema not perfectly accurate? The auto-calibrator observes the first N rendered items, learns a correction, and applies it to all future predictions:

```ts
import { createAutoCalibrator } from 'prelayout'

const calibrator = createAutoCalibrator({
  sampleSize: 10,                          // observe 10 items before stabilizing
  onCalibrated: (correction) => {
    console.log(`Learned correction: ${correction}px`)
  },
})

// In your render loop, call observe() on each visible item
const correctedHeight = calibrator.observe(domElement, index, predictedHeight)

// After calibration, getCorrectedHeight() is pure arithmetic
const height = calibrator.getCorrectedHeight(predictedHeight)
```

## Incremental Prepare

When a single field changes (e.g. user edits body text), don't re-measure everything:

```ts
import { prepareItemIncremental } from 'prelayout'

// Only re-measures fields whose values differ between oldData and newData
const updated = prepareItemIncremental(prevPrepared, oldData, newData, schema)
```

Unchanged text fields reuse their cached `PreparedText` handles — zero canvas calls.

## CSS / Tailwind Extraction

Derive schema constants from your design tokens instead of hardcoding pixel values:

```ts
import { fromTailwind } from 'prelayout'

const s = schema({
  padding: fromTailwind.padding('px-4 py-3'),       // → [12, 16, 12, 16]
  gap: fromTailwind.gap('gap-2'),                    // → 8
  children: [
    fixed(fromTailwind.height('h-10')),              // → 40
    text('body', {
      font: '14px Inter',
      ...fromTailwind.text('text-sm'),               // → { fontSize: 14, lineHeight: 20 }
    }),
  ],
})
```

Also available: `fromCSS` for raw CSS values:

```ts
import { fromCSS } from 'prelayout'

schema({
  padding: fromCSS.padding('12px 16px'),    // → [12, 16, 12, 16]
  gap: fromCSS.px('8px'),                   // → 8
  children: [
    fixed(fromCSS.px('2.5rem')),            // → 40
  ],
})
```

## Manual Calibration

For more precise drift detection, Prelayout also provides manual calibration tools:

### `calibrate(element)` — extract layout constants from DOM

Annotate your component's children with `data-pl` attributes:

```tsx
function CommentCard({ item, rootRef }: Props) {
  return (
    <div ref={rootRef}>
      <div data-pl="header">...</div>
      <div data-pl="body">...</div>
      <div data-pl="actions">...</div>
    </div>
  )
}
```

Then extract the real numbers:

```ts
import { calibrate } from 'prelayout'

useEffect(() => {
  if (!rootRef.current) return
  const result = calibrate(rootRef.current)
  console.log(result)
  // { padding: [12, 16, 12, 16], gap: 8, children: [...], containerWidth: 480 }
}, [])
```

### `detectDrift(schema, calibration)` — compare schema against reality

```ts
import { detectDrift } from 'prelayout'

const drift = detectDrift(mySchema, calibrate(rootRef.current!))
if (drift.hasDrift) {
  console.warn('Schema drift detected:', drift)
}
```

Use this in development or CI to catch CSS-schema mismatches early.

## Install

```bash
# Core only
npm install prelayout @chenglou/pretext

# React + Tanstack
npm install prelayout @chenglou/pretext @tanstack/react-virtual

# React + react-window
npm install prelayout @chenglou/pretext react-window

# Vue + Tanstack
npm install prelayout @chenglou/pretext vue @tanstack/vue-virtual

# Svelte
npm install prelayout @chenglou/pretext

# React Native
npm install prelayout react-native-text-size
```

## Package Exports

| Entry point | Description |
|-------------|-------------|
| `prelayout` | Core: schema, prepare, layout, calibrate, auto-calibrate, incremental, extract |
| `prelayout/react` | `usePrelayout()` hook |
| `prelayout/react-virtual` | `useVirtualLayout()` for @tanstack/react-virtual |
| `prelayout/react-window` | `usePrelayoutItemSize()` for react-window |
| `prelayout/devtools` | `createDevOverlay()` visual debugging |
| `prelayout/ssr` | `serializePrepared()`, `deserializePrepared()`, `precomputeHeights()` |
| `prelayout/vue` | `usePrelayout()` Vue 3 composable |
| `prelayout/vue-virtual` | `useVirtualLayout()` for @tanstack/vue-virtual |
| `prelayout/svelte` | `computeHeights()`, `computeItemHeight()` for Svelte 5 runes |
| `prelayout/react-native` | `prepareItemRN()`, `prepareItemsRN()`, `layoutItemRN()`, `buildGetItemLayout()` |
| `prelayout/extract` | `fromCSS`, `fromTailwind` — also re-exported from `prelayout` |

## Use Case Demos

Beyond virtual lists, Prelayout enables layout patterns that traditionally require DOM measurement:

### Accordion — zero-flicker expand/collapse

```ts
// Know the panel height before opening → animate with CSS transition
const panelHeight = layoutItem(prepared, containerWidth, panelSchema)
// <div style={{ height: isOpen ? panelHeight : 0, transition: 'height 0.3s' }}>
```

No render-measure-animate cycle. The height is known before the first frame.

### Masonry — instant column assignment

```ts
// Predict every card's height, assign to shortest column
const heights = cards.map(card => layoutItem(prepared[card.id], columnWidth, cardSchema))
// Greedy: put each card in the column with the smallest totalHeight
```

No hidden pre-render pass. Cards go straight into the right column.

### Table rows — flex row with max cell height

```ts
// Each row has fixed + flex columns; row height = tallest cell
const tableRowSchema = schema({
  padding: 8,
  children: [
    row({
      widths: [150, 200, 'flex', 100],  // fixed, fixed, flex-fill, fixed
      gap: 8,
      children: [
        text('name', { font: '14px Inter', lineHeight: 20 }),
        text('desc', { font: '14px Inter', lineHeight: 20 }),
        text('notes', { font: '14px Inter', lineHeight: 20 }),
        fixed(36),  // action button column
      ],
    }),
  ],
})
```

### Chat — live height prediction while typing

```ts
// Predict bubble height as the user types
const draftHeight = layoutItem(prepareItem({ body: draft }, bubbleSchema), maxWidth, bubbleSchema)
// Virtual list uses predicted heights for all messages — instant scroll-to-bottom
```

Live demos: https://petrguan.github.io/Prelayout/

## Known Limitations

- **Schema must match CSS**: padding, gaps, and fixed heights are manually specified. Use `fromTailwind` / `fromCSS` to derive from tokens, `createAutoCalibrator()` for runtime correction, or `detectDrift()` for CI checks.
- **`system-ui` font**: canvas and DOM can resolve different fonts on macOS. Use named fonts (Inter, Helvetica, etc.).
- **Vertical lists only**: Prelayout computes heights, not widths. Horizontal virtual lists are not supported.

## License

MIT
