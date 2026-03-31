// Playground: write schema + data, see predicted vs actual height in real time.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useLayoutEffect, useMemo } from 'react'
import {
  schema, fixed, text, flexWrap, aspectRatio, row, group, conditional,
  prepareItem, layoutItem,
} from 'prelayout'
import type { Schema } from 'prelayout'

const MONO = 'Fira Code, monospace'

// --- Presets: each preset has matching schema, data, and render function ---
// NOTE: Render functions are static — they don't read the live schema.
// If you edit padding/gap in the schema editor, the prediction updates
// but the visual preview won't, causing an expected diff. Edit the data
// (text content) for accurate predicted vs actual comparisons.

type Preset = {
  name: string
  schema: string
  data: string
  render: (data: Record<string, unknown>, width: number) => React.ReactNode
}

const presets: Preset[] = [
  {
    name: 'Comment Card',
    schema: `schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: '15px Inter', lineHeight: 22 }),
    fixed(20),
  ],
})`,
    data: `{
  "body": "This is a comment with some text that will wrap to multiple lines depending on the container width. Prelayout predicts the exact height."
}`,
    render: (data) => (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ height: 20, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>User Name</div>
        <div style={{ marginTop: 8, font: '15px Inter', lineHeight: '22px', color: '#aaa', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {String(data.body ?? '')}
        </div>
        <div style={{ marginTop: 8, height: 20, display: 'flex', alignItems: 'center', fontSize: 13, color: '#666' }}>♥ 42</div>
      </div>
    ),
  },
  {
    name: 'Chat Bubble',
    schema: `schema({
  padding: [8, 12, 8, 12],
  gap: 4,
  children: [
    fixed(16),
    text('body', { font: '14px Inter', lineHeight: 20 }),
    fixed(14),
  ],
})`,
    data: `{
  "body": "Hey! Have you seen the Prelayout library? It predicts virtual list item heights without DOM measurement. Pretty cool stuff!"
}`,
    render: (data) => (
      <div style={{ padding: '8px 12px', background: '#222', borderRadius: 16 }}>
        <div style={{ height: 16, fontSize: 12, fontWeight: 600, color: '#8b8bf5', lineHeight: '16px' }}>Alice</div>
        <div style={{ marginTop: 4, font: '14px Inter', lineHeight: '20px', color: '#e5e5e5', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {String(data.body ?? '')}
        </div>
        <div style={{ marginTop: 4, height: 14, fontSize: 11, color: '#666', textAlign: 'right', lineHeight: '14px' }}>10:42</div>
      </div>
    ),
  },
  {
    name: 'Table Row',
    schema: `schema({
  padding: [10, 16, 11, 16],
  children: [
    row({
      widths: [120, 'flex', 100],
      gap: 8,
      children: [
        text('name', { font: '600 14px Inter', lineHeight: 20 }),
        text('desc', { font: '14px Inter', lineHeight: 20 }),
        fixed(32),
      ],
    }),
  ],
})`,
    data: `{
  "name": "Auth Service",
  "desc": "Handles authentication, authorization, OAuth2 flows, session management, and token refresh for all microservices in the platform."
}`,
    render: (data) => (
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ width: 120, flexShrink: 0, font: '600 14px Inter', lineHeight: '20px' }}>{String(data.name ?? '')}</div>
        <div style={{ flex: 1, minWidth: 0, font: '14px Inter', lineHeight: '20px', color: '#aaa', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{String(data.desc ?? '')}</div>
        <div style={{ width: 100, flexShrink: 0 }}>
          <button style={{ height: 32, padding: '0 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e5e5e5', fontSize: 12 }}>Edit</button>
        </div>
      </div>
    ),
  },
  {
    name: 'Card + Image + Tags',
    schema: `schema({
  padding: [12, 16, 12, 16],
  gap: 8,
  children: [
    conditional('hasImage', aspectRatio(0.5625, { maxHeight: 200 })),
    text('title', { font: '600 16px Inter', lineHeight: 24, maxLines: 2 }),
    text('body', { font: '14px Inter', lineHeight: 20 }),
    flexWrap('tags', { font: '12px Inter', itemHeight: 24, itemPadding: 8, columnGap: 6, rowGap: 4 }),
  ],
})`,
    data: `{
  "hasImage": true,
  "title": "Building a Layout Height Prediction Engine with Pure Arithmetic",
  "body": "Prelayout extends Pretext's two-phase model from text blocks to full component layouts.",
  "tags": ["React", "TypeScript", "Performance", "Virtual List"]
}`,
    render: (data, width) => {
      const contentWidth = width - 16 - 16
      const imageHeight = data.hasImage ? Math.min(contentWidth * 0.5625, 200) : 0
      return (
        <div style={{ padding: '12px 16px' }}>
          {Boolean(data.hasImage) && (
            <div style={{
              width: '100%', height: imageHeight,
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#444', fontSize: 12,
            }}>16:9 image</div>
          )}
          {typeof data.title === 'string' && (
            <div style={{
              marginTop: data.hasImage ? 8 : 0,
              font: '600 16px Inter', lineHeight: '24px',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{data.title}</div>
          )}
          {typeof data.body === 'string' && (
            <div style={{ marginTop: 8, font: '14px Inter', lineHeight: '20px', color: '#aaa', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {data.body}
            </div>
          )}
          {Array.isArray(data.tags) && data.tags.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
              {(data.tags as string[]).map((tag, i) => (
                <span key={i} style={{ height: 24, padding: '0 8px', background: '#1a1a2e', borderRadius: 12, font: '12px Inter', lineHeight: '24px', color: '#8b8bf5' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      )
    },
  },
  {
    name: 'Multilingual',
    schema: `schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: '15px Inter', lineHeight: 22 }),
    fixed(20),
  ],
})`,
    data: `{
  "body": "Prelayout 预测虚拟列表项高度 🚀 テキストレイアウトの予測です。مكتبة رائعة للتنبؤ بارتفاعات العناصر! Mixed scripts work."
}`,
    render: (data) => (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ height: 20, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>多语言 Test</div>
        <div style={{ marginTop: 8, font: '15px Inter', lineHeight: '22px', color: '#aaa', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {String(data.body ?? '')}
        </div>
        <div style={{ marginTop: 8, height: 20, display: 'flex', alignItems: 'center', fontSize: 13, color: '#666' }}>🌍</div>
      </div>
    ),
  },
]

// --- Schema evaluator ---
// NOTE: uses new Function() which executes arbitrary code in the page origin.
// This is acceptable for a developer playground — the user is running their
// own code in their own browser. Do not use this pattern for user-generated
// content from untrusted sources.

function evalSchema(code: string): Schema | null {
  try {
    const fn = new Function(
      'schema', 'fixed', 'text', 'flexWrap', 'aspectRatio', 'row', 'group', 'conditional',
      `return ${code}`,
    )
    return fn(schema, fixed, text, flexWrap, aspectRatio, row, group, conditional)
  } catch {
    return null
  }
}

// --- App ---

function App() {
  const [activePreset, setActivePreset] = useState(0)
  const [schemaCode, setSchemaCode] = useState(presets[0]!.schema)
  const [dataCode, setDataCode] = useState(presets[0]!.data)
  const [width, setWidth] = useState(400)
  const renderRef = useRef<HTMLDivElement>(null)
  const [actualHeight, setActualHeight] = useState(0)

  function loadPreset(index: number) {
    setActivePreset(index)
    setSchemaCode(presets[index]!.schema)
    setDataCode(presets[index]!.data)
  }

  const parsedSchema = useMemo(() => evalSchema(schemaCode), [schemaCode])
  const parsedData = useMemo(() => {
    try { return JSON.parse(dataCode) as Record<string, unknown> }
    catch { return null }
  }, [dataCode])

  const predictedHeight = useMemo(() => {
    if (!parsedSchema || !parsedData) return null
    try {
      const prepared = prepareItem(parsedData, parsedSchema)
      return layoutItem(prepared, width, parsedSchema)
    } catch {
      return null
    }
  }, [parsedSchema, parsedData, width])

  // Measure actual DOM height synchronously after commit
  useLayoutEffect(() => {
    if (renderRef.current) {
      setActualHeight(renderRef.current.getBoundingClientRect().height)
    }
  }, [parsedData, parsedSchema, width, activePreset])

  const diff = predictedHeight !== null && actualHeight > 0 ? predictedHeight - actualHeight : null
  const isExact = diff !== null && Math.abs(diff) < 1

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Playground</h1>
            <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Edit schema or data — predicted vs actual height updates in real time</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {presets.map((p, i) => (
              <button key={i} onClick={() => loadPreset(i)} style={{
                padding: '5px 12px', borderRadius: 4, border: '1px solid #333', fontSize: 12, cursor: 'pointer',
                background: activePreset === i ? '#4ade80' : '#1a1a1a',
                color: activePreset === i ? '#000' : '#e5e5e5',
                fontWeight: activePreset === i ? 700 : 400,
              }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: editors */}
        <div style={{ width: '45%', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <Editor label="Schema" value={schemaCode} onChange={setSchemaCode} height={220} error={!parsedSchema && schemaCode.length > 0} />
          <Editor label="Data (JSON)" value={dataCode} onChange={setDataCode} height={180} error={!parsedData && dataCode.length > 0} />
        </div>

        {/* Right: preview + results */}
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* Width slider */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <label style={{ fontSize: 12, color: '#888' }}>Width:</label>
            <input type="range" min={200} max={600} value={width} onChange={e => setWidth(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontFamily: MONO, color: '#e5e5e5', minWidth: 50 }}>{width}px</span>
          </div>

          {/* Results */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
              <div>
                <span style={{ color: '#888' }}>Predicted: </span>
                <span style={{ fontFamily: MONO, color: predictedHeight !== null ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                  {predictedHeight !== null ? `${predictedHeight.toFixed(1)}px` : 'error'}
                </span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Actual: </span>
                <span style={{ fontFamily: MONO, color: '#38bdf8', fontWeight: 700 }}>{actualHeight.toFixed(1)}px</span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Diff: </span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: diff === null ? '#888' : isExact ? '#4ade80' : '#f87171' }}>
                  {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}px ${isExact ? '✓ exact' : '✗'}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Live preview at {width}px:</div>
            <div style={{ width, background: '#111', border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
              <div ref={renderRef}>
                {parsedData ? presets[activePreset]!.render(parsedData, width) : (
                  <div style={{ padding: 20, color: '#f87171', fontSize: 13 }}>Invalid JSON</div>
                )}
              </div>
            </div>

            {/* Visual comparison bars */}
            {predictedHeight !== null && actualHeight > 0 && (
              <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 60, height: Math.max(4, predictedHeight * 0.4), background: '#4ade8033', border: '1px solid #4ade80', borderRadius: 4, transition: 'height 0.2s' }} />
                  <span style={{ fontSize: 10, color: '#4ade80' }}>predicted</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 60, height: Math.max(4, actualHeight * 0.4), background: '#38bdf833', border: '1px solid #38bdf8', borderRadius: 4, transition: 'height 0.2s' }} />
                  <span style={{ fontSize: 10, color: '#38bdf8' }}>actual</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Editor({ label, value, onChange, height, error }: {
  label: string; value: string; onChange: (v: string) => void; height: number; error?: boolean
}) {
  return (
    <div style={{ borderBottom: '1px solid #222' }}>
      <div style={{ padding: '6px 16px', fontSize: 11, color: error ? '#f87171' : '#888', fontWeight: 600 }}>
        {label} {error && '(parse error)'}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', height, padding: '8px 16px', background: '#0a0a0a',
          border: 'none', borderLeft: error ? '2px solid #f87171' : '2px solid transparent',
          color: '#e5e5e5', fontSize: 13, fontFamily: MONO, lineHeight: 1.5,
          resize: 'vertical', outline: 'none',
        }}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
