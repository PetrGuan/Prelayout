// Truncated tags demo: show items that fit, +N chip for overflow, tooltip for the rest.
//
// The naive approach: render all tags → measure → remove overflowing ones → re-render.
// With Prelayout: measure tag widths via canvas → compute which fit → render once.
//
// This demo shows both approaches side-by-side.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useMemo, useCallback } from 'react'

const TAG_FONT = '13px Inter, system-ui, sans-serif'
const TAG_HEIGHT = 28
const TAG_H_PADDING = 10 // padding-left + padding-right per tag
const TAG_GAP = 6
const CHIP_WIDTH = 40 // approximate width of "+N" chip

// --- Canvas measurement (the Prelayout approach) ---

let measureCtx: CanvasRenderingContext2D | null = null
function getCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = (typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1).getContext('2d')
      : document.createElement('canvas').getContext('2d')) as CanvasRenderingContext2D
  }
  return measureCtx
}

function measureTagWidths(tags: string[], font: string, hPadding: number): number[] {
  const ctx = getCtx()
  ctx.font = font
  return tags.map(tag => ctx.measureText(tag).width + hPadding)
}

function computeVisibleTags(
  tagWidths: number[],
  containerWidth: number,
  gap: number,
  chipWidth: number,
): { visibleCount: number; overflowCount: number } {
  if (tagWidths.length === 0) return { visibleCount: 0, overflowCount: 0 }

  // First check: do all tags fit?
  let totalWidth = 0
  for (let i = 0; i < tagWidths.length; i++) {
    if (i > 0) totalWidth += gap
    totalWidth += tagWidths[i]!
  }
  if (totalWidth <= containerWidth) {
    return { visibleCount: tagWidths.length, overflowCount: 0 }
  }

  // Not all fit — find how many fit with room for the "+N" chip
  let usedWidth = 0
  let visibleCount = 0
  for (let i = 0; i < tagWidths.length; i++) {
    const tagW = tagWidths[i]!
    const gapW = visibleCount > 0 ? gap : 0
    const remainingForChip = gap + chipWidth // space needed for "+N"
    if (usedWidth + gapW + tagW + remainingForChip <= containerWidth) {
      usedWidth += gapW + tagW
      visibleCount++
    } else {
      break
    }
  }

  // Edge case: if nothing fits, show at least the chip
  if (visibleCount === 0) {
    return { visibleCount: 0, overflowCount: tagWidths.length }
  }

  return { visibleCount, overflowCount: tagWidths.length - visibleCount }
}

// --- Data ---

type ListItem = {
  id: number
  name: string
  tags: string[]
}

const items: ListItem[] = [
  { id: 0, name: 'Frontend Project', tags: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Framer Motion', 'Storybook'] },
  { id: 1, name: 'API Service', tags: ['Go', 'gRPC', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Prometheus', 'Grafana'] },
  { id: 2, name: 'Mobile App', tags: ['React Native', 'Expo'] },
  { id: 3, name: 'Data Pipeline', tags: ['Python', 'Apache Kafka', 'Apache Spark', 'ClickHouse', 'Airflow', 'dbt', 'Terraform'] },
  { id: 4, name: 'Design System', tags: ['Figma', 'CSS', 'Accessibility', 'WCAG 2.1', 'Design Tokens', 'Chromatic'] },
  { id: 5, name: 'ML Platform', tags: ['Python', 'PyTorch', 'CUDA', 'TensorRT', 'MLflow', 'Ray', 'ONNX', 'Triton', 'Weights & Biases'] },
  { id: 6, name: 'Auth Service', tags: ['Rust', 'JWT'] },
  { id: 7, name: 'Search Engine', tags: ['Java', 'Elasticsearch', 'Apache Lucene', 'Kubernetes', 'Redis', 'Protocol Buffers'] },
  { id: 8, name: 'Analytics', tags: ['TypeScript', 'ClickHouse', 'Apache Kafka', 'Grafana', 'Cube.js', 'BigQuery'] },
  { id: 9, name: 'Infra', tags: ['Terraform', 'AWS CDK', 'Pulumi', 'GitHub Actions', 'ArgoCD', 'Vault', 'Consul', 'Nomad', 'Packer'] },
  { id: 10, name: 'Docs Site', tags: ['Markdown', 'Docusaurus', 'MDX'] },
  { id: 11, name: '多语言项目', tags: ['中文标签', 'TypeScript', '日本語', 'العربية', 'Español', '한국어', 'Emoji 🚀', 'Prelayout'] },
]

// --- Components ---

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: TAG_HEIGHT,
      padding: `0 ${TAG_H_PADDING / 2}px`, background: '#1a1a2e', borderRadius: 14,
      font: TAG_FONT, color: '#8b8bf5', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function OverflowChip({ count, tags }: { count: number; tags: string[] }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} ref={chipRef}>
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          height: TAG_HEIGHT, padding: '0 8px', background: '#222', borderRadius: 14,
          font: TAG_FONT, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        +{count}
      </span>
      {showTooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
          padding: '8px 12px', background: '#1a1a1a', border: '1px solid #333',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10,
          display: 'flex', flexWrap: 'wrap', gap: TAG_GAP, minWidth: 200, maxWidth: 350,
        }}>
          {tags.map(tag => <Tag key={tag} label={tag} />)}
        </div>
      )}
    </div>
  )
}

