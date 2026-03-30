// Benchmark: Prelayout (prepare + layout) vs DOM measurement.
//
// Three phases measured independently:
//   1. prepare() — one-time text analysis + canvas measurement
//   2. layout()  — pure arithmetic height calculation (the resize hot path)
//   3. DOM       — render to hidden container + getBoundingClientRect (baseline)

import { createRoot } from 'react-dom/client'
import { useState, useRef, useCallback } from 'react'
import { schema, fixed, text, group, conditional, prepareItem, layoutItem } from 'prelayout'
import type { PreparedItem } from 'prelayout'
import { generateComments, type CommentItem } from './data'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22
const QUOTE_FONT = '13px Inter, system-ui, sans-serif'
const QUOTE_LINE_HEIGHT = 18

const commentSchema = schema({
  padding: [12, 16, 13, 16],
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

const WIDTHS = [320, 480, 640, 800]
const COUNTS = [100, 500, 1000, 5000, 10000]

type BenchmarkResult = {
  count: number
  prepareMs: number
  layoutMs: number
  layoutPerItem: number
  domMs: number
  domPerItem: number
  speedup: number
}

function buildCardHTML(item: CommentItem): string {
  let html = `<div style="padding:12px 16px;border-bottom:1px solid #222">`
  html += `<div style="display:flex;justify-content:space-between;height:20px;align-items:center"><span style="font-weight:600;font-size:14px">${item.name}</span><span style="color:#666;font-size:12px">${item.time}</span></div>`
  html += `<div style="margin-top:8px;font:${FONT};line-height:${LINE_HEIGHT}px;word-break:break-word;overflow-wrap:break-word">${item.body}</div>`
  if (item.quote) {
    html += `<div style="margin-top:8px;padding:8px 12px;background:#1a1a1a;border-left:3px solid #333;border-radius:4px;font:${QUOTE_FONT};line-height:${QUOTE_LINE_HEIGHT}px;color:#999">${item.quote}</div>`
  }
  if (item.hasImage) {
    html += `<div style="margin-top:8px;height:200px;background:#1a1a2e;border-radius:8px"></div>`
  }
  html += `<div style="margin-top:8px;display:flex;gap:16px;height:20px;align-items:center;font-size:13px;color:#666"><span>👍 ${item.likes}</span><span>💬 ${item.replies}</span></div>`
  html += `</div>`
  return html
}

function measureDOM(items: CommentItem[], width: number): number {
  const container = document.createElement('div')
  container.style.cssText = `position:absolute;left:-9999px;top:0;width:${width}px;visibility:hidden`
  // Build all HTML at once for realistic batch measurement
  container.innerHTML = items.map(item => `<div class="card">${buildCardHTML(item)}</div>`).join('')
  document.body.appendChild(container)

  // Force layout
  const cards = container.querySelectorAll<HTMLElement>('.card')
  const t0 = performance.now()
  const heights: number[] = []
  for (let i = 0; i < cards.length; i++) {
    heights.push(cards[i]!.getBoundingClientRect().height)
  }
  const t1 = performance.now()

  document.body.removeChild(container)
  return t1 - t0
}

function runBenchmark(count: number, width: number): BenchmarkResult {
  const items = generateComments(count)

  // Phase 1: prepare
  const t0 = performance.now()
  const prepared: PreparedItem[] = []
  for (let i = 0; i < items.length; i++) {
    prepared.push(prepareItem(items[i]! as unknown as Record<string, unknown>, commentSchema))
  }
  const t1 = performance.now()

  // Phase 2: layout (run 3x, take median to reduce noise)
  const layoutTimes: number[] = []
  for (let run = 0; run < 3; run++) {
    const lt0 = performance.now()
    for (let i = 0; i < prepared.length; i++) {
      layoutItem(prepared[i]!, width, commentSchema)
    }
    const lt1 = performance.now()
    layoutTimes.push(lt1 - lt0)
  }
  layoutTimes.sort((a, b) => a - b)
  const layoutMs = layoutTimes[1]! // median

  // Phase 3: DOM measurement
  // Insert HTML once, then measure — this is the fairest comparison
  // because it matches how measureElement works in practice
  const domMs = measureDOM(items, width)

  const prepareMs = t1 - t0

  return {
    count,
    prepareMs,
    layoutMs,
    layoutPerItem: layoutMs / count,
    domMs,
    domPerItem: domMs / count,
    speedup: domMs / layoutMs,
  }
}

function App() {
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [running, setRunning] = useState(false)
  const [width, setWidth] = useState(480)
  const [selectedCount, setSelectedCount] = useState<number | null>(null)

  const run = useCallback((count?: number) => {
    setRunning(true)
    // Use requestAnimationFrame to let UI update before blocking
    requestAnimationFrame(() => {
      const counts = count !== undefined ? [count] : COUNTS
      const newResults: BenchmarkResult[] = []
      for (const c of counts) {
        newResults.push(runBenchmark(c, width))
      }
      setResults(prev => {
        if (count !== undefined) {
          // Replace single result
          const filtered = prev.filter(r => r.count !== count)
          return [...filtered, ...newResults].sort((a, b) => a.count - b.count)
        }
        return newResults
      })
      setRunning(false)
    })
  }, [width])

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Performance Benchmark</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        Compares Prelayout (prepare + layout) vs DOM measurement (render + getBoundingClientRect)
      </p>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#888' }}>
          Width:
          <select
            value={width}
            onChange={e => setWidth(Number(e.target.value))}
            style={{ marginLeft: 8, padding: '4px 8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#e5e5e5', fontSize: 13 }}
          >
            {WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}
          </select>
        </label>
        <button
          onClick={() => run()}
          disabled={running}
          style={{ padding: '6px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e5e5e5', fontSize: 13, cursor: 'pointer' }}
        >
          {running ? 'Running...' : 'Run All'}
        </button>
        {COUNTS.map(c => (
          <button
            key={c}
            onClick={() => run(c)}
            disabled={running}
            style={{ padding: '4px 10px', background: '#111', border: '1px solid #282828', borderRadius: 4, color: '#aaa', fontSize: 12, cursor: 'pointer' }}
          >
            {c.toLocaleString()}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <table style={{ marginTop: 24, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Items</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>prepare()</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>layout()</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>layout/item</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>DOM measure</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>DOM/item</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Speedup</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.count} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{r.count.toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#facc15' }}>{fmt(r.prepareMs)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#4ade80' }}>{fmt(r.layoutMs)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#4ade80' }}>{fmtMicro(r.layoutPerItem)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#f87171' }}>{fmt(r.domMs)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#f87171' }}>{fmtMicro(r.domPerItem)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: r.speedup > 100 ? '#4ade80' : r.speedup > 10 ? '#facc15' : '#e5e5e5' }}>
                  {r.speedup > 1000 ? `${(r.speedup / 1000).toFixed(1)}k` : r.speedup.toFixed(0)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222', fontSize: 13, color: '#888' }}>
          <p><strong style={{ color: '#facc15' }}>prepare()</strong> = one-time cost when items first appear (text segmentation + canvas measureText)</p>
          <p style={{ marginTop: 4 }}><strong style={{ color: '#4ade80' }}>layout()</strong> = called on every resize — pure arithmetic, no DOM, no canvas</p>
          <p style={{ marginTop: 4 }}><strong style={{ color: '#f87171' }}>DOM measure</strong> = render to hidden container + getBoundingClientRect (what measureElement does)</p>
          <p style={{ marginTop: 8 }}><strong>Speedup</strong> = DOM measure time / layout() time — how many times faster layout() is on the resize hot path</p>
        </div>
      )}
    </div>
  )
}

function fmt(ms: number): string {
  if (ms < 0.01) return '<0.01ms'
  if (ms < 1) return `${ms.toFixed(2)}ms`
  if (ms < 10) return `${ms.toFixed(1)}ms`
  return `${Math.round(ms)}ms`
}

function fmtMicro(ms: number): string {
  const us = ms * 1000
  if (us < 0.1) return '<0.1\u00b5s'
  if (us < 10) return `${us.toFixed(1)}\u00b5s`
  return `${Math.round(us)}\u00b5s`
}

createRoot(document.getElementById('root')!).render(<App />)
