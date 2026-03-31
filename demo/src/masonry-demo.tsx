// Masonry layout demo: assign cards to columns using predicted heights.
//
// Traditional masonry (Pinterest-style) requires knowing each card's height
// to assign it to the shortest column. Without Prelayout, you'd either:
//   1. Render all cards hidden, measure them, then position (slow, flicker)
//   2. Use fixed heights (boring, wastes space)
//
// With Prelayout: predict every card's height with pure arithmetic, then
// assign to columns instantly. Zero DOM measurement, zero render passes.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useMemo } from 'react'
import {
  schema, fixed, text, flexWrap, aspectRatio, conditional,
  prepareItem, layoutItem,
} from 'prelayout'
import type { PreparedItem } from 'prelayout'

const FONT = '14px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 20
const TAG_FONT = '11px Inter, system-ui, sans-serif'

const cardSchema = schema({
  padding: [12, 14, 12, 14],
  gap: 8,
  children: [
    conditional('hasImage', aspectRatio(0, { field: 'imageRatio', maxHeight: 250 })),
    text('title', { font: 'bold 15px Inter, system-ui, sans-serif', lineHeight: 22, maxLines: 2 }),
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    flexWrap('tags', { font: TAG_FONT, itemHeight: 22, itemPadding: 6, columnGap: 4, rowGap: 4 }),
    fixed(16), // author line
  ],
})

type CardItem = {
  id: number
  title: string
  body: string
  tags: string[]
  hasImage: boolean
  imageRatio: number
  color: string
  author: string
}

function generateCards(count: number): CardItem[] {
  const titles = [
    'Getting Started with Virtual Lists',
    'Why Layout Prediction Matters for Modern Web Apps',
    'Quick Tip',
    'Deep Dive: Canvas measureText vs DOM Rendering — The Sub-Pixel Gap',
    'New Release!',
    'Building a Masonry Layout Without DOM Measurement',
    'Performance Tip: Avoid Layout Thrashing',
    'Understanding CSS White-Space and Line Breaking Rules Across Scripts',
  ]
  const bodies = [
    'A short intro.',
    'Virtual lists need item heights before rendering. Today you either assume fixed heights or measure after render.',
    'This is a longer card body that demonstrates how Prelayout handles multi-line text wrapping in a masonry context. The height is predicted without any DOM measurement.',
    'Prelayout extends Pretext\'s two-phase model from text blocks to component layouts. It predicts entire card heights via pure arithmetic.',
    'The key insight: canvas.measureText() uses the same font engine as the DOM. Measure once, replay line-breaking with math.',
    'CJK text breaks at every character. Arabic is RTL. Thai has no spaces. Emoji widths differ between canvas and DOM. Prelayout handles all of it.',
  ]
  const tagSets = [
    ['React'], ['Performance', 'Virtual'], ['CSS', 'Layout', 'Design'],
    ['TypeScript', 'DX'], [], ['Pretext', 'Canvas', 'Unicode'],
    ['Tutorial', 'Beginner'], ['Advanced', 'Deep Dive', 'Architecture'],
  ]
  const colors = ['#1a1a2e', '#162447', '#1b1b2f', '#0f3460', '#1a1a1a', '#1e1e3f', '#2d2d44', '#1f1f1f']

  const cards: CardItem[] = []
  for (let i = 0; i < count; i++) {
    const hasImage = i % 3 === 0
    cards.push({
      id: i,
      title: titles[i % titles.length]!,
      body: bodies[i % bodies.length]!,
      tags: tagSets[i % tagSets.length]!,
      hasImage,
      imageRatio: hasImage ? [0.6, 0.75, 1, 0.5][i % 4]! : 0,
      color: colors[i % colors.length]!,
      author: ['Alice', 'Bob', 'Carlos', 'Diana', 'Émile'][i % 5]!,
    })
  }
  return cards
}