// Smart row: uses canvas measurement to decide what fits
function SmartTagRow({ tags, width }: { tags: string[]; width: number }) {
  const tagWidths = useMemo(() => measureTagWidths(tags, TAG_FONT, TAG_H_PADDING), [tags])
  const { visibleCount, overflowCount } = useMemo(
    () => computeVisibleTags(tagWidths, width, TAG_GAP, CHIP_WIDTH),
    [tagWidths, width],
  )

  const visible = tags.slice(0, visibleCount)
  const overflow = tags.slice(visibleCount)

  return (
    <div style={{ display: 'flex', gap: TAG_GAP, alignItems: 'center', width, overflow: 'hidden' }}>
      {visible.map(tag => <Tag key={tag} label={tag} />)}
      {overflowCount > 0 && <OverflowChip count={overflowCount} tags={overflow} />}
    </div>
  )
}

// Naive row: renders all, uses DOM measurement to find overflow
function NaiveTagRow({ tags, width }: { tags: string[]; width: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(tags.length)
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    setVisibleCount(tags.length)
    setMeasured(false)
  }, [tags, width])

  useEffect(() => {
    if (measured || !containerRef.current) return
    const children = containerRef.current.children
    let count = 0
    let usedWidth = 0
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      const childWidth = child.getBoundingClientRect().width
      const gap = count > 0 ? TAG_GAP : 0
      if (usedWidth + gap + childWidth + TAG_GAP + CHIP_WIDTH <= width || i === children.length - 1 && usedWidth + gap + childWidth <= width) {
        usedWidth += gap + childWidth
        count++
      } else {
        break
      }
    }
    setVisibleCount(count)
    setMeasured(true)
  }, [tags, width, measured])

  const overflow = tags.slice(visibleCount)

  return (
    <div style={{ display: 'flex', gap: TAG_GAP, alignItems: 'center', width, overflow: 'hidden' }}>
      {/* Hidden full render for measurement */}
      {!measured && (
        <div ref={containerRef} style={{ display: 'flex', gap: TAG_GAP, position: 'absolute', visibility: 'hidden' }}>
          {tags.map(tag => <Tag key={tag} label={tag} />)}
        </div>
      )}
      {/* Visible result */}
      {(measured ? tags.slice(0, visibleCount) : []).map(tag => <Tag key={tag} label={tag} />)}
      {measured && overflow.length > 0 && <OverflowChip count={overflow.length} tags={overflow} />}
    </div>
  )
}

// --- App ---

function App() {
  const [width, setWidth] = useState(500)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Truncated Tags Demo</h1>
      <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
        Show tags that fit, "+N" chip for overflow, tooltip for the rest.
        <br />
        <strong>Left:</strong> Prelayout approach (canvas measurement → render once).
        <strong> Right:</strong> Naive approach (render all → measure → re-render).
      </p>

      {/* Width slider */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, color: '#888' }}>Container width:</label>
        <input type="range" min={200} max={800} value={width} onChange={e => setWidth(Number(e.target.value))} style={{ flex: 1, maxWidth: 300 }} />
        <span style={{ fontSize: 14, fontFamily: 'monospace' }}>{width}px</span>
      </div>

      {/* Side by side */}
      <div style={{ marginTop: 24, display: 'flex', gap: 24 }}>
        {/* Smart */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 12 }}>
            Prelayout (canvas pre-measurement)
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>
            Measures tag widths via canvas → computes which fit → renders once. Zero DOM measurement.
          </div>
          {items.map(item => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
              <SmartTagRow tags={item.tags} width={width} />
            </div>
          ))}
        </div>

        {/* Naive */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 12 }}>
            Naive (render → measure → re-render)
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>
            Renders all tags hidden → measures each → removes overflow → re-renders. Two render passes.
          </div>
          {items.map(item => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
              <NaiveTagRow tags={item.tags} width={width} />
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div style={{ marginTop: 32, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222', fontSize: 13, color: '#888' }}>
        <p><strong>Why this matters:</strong> The naive approach needs two render passes — one hidden render to measure, then a visible render with the correct tags. This causes a flash of all tags before they're truncated (or an empty frame while measuring). The Prelayout approach uses <code>canvas.measureText()</code> to know each tag's width before rendering, so it renders the correct result on the first frame.</p>
        <p style={{ marginTop: 8 }}>Drag the width slider to see both approaches respond. The Prelayout side updates instantly. The naive side re-measures on every width change.</p>
        <p style={{ marginTop: 8 }}>Hover over any "+N" chip to see the overflow tags in a tooltip.</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
