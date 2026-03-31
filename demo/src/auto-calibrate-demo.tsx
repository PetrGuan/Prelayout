// Demo: Runtime auto-calibration.
//
// Shows a deliberately WRONG schema (padding off by 8px) and demonstrates
// the auto-calibrator learning and correcting the error from the first
// 10 rendered items.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { schema, fixed, text, prepareItem, layoutItem, createAutoCalibrator } from 'prelayout'
import { generateComments, type CommentItem } from './data'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22

// Deliberately WRONG schema — padding is 4px instead of 12px (off by 8px each side)
const wrongSchema = schema({
  padding: [4, 16, 5, 16], // should be [12, 16, 13, 16]
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    fixed(20),
  ],
})

// Correct schema for comparison
const correctSchema = schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    fixed(20),
  ],
})

const items = generateComments(50)

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
      <div style={{ marginTop: 8, height: 20, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center' }}>
        ♥ {item.likes}
      </div>
    </div>
  )
}

function App() {
  const calibrator = useRef(createAutoCalibrator({
    sampleSize: 10,
    onCalibrated: (correction) => {
      setCorrectionValue(correction)
      setCalibrated(true)
    },
  })).current

  const [calibrated, setCalibrated] = useState(false)
  const [correctionValue, setCorrectionValue] = useState(0)
  const [observations, setObservations] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return
        const cards = containerRef.current.querySelectorAll<HTMLElement>('[data-card]')
        cards.forEach((card, i) => {
          const prepared = prepareItem(items[i]! as unknown as Record<string, unknown>, wrongSchema)
          const predicted = layoutItem(prepared, 480, wrongSchema)
          calibrator.observe(card, i, predicted)
        })
        setObservations(calibrator.observationCount)
        setMeasured(true)
      })
    })
  }, [calibrator])

  // Compute errors for display
  const rows = items.slice(0, 20).map((item, i) => {
    const prepared = prepareItem(item as unknown as Record<string, unknown>, wrongSchema)
    const wrongHeight = layoutItem(prepared, 480, wrongSchema)
    const correctedHeight = calibrator.getCorrectedHeight(wrongHeight)

    const correctPrepared = prepareItem(item as unknown as Record<string, unknown>, correctSchema)
    const correctHeight = layoutItem(correctPrepared, 480, correctSchema)

    return { index: i, wrongHeight, correctedHeight, correctHeight }
  })

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Auto-Calibration Demo</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        The schema is <strong style={{ color: '#f87171' }}>deliberately wrong</strong> — padding is 4px instead of 12px (8px error per side).
        The auto-calibrator learns the correction from the first 10 rendered items.
      </p>

      {/* Status */}
      <div style={{ marginTop: 16, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>Status</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: calibrated ? '#4ade80' : '#facc15', marginTop: 2 }}>
            {calibrated ? 'Calibrated' : 'Learning...'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>Observations</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>{observations}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>Learned Correction</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: correctionValue !== 0 ? '#4ade80' : '#888', marginTop: 2 }}>
            {correctionValue > 0 ? '+' : ''}{correctionValue.toFixed(1)}px
          </div>
        </div>
      </div>

      {/* Comparison table */}
      {measured && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Height Comparison (first 20 items)</h2>
          <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>#</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Wrong Schema</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Auto-Corrected</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Correct Schema</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Error (wrong)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Error (corrected)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const wrongErr = r.wrongHeight - r.correctHeight
                const corrErr = r.correctedHeight - r.correctHeight
                return (
                  <tr key={r.index} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.index}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f87171' }}>{r.wrongHeight.toFixed(0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4ade80' }}>{r.correctedHeight.toFixed(1)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#888' }}>{r.correctHeight.toFixed(0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f87171' }}>
                      {wrongErr > 0 ? '+' : ''}{wrongErr.toFixed(0)}px
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: Math.abs(corrErr) < 1 ? '#4ade80' : '#facc15' }}>
                      {corrErr > 0 ? '+' : ''}{corrErr.toFixed(1)}px
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden render container for calibration */}
      <div ref={containerRef} style={{ position: 'absolute', left: -9999, top: 0, width: 480, visibility: 'hidden' }}>
        {items.map((item, i) => (
          <div key={i} data-card>
            <CommentCard item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