function MasonryCard({ card }: { card: CardItem }) {
  return (
    <div style={{
      padding: '12px 14px', background: '#111', borderRadius: 10,
      border: '1px solid #222', overflow: 'hidden',
    }}>
      {card.hasImage && (
        <div style={{
          width: '100%', aspectRatio: `1 / ${card.imageRatio}`, maxHeight: 250,
          background: `linear-gradient(135deg, ${card.color}, ${card.color}88)`,
          borderRadius: 6, marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#444', fontSize: 11,
        }}>
          {Math.round(1 / card.imageRatio * 100)}:{100}
        </div>
      )}
      <div style={{
        font: 'bold 15px Inter, system-ui, sans-serif', lineHeight: '22px',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {card.title}
      </div>
      <div style={{ marginTop: 8, font: FONT, lineHeight: `${LINE_HEIGHT}px`, color: '#aaa' }}>
        {card.body}
      </div>
      {card.tags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {card.tags.map(tag => (
            <span key={tag} style={{
              height: 22, padding: '0 6px', background: '#1a1a2e', borderRadius: 11,
              font: TAG_FONT, lineHeight: '22px', color: '#8b8bf5',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: '#555', height: 16, lineHeight: '16px' }}>
        by {card.author}
      </div>
    </div>
  )
}

const COLUMN_GAP = 12
const CARD_COUNT = 40

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [columnCount, setColumnCount] = useState(3)
  const cards = useRef(generateCards(CARD_COUNT)).current

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const columnWidth = containerWidth > 0
    ? (containerWidth - (columnCount - 1) * COLUMN_GAP) / columnCount
    : 0

  // Predict all card heights
  const prepared = useMemo(() =>
    cards.map(card => prepareItem(card as unknown as Record<string, unknown>, cardSchema)),
    [cards],
  )
  const cardHeights = useMemo(() =>
    prepared.map(p => layoutItem(p, columnWidth, cardSchema)),
    [prepared, columnWidth],
  )

  // Assign cards to shortest column (greedy)
  const columns = useMemo(() => {
    const cols: { cards: { card: CardItem; height: number; y: number }[] ; totalHeight: number }[] =
      Array.from({ length: columnCount }, () => ({ cards: [], totalHeight: 0 }))

    for (let i = 0; i < cards.length; i++) {
      // Find shortest column
      let minCol = 0
      for (let c = 1; c < columnCount; c++) {
        if (cols[c]!.totalHeight < cols[minCol]!.totalHeight) minCol = c
      }
      const col = cols[minCol]!
      const y = col.totalHeight > 0 ? col.totalHeight + COLUMN_GAP : 0
      col.cards.push({ card: cards[i]!, height: cardHeights[i]!, y })
      col.totalHeight = y + cardHeights[i]!
    }
    return cols
  }, [cards, cardHeights, columnCount])

  const maxHeight = Math.max(...columns.map(c => c.totalHeight), 0)

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Masonry Layout</h1>
        <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
          {CARD_COUNT} cards assigned to columns using predicted heights — zero DOM measurement.
        </p>

        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#888' }}>
            Columns:
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => setColumnCount(n)}
                style={{
                  marginLeft: 8, padding: '4px 12px', borderRadius: 4, border: '1px solid #333',
                  background: columnCount === n ? '#4ade80' : '#1a1a1a',
                  color: columnCount === n ? '#000' : '#e5e5e5',
                  fontSize: 13, cursor: 'pointer', fontWeight: columnCount === n ? 700 : 400,
                }}>
                {n}
              </button>
            ))}
          </label>
          <span style={{ fontSize: 12, color: '#555' }}>
            Column width: {Math.round(columnWidth)}px
          </span>
        </div>

        {/* Masonry grid */}
        <div ref={containerRef} style={{ marginTop: 20, position: 'relative', height: maxHeight }}>
          {columns.map((col, colIndex) => (
            <div key={colIndex} style={{
              position: 'absolute',
              top: 0,
              left: colIndex * (columnWidth + COLUMN_GAP),
              width: columnWidth,
            }}>
              {col.cards.map(({ card, y }) => (
                <div key={card.id} style={{ position: 'absolute', top: y, width: '100%' }}>
                  <MasonryCard card={card} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
