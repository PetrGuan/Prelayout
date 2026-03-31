// Table demo: virtual table with row() for flex column layout.
//
// Each row has 4 columns: Name (fixed), Description (flex), Tags (fixed), Actions (fixed).
// Row height = tallest cell. The Description column wraps text, so rows have
// variable heights. Prelayout predicts all heights without DOM measurement.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  schema, fixed, text, flexWrap, row,
  prepareItem, layoutItem,
} from 'prelayout'
import { usePrelayout } from 'prelayout/react'

const FONT = '14px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 20
const TAG_FONT = '11px Inter, system-ui, sans-serif'

// Column widths
const COL_NAME = 140
const COL_TAGS = 180
const COL_ACTIONS = 80
const COL_GAP = 1 // border between cells

// Schema: a row with 4 columns
const tableRowSchema = schema({
  padding: [10, 16, 11, 16], // 11 bottom = 10 + 1 border
  children: [
    row({
      widths: [COL_NAME, 'flex', COL_TAGS, COL_ACTIONS],
      gap: COL_GAP,
      children: [
        text('name', { font: `600 ${FONT}`, lineHeight: LINE_HEIGHT }),
        text('description', { font: FONT, lineHeight: LINE_HEIGHT }),
        flexWrap('tags', { font: TAG_FONT, itemHeight: 20, itemPadding: 6, columnGap: 4, rowGap: 4 }),
        fixed(32), // button height
      ],
    }),
  ],
})

// --- Data ---

type TableItem = {
  id: number
  name: string
  description: string
  tags: string[]
  status: string
}

function generateTableData(count: number): TableItem[] {
  const names = [
    'Auth Service', 'Payment API', 'User Dashboard', 'Analytics Engine',
    'Notification Hub', 'Search Index', 'Media Processor', 'Config Manager',
    'Rate Limiter', 'Cache Layer', 'Message Queue', 'Load Balancer',
  ]
  const descriptions = [
    'Handles authentication and authorization.',
    'Processes payments, refunds, and subscription billing. Integrates with Stripe, PayPal, and regional payment providers. Handles webhook callbacks and retry logic for failed transactions.',
    'Main user-facing dashboard with real-time metrics, charts, and alerts. Built with React and WebSocket connections for live data streaming.',
    'Short desc.',
    'Collects, processes, and stores analytics events from all services. Supports custom event schemas, real-time aggregation, and batch exports to data warehouses. Handles ~50k events/sec at peak.',
    'Manages push notifications, email, SMS, and in-app messages across all platforms. Includes template engine, delivery tracking, and user preference management.',
    'Full-text search powered by Elasticsearch. Handles indexing, query parsing, faceted search, autocomplete suggestions, and search result ranking.',
    'Centralized configuration management for all microservices. Supports hot reloading, environment-specific overrides, feature flags, and audit logging of all config changes.',
  ]
  const tagSets = [
    ['Go', 'gRPC'],
    ['TypeScript', 'Node.js', 'PostgreSQL'],
    ['React', 'WebSocket', 'D3'],
    ['Python', 'Kafka', 'ClickHouse', 'Redis'],
    ['Rust'],
    ['Java', 'Spring', 'RabbitMQ'],
    ['TypeScript', 'Elasticsearch', 'Redis', 'Docker'],
    ['Go', 'etcd', 'Consul'],
  ]
  const statuses = ['Active', 'Maintenance', 'Deprecated', 'Beta']

  const items: TableItem[] = []
  for (let i = 0; i < count; i++) {
    items.push({
      id: i,
      name: names[i % names.length]!,
      description: descriptions[i % descriptions.length]!,
      tags: tagSets[i % tagSets.length]!,
      status: statuses[i % statuses.length]!,
    })
  }
  return items
}

// --- Components ---

function TableRow({ item, style }: { item: TableItem; style?: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      display: 'flex', gap: COL_GAP, padding: '10px 16px',
      borderBottom: '1px solid #222',
    }}>
      <div style={{ width: COL_NAME, flexShrink: 0 }}>
        <div style={{ font: `600 ${FONT}`, lineHeight: `${LINE_HEIGHT}px` }}>{item.name}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: FONT, lineHeight: `${LINE_HEIGHT}px`, color: '#aaa' }}>{item.description}</div>
      </div>
      <div style={{ width: COL_TAGS, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {item.tags.map(tag => (
            <span key={tag} style={{
              height: 20, padding: '0 6px', background: '#1a1a2e', borderRadius: 10,
              font: TAG_FONT, lineHeight: '20px', color: '#8b8bf5',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div style={{ width: COL_ACTIONS, flexShrink: 0, display: 'flex', alignItems: 'flex-start' }}>
        <button style={{
          height: 32, padding: '0 12px', background: '#1a1a1a', border: '1px solid #333',
          borderRadius: 6, color: '#e5e5e5', fontSize: 12, cursor: 'pointer',
        }}>
          Edit
        </button>
      </div>
    </div>
  )
}

// --- App ---

const ITEM_COUNT = 5000

function App() {
  const items = useRef(generateTableData(ITEM_COUNT)).current
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const { getItemHeight, totalHeight } = usePrelayout(
    items as unknown as Record<string, unknown>[],
    tableRowSchema,
    containerWidth,
  )

  const heightsRef = useRef(getItemHeight)
  heightsRef.current = getItemHeight

  const estimateSize = useCallback((i: number) => heightsRef.current(i), [])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 10,
  })

  useEffect(() => {
    virtualizer.measure()
  }, [containerWidth, virtualizer])

  return (
    <div ref={containerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Table Demo</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
          {ITEM_COUNT.toLocaleString()} rows with variable-height descriptions — row height = tallest cell.
          Total height: {Math.round(totalHeight).toLocaleString()}px (predicted).
        </p>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', gap: COL_GAP, padding: '8px 16px',
        borderBottom: '1px solid #333', fontSize: 12, fontWeight: 600, color: '#888',
        flexShrink: 0,
      }}>
        <div style={{ width: COL_NAME }}>Service</div>
        <div style={{ flex: 1 }}>Description</div>
        <div style={{ width: COL_TAGS }}>Stack</div>
        <div style={{ width: COL_ACTIONS }}>Actions</div>
      </div>

      {/* Virtual table body */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vRow => (
            <div
              key={vRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: vRow.size,
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <TableRow item={items[vRow.index]!} style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
