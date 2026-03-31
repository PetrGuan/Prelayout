// Quick probe: measure the "Code in text" string at various widths
// to find where Prelayout and DOM disagree.

import { createRoot } from 'react-dom/client'
import { useRef, useEffect, useState } from 'react'
import { schema, fixed, text, prepareItem, layoutItem } from 'prelayout'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22
const BODY = 'Call `prepareItem(data, schema)` once, then `layoutItem(prepared, width, schema)` on every resize. The prepared handle is width-independent — reuse it at any maxWidth.'

const cardSchema = schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [fixed(20), text('body', { font: FONT, lineHeight: LINE_HEIGHT }), fixed(20)],
})

function App() {
  const ref = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<{ width: number; predicted: number; actual: number; diff: number; pLines: number; aLines: number }[]>([])

  useEffect(() => {
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        const container = ref.current!
        const rows: typeof results = []
        for (let w = 400; w <= 600; w += 10) {
          container.style.width = `${w}px`
          const card = container.querySelector('[data-probe]') as HTMLElement
          const actual = card.getBoundingClientRect().height
          const prepared = prepareItem({ body: BODY } as Record<string, unknown>, cardSchema)
          const predicted = layoutItem(prepared, w, cardSchema)
          const pLines = Math.round((predicted - 12 - 20 - 8 - 8 - 20 - 13) / LINE_HEIGHT)
          const aLines = Math.round((actual - 12 - 20 - 8 - 8 - 20 - 13) / LINE_HEIGHT)
          rows.push({ width: w, predicted, actual, diff: predicted - actual, pLines, aLines })
        }
        setResults(rows)
      })
    })
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#0a0a0a', color: '#e5e5e5' }}>
      <h1 style={{ fontSize: 18 }}>Probe: "Code in text" at varying widths</h1>
      <table style={{ marginTop: 16, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>Width</th>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>Predicted</th>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>Actual</th>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>Diff</th>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>P lines</th>
            <th style={{ padding: '4px 12px', textAlign: 'right' }}>A lines</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.width} style={{ borderBottom: '1px solid #1a1a1a', color: r.diff !== 0 ? '#f87171' : '#4ade80' }}>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.width}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.predicted}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.actual}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.diff}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.pLines}</td>
              <td style={{ padding: '4px 12px', textAlign: 'right' }}>{r.aLines}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={ref} style={{ position: 'absolute', left: -9999, top: 0, width: 480, visibility: 'hidden' }}>
        <div data-probe style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
          <div style={{ height: 20 }} />
          <div style={{ marginTop: 8, font: FONT, lineHeight: `${LINE_HEIGHT}px`, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{BODY}</div>
          <div style={{ marginTop: 8, height: 20 }} />
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
