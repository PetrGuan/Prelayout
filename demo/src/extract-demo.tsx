// Demo: CSS / Tailwind extraction utilities.
//
// Type Tailwind classes or CSS values and see them converted to schema
// constants in real time.

import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { fromCSS, fromTailwind } from 'prelayout'

type Row = { label: string; input: string; fn: (v: string) => unknown; placeholder: string }

const rows: Row[] = [
  { label: 'fromTailwind.padding', input: 'px-4 py-3', fn: v => fromTailwind.padding(v), placeholder: 'e.g. px-4 py-3' },
  { label: 'fromTailwind.gap', input: 'gap-2', fn: v => fromTailwind.gap(v), placeholder: 'e.g. gap-2' },
  { label: 'fromTailwind.height', input: 'h-10', fn: v => fromTailwind.height(v), placeholder: 'e.g. h-10' },
  { label: 'fromTailwind.text', input: 'text-sm', fn: v => fromTailwind.text(v), placeholder: 'e.g. text-sm' },
  { label: 'fromCSS.padding', input: '12px 16px', fn: v => fromCSS.padding(v), placeholder: 'e.g. 12px 16px' },
  { label: 'fromCSS.px', input: '2.5rem', fn: v => fromCSS.px(v), placeholder: 'e.g. 2.5rem' },
  { label: 'fromCSS.lineHeight', input: '1.5', fn: v => fromCSS.lineHeight(v, 16), placeholder: 'e.g. 22px or 1.5' },
]

function App() {
  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(rows.map(r => [r.label, r.input]))
  )

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>CSS / Tailwind Extraction</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        Type CSS or Tailwind values and see the schema-compatible output in real time.
      </p>

      <table style={{ marginTop: 24, width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Function</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Input</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Output</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const val = inputs[r.label] ?? ''
            let output: string
            try {
              const result = r.fn(val)
              output = JSON.stringify(result)
            } catch {
              output = 'error'
            }
            return (
              <tr key={r.label} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '8px 12px', color: '#8b8bf5', fontFamily: 'monospace', fontSize: 13 }}>{r.label}</td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    value={val}
                    onChange={e => setInputs(prev => ({ ...prev, [r.label]: e.target.value }))}
                    placeholder={r.placeholder}
                    style={{
                      width: '100%', padding: '6px 10px', background: '#111',
                      border: '1px solid #333', borderRadius: 4, color: '#e5e5e5',
                      fontSize: 14, fontFamily: 'monospace',
                    }}
                  />
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: '#4ade80' }}>{output}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 32, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Generated Schema</h2>
        <pre style={{ fontSize: 13, color: '#888', lineHeight: 1.6, overflow: 'auto' }}>
{`import { schema, fixed, text, fromTailwind } from 'prelayout'

const s = schema({
  padding: ${JSON.stringify(fromTailwind.padding(inputs['fromTailwind.padding'] ?? 'p-0'))},
  gap: ${fromTailwind.gap(inputs['fromTailwind.gap'] ?? 'gap-0')},
  children: [
    fixed(${fromTailwind.height(inputs['fromTailwind.height'] ?? 'h-0')}),
    text('body', {
      font: '14px Inter',
      ...${JSON.stringify(fromTailwind.text(inputs['fromTailwind.text'] ?? 'text-base'))},
    }),
  ],
})`}
        </pre>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
