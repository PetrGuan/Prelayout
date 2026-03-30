// Accuracy test: render every item to the DOM, measure its actual height,
// and compare against Prelayout's predicted height.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { schema, fixed, text, group, conditional, prepareItem, layoutItem } from 'prelayout'
import { generateComments, type CommentItem } from './data'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22
const QUOTE_FONT = '13px Inter, system-ui, sans-serif'
const QUOTE_LINE_HEIGHT = 18

const commentSchema = schema({
  padding: [12, 16, 13, 16], // 13 bottom = 12 padding + 1 borderBottom
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    conditional('quote', group({
      padding: [8, 12, 8, 12],
      children: [text('quote', { font: QUOTE_FONT, lineHeight: QUOTE_LINE_HEIGHT })],
    })),
    conditional('hasImage', fixed(200)),
    fixed(20),
  ],
})

// Render a comment card exactly like the main demo
function CommentCard({ item }: { item: CommentItem }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', height: 20, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
        <span style={{ color: '#666', fontSize: 12 }}>{item.time}</span>
      </div>
      <div style={{ marginTop: 8, font: FONT, lineHeight: `${LINE_HEIGHT}px`, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {item.body}
      </div>
      {item.quote && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#1a1a1a', borderLeft: '3px solid #333', borderRadius: 4, font: QUOTE_FONT, lineHeight: `${QUOTE_LINE_HEIGHT}px`, color: '#999' }}>
          {item.quote}
        </div>
      )}
      {item.hasImage && (
        <div style={{ marginTop: 8, height: 200, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13 }}>
          image placeholder
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 16, height: 20, alignItems: 'center', fontSize: 13, color: '#666' }}>
        <span>👍 {item.likes}</span>
        <span>💬 {item.replies}</span>
      </div>
    </div>
  )
}

type AccuracyRow = {
  index: number
  predicted: number
  actual: number
  diff: number
  absDiff: number
  item: CommentItem
}

const TEST_COUNT = 500 // measure 500 items at the current width
const CONTAINER_WIDTH = 480

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<AccuracyRow[] | null>(null)
  const [running, setRunning] = useState(false)
  const [width, setWidth] = useState(CONTAINER_WIDTH)

  const items = useRef(generateComments(TEST_COUNT)).current

  const runTest = useCallback(() => {
    if (!containerRef.current) return
    setRunning(true)

    // Wait for fonts + render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = containerRef.current!
        const cards = container.querySelectorAll<HTMLElement>('[data-testcard]')
        const rows: AccuracyRow[] = []

        for (let i = 0; i < items.length; i++) {
          const card = cards[i]
          if (!card) continue

          const actual = card.getBoundingClientRect().height
          const prepared = prepareItem(items[i]! as unknown as Record<string, unknown>, commentSchema)
          const predicted = layoutItem(prepared, width, commentSchema)
          const diff = predicted - actual
          rows.push({ index: i, predicted, actual, diff, absDiff: Math.abs(diff), item: items[i]! })
        }

        rows.sort((a, b) => b.absDiff - a.absDiff)
        setResults(rows)
        setRunning(false)
      })
    })
  }, [items, width])

  // Auto-run on mount
  useEffect(() => {
    const timer = setTimeout(runTest, 500) // wait for fonts
    return () => clearTimeout(timer)
  }, [runTest])

  const exactMatches = results?.filter(r => r.absDiff < 1).length ?? 0
  const closeMatches = results?.filter(r => r.absDiff < 3).length ?? 0
  const totalTested = results?.length ?? 0
  const maxDiff = results?.[0]?.absDiff ?? 0
  const avgDiff = totalTested > 0 ? results!.reduce((s, r) => s + r.absDiff, 0) / totalTested : 0

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Accuracy Test</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        Renders {TEST_COUNT} comments at {width}px width, compares Prelayout predicted height vs actual DOM height.
      </p>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#888' }}>
          Width:
          <input
            type="number"
            value={width}
            onChange={e => setWidth(Number(e.target.value))}
            style={{ marginLeft: 8, width: 80, padding: '4px 8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#e5e5e5', fontSize: 13 }}
          />
          px
        </label>
        <button onClick={runTest} disabled={running} style={{ padding: '6px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e5e5e5', fontSize: 13, cursor: 'pointer' }}>
          {running ? 'Running...' : 'Re-run'}
        </button>
      </div>

      {/* Summary */}
      {results && (
        <div style={{ marginTop: 20, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Stat label="Exact (<1px)" value={`${exactMatches}/${totalTested}`} pct={exactMatches / totalTested} color="#4ade80" />
            <Stat label="Close (<3px)" value={`${closeMatches}/${totalTested}`} pct={closeMatches / totalTested} color="#facc15" />
            <Stat label="Avg error" value={`${avgDiff.toFixed(2)}px`} color="#38bdf8" />
            <Stat label="Max error" value={`${maxDiff.toFixed(1)}px`} color={maxDiff > 10 ? '#f87171' : '#38bdf8'} />
          </div>
        </div>
      )}

      {/* Worst mismatches */}
      {results && results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Worst mismatches (sorted by error)</h2>
          <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>#</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Predicted</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Actual</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Diff</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Body preview</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 30).map(r => (
                <tr key={r.index} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '6px 8px' }}>{r.index}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.predicted.toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.actual.toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: r.absDiff < 1 ? '#4ade80' : r.absDiff < 3 ? '#facc15' : '#f87171' }}>
                    {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#666', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.item.body.slice(0, 80)}{r.item.body.length > 80 ? '...' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden render container — renders all items to measure actual heights */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', left: -9999, top: 0, width, visibility: 'hidden' }}
      >
        {items.map((item, i) => (
          <div key={i} data-testcard>
            <CommentCard item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, pct, color }: { label: string; value: string; pct?: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
      {pct !== undefined && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{(pct * 100).toFixed(1)}%</div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
