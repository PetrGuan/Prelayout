# Prelayout

Component-level height prediction for virtual scroll lists. Built on [Pretext](https://github.com/chenglou/pretext).

## The Problem

Virtual lists need item heights before rendering. Today you either assume fixed heights (inaccurate), render-then-measure (causes flicker), or use `ResizeObserver` (causes jumping).

## The Solution

Prelayout extends Pretext's two-phase model from text blocks to component layouts:

1. **Define a schema** describing your list item structure
2. **`prepareItem()`** measures all text fields via Pretext (one-time cost)
3. **`layoutItem()`** computes exact height via pure arithmetic (call on every resize)

```ts
import { schema, fixed, text, group, conditional, prepareItem, layoutItem } from 'prelayout'

const commentSchema = schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(40),                                              // avatar + name row
    text('body', { font: '16px Inter', lineHeight: 22 }),   // comment text
    conditional('quote', group({                            // quote box with its own padding
      padding: [8, 12, 8, 12],
      children: [text('quote', { font: '14px Inter', lineHeight: 20 })],
    })),
    conditional('hasImage', fixed(200)),                    // optional image
    fixed(24),                                              // reaction bar
  ],
})

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

Phase 2 — layout (on every resize):
  Walks the schema children:
    fixed(40)       → add 40
    text('body')    → Pretext replays line-breaking with cached widths (pure addition)
    flexWrap('tags')→ greedy row packing with cached tag widths (same algorithm)
    group(...)      → recurse with inner padding
    conditional()   → check data field, skip or include
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
| `text(field, { font, lineHeight, maxLines? })` | Text field measured by Pretext — wraps based on width. Optional `maxLines` caps line count (matches CSS `-webkit-line-clamp`) |
| `flexWrap(field, { font, itemHeight, itemPadding?, columnGap?, rowGap? })` | Tag/chip row that wraps based on width. `field` points to a `string[]` in data. Each item's text is measured via canvas, then greedy-packed into rows |
| `group({ padding, gap, children })` | Nested vertical stack with its own padding (e.g. a quote box) |
| `conditional(field, child)` | Child included only when `data[field]` is truthy |
| `schema({ padding, gap, children })` | Top-level container defining the item structure |

`padding` accepts a number (uniform) or `[top, right, bottom, left]`. Include borders in padding (e.g. `13` = 12px padding + 1px border).

`itemPadding` in `flexWrap` is the horizontal padding per tag (applied on both sides). `itemHeight` is the total rendered height including any vertical padding.

## React Integration

### Core hook — works with any virtualizer

```tsx
import { usePrelayout } from 'prelayout/react'

function CommentList({ items, schema }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const { getItemHeight } = usePrelayout(items, schema, width)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: getItemHeight,  // exact — no measureElement needed
  })

  // ... render virtualizer.getVirtualItems()
}
```

The hook handles memoization internally:
- Re-prepares only when items change (incremental — unchanged items reuse cached handles)
- Re-layouts only when `containerWidth` changes
- `schema` is stabilized by value — inline `schema({...})` is safe

### Tanstack convenience wrapper

```tsx
import { useVirtualLayout } from 'prelayout/react-virtual'

const { virtualizer } = useVirtualLayout({
  items,
  schema: commentSchema,
  containerWidth: width,
  getScrollElement: () => containerRef.current,
})
```

## Install

```bash
# Core only
npm install prelayout @chenglou/pretext

# With React + Tanstack integration
npm install prelayout @chenglou/pretext @tanstack/react-virtual
```

## Known Limitations

- **Schema must match CSS**: padding, gaps, and fixed heights are manually specified. If CSS changes but the schema doesn't, heights will drift.
- **`system-ui` font**: canvas and DOM can resolve different fonts on macOS. Use named fonts (Inter, Helvetica, etc.).

## License

MIT
