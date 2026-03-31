// Stress test: adversarial text data that breaks naive layout prediction.
//
// Categories tested:
//   - CJK (Chinese, Japanese, Korean) — breaks at every character
//   - Arabic/RTL — right-to-left, different shaping
//   - Thai — no spaces between words
//   - Emoji — ZWJ sequences, flags, keycaps, width discrepancies
//   - Mixed scripts — CJK + Latin + emoji in one paragraph
//   - Super long words — overflow-wrap: break-word behavior
//   - URLs — complex break opportunities
//   - Whitespace edge cases — tabs, multiple spaces, empty strings
//   - Punctuation — quotes, brackets, ellipsis

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { schema, fixed, text, prepareItem, layoutItem } from 'prelayout'

const FONT = '15px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 22

const cardSchema = schema({
  padding: [12, 16, 13, 16],
  gap: 8,
  children: [
    fixed(20),
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    fixed(20),
  ],
})

type TestCase = {
  label: string
  category: string
  body: string
}

const testCases: TestCase[] = [
  // --- CJK ---
  { label: 'Chinese paragraph', category: 'CJK',
    body: '虚拟列表需要在渲染之前知道每个项目的高度。今天你要么假设固定高度（不准确），要么先渲染再测量（导致闪烁），要么使用ResizeObserver（导致跳动）。Prelayout通过纯算术解决了这个问题。' },
  { label: 'Japanese mixed', category: 'CJK',
    body: 'テキストレイアウトの予測は、ブラウザのDOM測定に依存せずに、純粋な算術で行高さを計算します。これにより、リサイズ時のパフォーマンスが100倍向上します。' },
  { label: 'Korean paragraph', category: 'CJK',
    body: '가상 목록은 렌더링하기 전에 각 항목의 높이를 알아야 합니다. 오늘날에는 고정 높이를 가정하거나(부정확), 먼저 렌더링한 후 측정하거나(깜빡임 유발), ResizeObserver를 사용합니다(점프 유발).' },
  { label: 'CJK punctuation kinsoku', category: 'CJK',
    body: '「これは禁則処理のテストです。」句読点が行頭に来ないように、正しく処理されるべきです。（括弧もテスト）、全角カンマ、ピリオド。もう一つ：「テスト」です。' },

  // --- Arabic / RTL ---
  { label: 'Arabic paragraph', category: 'Arabic',
    body: 'تحتاج القوائم الافتراضية إلى معرفة ارتفاع كل عنصر قبل العرض. اليوم، إما أن تفترض ارتفاعات ثابتة (غير دقيقة)، أو تعرض أولاً ثم تقيس (يسبب وميضًا)، أو تستخدم مراقب التغييرات (يسبب القفز).' },
  { label: 'Arabic + Latin mix', category: 'Arabic',
    body: 'مكتبة Prelayout تعتمد على Pretext لقياس النصوص عبر canvas.measureText() وتحقق دقة 100% في التنبؤ بارتفاعات العناصر. الأداء أسرع بـ 100x من DOM measurement.' },
  { label: 'Urdu script', category: 'Arabic',
    body: 'ورچوئل لسٹ کو رینڈر کرنے سے پہلے ہر آئٹم کی اونچائی جاننے کی ضرورت ہوتی ہے۔ آج آپ یا تو فکسڈ اونچائی فرض کرتے ہیں یا پہلے رینڈر کریں پھر ناپیں۔' },

  // --- Thai ---
  { label: 'Thai paragraph', category: 'Thai',
    body: 'รายการเสมือนจริงต้องการทราบความสูงของแต่ละรายการก่อนการแสดงผล ในปัจจุบันคุณอาจสันนิษฐานความสูงคงที่หรือแสดงผลก่อนแล้ววัดซึ่งทำให้เกิดการกะพริบ' },

  // --- Emoji ---
  { label: 'Emoji basic', category: 'Emoji',
    body: '🎉🚀🔥💯 Great launch! 🎊🎈🎁🎆🎇✨🌟💫⭐🌠 Celebrating with everyone! 🥳🎂🍰🎶🎵🎤🎧' },
  { label: 'Emoji ZWJ sequences', category: 'Emoji',
    body: '👨‍👩‍👧‍👦 Family: 👩‍💻 Woman technologist, 👨‍🍳 Man cook, 🏳️‍🌈 Rainbow flag, 👩‍❤️‍👨 Couple, 🧑‍🤝‍🧑 People holding hands' },
  { label: 'Emoji flags', category: 'Emoji',
    body: '🇺🇸🇬🇧🇫🇷🇩🇪🇯🇵🇨🇳🇰🇷🇧🇷🇮🇳🇷🇺🇦🇺🇨🇦🇪🇸🇮🇹🇲🇽🇸🇬🇹🇼🇭🇰🇦🇪 All the flags in a row!' },
  { label: 'Emoji + CJK + Latin', category: 'Emoji',
    body: '今天发布了 Prelayout 🚀 效果超好！Performance is 100x faster 💯 ブラウザのDOM測定なしで高さを予測 🎉 정말 대단해요!' },

  // --- Mixed scripts ---
  { label: 'Latin + CJK alternating', category: 'Mixed',
    body: 'The word 布局 means layout, and 预测 means prediction. Together, 布局预测 is what Prelayout does — predicting 高度 (height) without DOM 测量 (measurement).' },
  { label: 'Code in text', category: 'Mixed',
    body: 'Call `prepareItem(data, schema)` once, then `layoutItem(prepared, width, schema)` on every resize. The prepared handle is width-independent — reuse it at any maxWidth.' },
  { label: 'Hindi + English', category: 'Mixed',
    body: 'Prelayout एक ऐसी लाइब्रेरी है जो वर्चुअल स्क्रॉल लिस्ट के लिए component-level height prediction करती है। यह Pretext पर बनी है और pure arithmetic से काम करती है।' },

  // --- Long words ---
  { label: 'German compound word', category: 'Long words',
    body: 'Donaudampfschifffahrtsgesellschaftskapitänsmützenknopflochverzierung is a very long German compound word that tests overflow-wrap: break-word behavior in narrow containers.' },
  { label: 'URL with query', category: 'Long words',
    body: 'Check this: https://example.com/very/long/path/to/resource?param=value&another=thing&query=string&foo=bar&baz=qux#section-heading-with-anchor' },
  { label: 'Continuous Latin', category: 'Long words',
    body: 'Supercalifragilisticexpialidocious Pneumonoultramicroscopicsilicovolcanoconiosis Hippopotomonstrosesquippedaliophobia Antidisestablishmentarianism Floccinaucinihilipilification' },

  // --- Punctuation edge cases ---
  { label: 'Nested quotes', category: 'Punctuation',
    body: '"She said, \'He told me, "It\'s complicated," and then left.\' I didn\'t know what to think." — A very confused narrator who uses many nested quotes.' },
  { label: 'Ellipsis and dashes', category: 'Punctuation',
    body: 'Wait for it… — yes, really — the result is amazing! But then again… maybe not? Let\'s see: option A vs. option B vs. option C — the choice is yours…' },
  { label: 'Brackets and parens', category: 'Punctuation',
    body: 'The function signature is: `layout(prepared: PreparedText, maxWidth: number, lineHeight: number): { lineCount: number; height: number }` — note the destructured return type (important!).' },

  // --- Whitespace ---
  { label: 'Empty string', category: 'Whitespace',
    body: '' },
  { label: 'Single character', category: 'Whitespace',
    body: 'X' },
  { label: 'Only spaces', category: 'Whitespace',
    body: '                    ' },
  { label: 'Soft hyphens', category: 'Whitespace',
    body: 'Pflan\u00ADzen\u00ADschutz\u00ADmit\u00ADtel\u00ADzu\u00ADlas\u00ADsungs\u00ADver\u00ADord\u00ADnung is a German word with soft hyphens (U+00AD) that should break at hyphenation points.' },
  { label: 'NBSP glue', category: 'Whitespace',
    body: `100\u00A0km/h speed limit on the\u00A0A1 motorway.\u00A0Non-breaking spaces should prevent wrapping at those points, unlike regular spaces between other words in this sentence.` },

  // --- Numbers and special ---
  { label: 'Math and numbers', category: 'Special',
    body: '∑(n=1→∞) 1/n² = π²/6 ≈ 1.6449. Also: √2 ≈ 1.4142, e ≈ 2.7183, φ = (1+√5)/2 ≈ 1.6180. Temperature: -40°C = -40°F.' },
  { label: 'Currency symbols', category: 'Special',
    body: 'Prices: $99.99, €89.50, £79.99, ¥10,000, ₹7,500, ₩120,000, ₿0.0042. Total: $99.99 + €89.50 = complicated.' },
]

