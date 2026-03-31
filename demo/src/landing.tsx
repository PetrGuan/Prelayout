import { createRoot } from 'react-dom/client'

const demos = [
  { name: 'Feature Showcase', href: './showcase.html', desc: 'All schema primitives in one page with DevTools overlay' },
  { name: 'Side-by-Side Comparison', href: './comparison.html', desc: '10,000 items — Prelayout vs naive fixed-height estimate' },
  { name: 'Auto-Calibration', href: './auto-calibrate.html', desc: 'Wrong schema → auto-corrected by observing 10 rendered items' },
  { name: 'CSS/Tailwind Extraction', href: './extract.html', desc: 'Type Tailwind classes → schema constants in real time' },
  { name: 'Accuracy Test', href: './accuracy.html', desc: '500 items — predicted vs actual DOM height comparison' },
  { name: 'Stress Test', href: './stress.html', desc: '28 adversarial cases — CJK, Arabic, emoji, long words' },
  { name: 'Performance Benchmark', href: './benchmark.html', desc: 'prepare() + layout() vs DOM measurement timing' },
]

function App() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#e5e5e5' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>Prelayout</h1>
      <p style={{ fontSize: 16, color: '#888', marginTop: 8 }}>
        Component-level height prediction for virtual scroll lists.
        <br />
        Built on <a href="https://github.com/chenglou/pretext" style={{ color: '#8b8bf5' }}>Pretext</a>.
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <a href="https://github.com/PetrGuan/Prelayout" style={badgeStyle}>GitHub</a>
        <a href="https://www.npmjs.com/package/prelayout" style={badgeStyle}>npm</a>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 40 }}>Demos</h2>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {demos.map(d => (
          <a key={d.name} href={d.href} style={{
            display: 'block', padding: '16px 20px', background: '#111',
            border: '1px solid #222', borderRadius: 8, textDecoration: 'none',
            color: '#e5e5e5', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#444')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{d.desc}</div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 40, fontSize: 13, color: '#555' }}>
        <code>npm install prelayout @chenglou/pretext</code>
      </div>
    </div>
  )
}

const badgeStyle: React.CSSProperties = {
  padding: '6px 14px', background: '#1a1a1a', border: '1px solid #333',
  borderRadius: 6, color: '#e5e5e5', fontSize: 13, textDecoration: 'none',
}

createRoot(document.getElementById('root')!).render(<App />)
