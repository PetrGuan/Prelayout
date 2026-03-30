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
import { schema, fixed, text, conditional, prepareItem, layoutItem } from 'prelayout'

// Describe your list item structure once
const commentSchema = schema({
  padding: [12, 16, 12, 16],
  gap: 8,
  children: [
    fixed(40),                                              // avatar + name row
    text('body', { font: '16px Inter', lineHeight: 22 }),   // comment text
    fixed(24),                                              // reaction bar
    conditional('quote', text('quote', { font: '14px Inter', lineHeight: 20 })),
  ],
})

// Prepare each item once (measures text via canvas)
const prepared = items.map(item => prepareItem(item, commentSchema))

// Layout on every resize — pure arithmetic, ~0.002ms per item
const heights = prepared.map(p => layoutItem(p, containerWidth, commentSchema))
```

## Schema Primitives

- **`fixed(height)`** — constant-height element (avatar, button bar, divider)
- **`text(field, { font, lineHeight })`** — text measured by Pretext
- **`conditional(field, child)`** — child included only when `data[field]` is truthy

## Install

```bash
npm install prelayout @chenglou/pretext
```

## License

MIT
