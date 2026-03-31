// Accordion demo: expand/collapse panels with predicted heights.
//
// The key trick: before opening a panel, we already know its exact expanded
// height via Prelayout. This lets us animate from height: 0 to height: Xpx
// with a CSS transition — no render-measure-animate cycle, zero flicker.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useMemo } from 'react'
import { schema, fixed, text, prepareItem, layoutItem } from 'prelayout'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22

const panelSchema = schema({
  padding: [16, 20, 16, 20],
  children: [
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
  ],
})

const faqItems = [
  {
    title: 'What is Prelayout?',
    body: 'Prelayout is a component-level height prediction library for virtual scroll lists. It extends Pretext\'s two-phase text measurement model from text blocks to full component layouts, enabling exact height prediction without DOM measurement.',
  },
  {
    title: 'How does it work?',
    body: 'It works in two phases. First, prepareItem() segments text and measures each word via canvas.measureText() — this is a one-time cost when data first appears. Second, layoutItem() walks the schema and computes height via pure arithmetic — no DOM, no canvas, no string work. This runs on every resize at ~0.5µs per item.',
  },
  {
    title: 'What about CJK, Arabic, and emoji?',
    body: 'Prelayout inherits Pretext\'s full Unicode support. Chinese/Japanese text breaks at character boundaries with proper kinsoku (punctuation prohibition) rules. Arabic text handles RTL layout. Thai text segments correctly without spaces. Emoji ZWJ sequences and flags are measured with canvas-to-DOM correction. In stress testing, 27 out of 28 adversarial cases across all these scripts achieved exact (<1px) accuracy.',
  },
  {
    title: 'How accurate is it?',
    body: 'In controlled testing with matching schema and CSS, Prelayout achieves 500/500 exact match (<1px error). The stress test across 28 adversarial multilingual cases scores 27/28. The one miss is a Pretext-level canvas vs DOM measurement discrepancy near line boundaries — not a Prelayout bug.',
  },
  {
    title: 'What frameworks does it support?',
    body: 'Prelayout provides React hooks out of the box: usePrelayout() for any virtualizer, useVirtualLayout() for @tanstack/react-virtual, and usePrelayoutItemSize() for react-window. The core prepare/layout functions are framework-agnostic and work anywhere with a canvas context.',
  },
  {
    title: 'Why not just use measureElement?',
    body: 'measureElement (from @tanstack/react-virtual) or ResizeObserver measures actual DOM height after rendering. This means: 1) the first render uses a guess, causing scrollbar jumps. 2) Every measurement triggers a reflow. 3) Jumping to distant items (e.g. item #5000) lands at the wrong position because the heights of items #0–4999 are still guesses. Prelayout knows all heights before the first render.',
  },
  {
    title: 'What if my schema is wrong?',
    body: 'Prelayout offers three levels of defense: 1) fromTailwind/fromCSS extract schema constants from your design tokens so you don\'t hardcode. 2) createAutoCalibrator() observes the first 10 rendered items and learns a height correction automatically. 3) detectDrift() compares your schema against actual DOM measurements and reports exactly which values drifted.',
  },
]

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return width
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(containerRef)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Pre-compute all panel heights
  const panelHeights = useMemo(() => {
    if (width === 0) return faqItems.map(() => 0)
    return faqItems.map(item => {
      const prepared = prepareItem(item as unknown as Record<string, unknown>, panelSchema)
      return layoutItem(prepared, width, panelSchema)
    })
  }, [width])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Accordion Demo</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        Panel heights are predicted before opening — the CSS transition animates to the exact height with zero flicker.
      </p>

      <div ref={containerRef} style={{ marginTop: 24 }}>
        {faqItems.map((item, i) => {
          const isOpen = openIndex === i
          const targetHeight = isOpen ? panelHeights[i]! : 0
          return (
            <div key={i} style={{ borderBottom: '1px solid #222' }}>
              {/* Header */}
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                  color: '#e5e5e5', fontSize: 16, fontWeight: 600, textAlign: 'left',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                {item.title}
                <span style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.3s ease',
                  fontSize: 12,
                }}>
                  ▼
                </span>
              </button>

              {/* Collapsible panel — height animated to predicted value */}
              <div style={{
                height: targetHeight,
                overflow: 'hidden',
                transition: 'height 0.3s ease',
              }}>
                <div style={{ padding: '0 20px 16px 20px' }}>
                  <div style={{ font: FONT, lineHeight: `${LINE_HEIGHT}px`, color: '#aaa' }}>
                    {item.body}
                  </div>
                </div>
              </div>

              {/* Height badge */}
              {isOpen && (
                <div style={{ padding: '0 20px 8px', fontSize: 11, color: '#555', fontFamily: 'monospace' }}>
                  predicted: {panelHeights[i]!.toFixed(0)}px
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