// --- Rendering ---

type ResultRow = {
  test: TestCase
  predicted: number
  actual: number
  diff: number
}

function TestCard({ test }: { test: TestCase }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', height: 20, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{test.label}</span>
        <span style={{ color: '#666', fontSize: 12 }}>{test.category}</span>
      </div>
      <div style={{ marginTop: 8, font: FONT, lineHeight: `${LINE_HEIGHT}px`, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {test.body}
      </div>
      <div style={{ marginTop: 8, height: 20 }} />
    </div>
  )
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<ResultRow[] | null>(null)
  const [running, setRunning] = useState(false)
  const [width, setWidth] = useState(480)

  const runTest = useCallback(() => {
    if (!containerRef.current) return
    setRunning(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = containerRef.current!
        const cards = container.querySelectorAll<HTMLElement>('[data-stresscard]')
        const rows: ResultRow[] = []

        for (let i = 0; i < testCases.length; i++) {
          const test = testCases[i]!
          const card = cards[i]
          if (!card) continue

          const actual = card.getBoundingClientRect().height
          const prepared = prepareItem(
            { body: test.body } as Record<string, unknown>,
            cardSchema,
          )
          const predicted = layoutItem(prepared, width, cardSchema)
          const diff = predicted - actual
          rows.push({ test, predicted, actual, diff })
        }

        setResults(rows)
        setRunning(false)
      })
    })
  }, [width])

  useEffect(() => {
    // Wait for fonts to load before measuring
    document.fonts.ready.then(() => {
      requestAnimationFrame(runTest)
    })
  }, [runTest])

  const exactCount = results?.filter(r => Math.abs(r.diff) < 1).length ?? 0
  const closeCount = results?.filter(r => Math.abs(r.diff) >= 1 && Math.abs(r.diff) < 3).length ?? 0
  const failCount = results?.filter(r => Math.abs(r.diff) >= 3).length ?? 0
  const totalCount = results?.length ?? 0
  const maxDiff = results?.reduce((max, r) => Math.max(max, Math.abs(r.diff)), 0) ?? 0
  const avgDiff = totalCount > 0 ? results!.reduce((s, r) => s + Math.abs(r.diff), 0) / totalCount : 0

  // Group by category
  const categories = [...new Set(testCases.map(t => t.category))]

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Stress Test</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        {testCases.length} adversarial test cases — CJK, Arabic, Thai, emoji, long words, punctuation, whitespace
      </p>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#888' }}>
          Width:
          <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))}
            style={{ marginLeft: 8, width: 80, padding: '4px 8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#e5e5e5', fontSize: 13 }}
          /> px
        </label>
        <button onClick={runTest} disabled={running}
          style={{ padding: '6px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e5e5e5', fontSize: 13, cursor: 'pointer' }}>
          {running ? 'Running...' : 'Re-run'}
        </button>
      </div>

      {/* Summary */}
      {results && (
        <div style={{ marginTop: 20, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <Stat label="Exact (<1px)" value={`${exactCount}/${totalCount}`} color={exactCount === totalCount ? '#4ade80' : '#facc15'} />
          <Stat label="Close (1-3px)" value={`${closeCount}`} color="#facc15" />
          <Stat label="Fail (>3px)" value={`${failCount}`} color={failCount > 0 ? '#f87171' : '#4ade80'} />
          <Stat label="Avg error" value={`${avgDiff.toFixed(2)}px`} color="#38bdf8" />
          <Stat label="Max error" value={`${maxDiff.toFixed(1)}px`} color={maxDiff > 3 ? '#f87171' : '#38bdf8'} />
        </div>
      )}

      {/* Results by category */}
      {results && categories.map(cat => {
        const catResults = results.filter(r => r.test.category === cat)
        return (
          <div key={cat} style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>{cat}</h2>
            <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', color: '#666' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Test</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Predicted</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Actual</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Diff</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {catResults.map(r => {
                  const abs = Math.abs(r.diff)
                  const status = abs < 1 ? '✓ exact' : abs < 3 ? '~ close' : '✗ miss'
                  const color = abs < 1 ? '#4ade80' : abs < 3 ? '#facc15' : '#f87171'
                  return (
                    <tr key={r.test.label} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '6px 8px' }}>{r.test.label}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.predicted.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.actual.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color }}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
                      </td>
                      <td style={{ padding: '6px 8px', color }}>{status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Hidden render container */}
      <div ref={containerRef} style={{ position: 'absolute', left: -9999, top: 0, width, visibility: 'hidden' }}>
        {testCases.map((test, i) => (
          <div key={i} data-stresscard>
            <TestCard test={test} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
