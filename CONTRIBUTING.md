# Contributing to Prelayout

Thanks for your interest in contributing!

## Setup

```bash
git clone https://github.com/PetrGuan/Prelayout.git
cd Prelayout
npm install

# Type-check
npx tsc

# Build
npx tsc -p tsconfig.build.json
```

## Demo

```bash
cd demo
npm install
npx vite
# Open http://localhost:5173/landing.html
```

## Project Structure

```
src/
  schema.ts         — Schema DSL (fixed, text, flexWrap, aspectRatio, group, conditional)
  prepare.ts        — Prepare phase: text measurement via Pretext + canvas
  layout.ts         — Layout phase: pure arithmetic height calculation
  calibrate.ts      — Auto-calibration and drift detection
  react.ts          — usePrelayout() React hook
  react-virtual.ts  — @tanstack/react-virtual integration
  react-window.ts   — react-window integration
  devtools.ts       — Visual debugging overlay
  ssr.ts            — Server-side serialization and pre-computation
  index.ts          — Public exports
  index.test.ts     — Unit tests

demo/
  src/              — Demo pages (showcase, stress test, benchmark, etc.)
```

## Guidelines

- Keep `layoutItem()` as the pure-arithmetic hot path — no DOM, no canvas, no string work
- New schema primitives go in `schema.ts` (type + builder) → `prepare.ts` (measurement) → `layout.ts` (arithmetic)
- Test with `src/index.test.ts` for schema/layout correctness
- Test with `demo/src/stress.tsx` for real-world accuracy (canvas + DOM)
- Run the accuracy and stress tests in a browser before submitting PRs that touch the text engine

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npx tsc` to type-check
5. Open a PR against `main`
