import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { schema, fixed, text, group, conditional } from 'prelayout'
import { usePrelayout } from 'prelayout/react'
import { generateComments, type CommentItem } from './data'

const ITEM_COUNT = 10_000
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

const items = generateComments(ITEM_COUNT)

// -- Comment card --

function CommentCard({ item, style }: { item: CommentItem; style: React.CSSProperties }) {
  return (
    <div style={{ ...style, padding: '12px 16px', borderBottom: '1px solid #222' }}>
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

// -- Prelayout list --

function PrelayoutList({ items, width, jumpTarget }: { items: CommentItem[]; width: number; jumpTarget: number | null }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { getItemHeight, totalHeight } = usePrelayout(items as Record<string, unknown>[], commentSchema, width)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getItemHeight,
    overscan: 5,
  })

  useEffect(() => {
    if (jumpTarget !== null) virtualizer.scrollToIndex(jumpTarget, { align: 'start' })
  }, [jumpTarget, virtualizer])

  return (
    <>
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #222', fontSize: 12, color: '#666', flexShrink: 0 }}>
        Total height: <strong style={{ color: '#4ade80' }}>{Math.round(totalHeight).toLocaleString()}px</strong>
        {' '}(predicted before render)
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(row => (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <CommentCard item={items[row.index]!} style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// -- Naive list (no Prelayout) --

function NaiveList({ items, jumpTarget }: { items: CommentItem[]; jumpTarget: number | null }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80, // fixed guess — intentionally wrong for most items
    overscan: 5,
  })

  useEffect(() => {
    if (jumpTarget !== null) virtualizer.scrollToIndex(jumpTarget, { align: 'start' })
  }, [jumpTarget, virtualizer])

  const naiveTotalHeight = items.length * 80

  return (
    <>
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #222', fontSize: 12, color: '#666', flexShrink: 0 }}>
        Total height: <strong style={{ color: '#f87171' }}>{naiveTotalHeight.toLocaleString()}px</strong>
        {' '}(fixed estimate: {items.length} x 80px)
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(row => (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
              }}
            >
              <CommentCard item={items[row.index]!} style={{}} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// -- Width observer --

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// -- App --

export default function App() {
  const leftRef = useRef<HTMLDivElement>(null)
  const leftWidth = useContainerWidth(leftRef)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)

  function jump(index: number) {
    setJumpTarget(null)
    // Force a new state update so both lists react
    requestAnimationFrame(() => setJumpTarget(index))
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #222', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Prelayout Demo</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {ITEM_COUNT.toLocaleString()} comments with variable heights
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => jump(0)} style={btnStyle}>Jump to #0</button>
          <button onClick={() => jump(2500)} style={btnStyle}>Jump to #2500</button>
          <button onClick={() => jump(5000)} style={btnStyle}>Jump to #5000</button>
          <button onClick={() => jump(9999)} style={btnStyle}>Jump to #9999</button>
        </div>
      </div>

      {/* Side-by-side */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: Prelayout */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #222' }}>
          <div style={{ padding: '8px 16px', background: '#0f1f0f', borderBottom: '1px solid #222', fontSize: 13, flexShrink: 0 }}>
            <strong style={{ color: '#4ade80' }}>Prelayout</strong>
            <span style={{ color: '#666', marginLeft: 8 }}>exact heights — no DOM measurement</span>
          </div>
          <div ref={leftRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {leftWidth > 0 && <PrelayoutList items={items} width={leftWidth} jumpTarget={jumpTarget} />}
          </div>
        </div>

        {/* Right: Naive */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', background: '#1f0f0f', borderBottom: '1px solid #222', fontSize: 13, flexShrink: 0 }}>
            <strong style={{ color: '#f87171' }}>Naive</strong>
            <span style={{ color: '#666', marginLeft: 8 }}>fixed 80px estimate + measureElement</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <NaiveList items={items} jumpTarget={jumpTarget} />
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#e5e5e5',
  fontSize: 13,
  cursor: 'pointer',
}
