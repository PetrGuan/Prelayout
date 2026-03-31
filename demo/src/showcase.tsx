// Feature showcase: every schema primitive in one page, with DevTools overlay.
//
// Shows a list of rich cards using all schema features:
//   fixed, text (with maxLines + minHeight), flexWrap, aspectRatio,
//   group, conditional
//
// The DevTools overlay visually marks any predicted vs actual height mismatch.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  schema, fixed, text, flexWrap, aspectRatio, group, conditional,
  prepareItem, layoutItem,
} from 'prelayout'
import { createDevOverlay } from 'prelayout/devtools'

// --- Data ---

type PostItem = {
  id: number
  author: string
  time: string
  body: string
  hasQuote: boolean
  quoteText: string | null
  tags: string[]
  hasImage: boolean
  imageRatio: number
  likes: number
}

function generatePosts(count: number): PostItem[] {
  const authors = ['Alice', 'Bob', 'Carlos', 'Diana', 'Émile', 'Fatima', 'Haruki', 'Isha']
  const bodies = [
    'Just shipped a new feature!',
    'This is a much longer post that demonstrates how text wrapping works when the content spans multiple lines in the layout.',
    'Short.',
    'Working on a really interesting project that combines text layout prediction with virtual scrolling. The key insight is that you can separate measurement from layout — measure once with canvas, then replay the line-breaking with pure arithmetic on every resize. This eliminates DOM reflow entirely from the resize hot path.',
    'Check out this photo!',
    '🚀🎉 Big launch day!',
    'Thread: 1/ Here is a detailed explanation of how the algorithm works. First, we segment the text using Intl.Segmenter, which handles CJK, Thai, Arabic, and all other Unicode scripts correctly.',
  ]
  const tagSets = [
    ['React', 'TypeScript'],
    ['Rust', 'WebAssembly', 'Performance'],
    ['Design', 'CSS', 'Animation', 'Accessibility'],
    [],
    ['JavaScript'],
    ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'],
    ['Swift', 'iOS', 'SwiftUI'],
    ['Python', 'ML', 'TensorFlow', 'PyTorch', 'NumPy', 'Pandas'],
  ]
  const quotes = [
    null, null, null,
    'The best code is no code at all.',
    'Premature optimization is the root of all evil.',
    null, null,
    'Make it work, make it right, make it fast.',
  ]

  const posts: PostItem[] = []
  for (let i = 0; i < count; i++) {
    const hasImage = i % 5 === 0
    posts.push({
      id: i,
      author: authors[i % authors.length]!,
      time: `${(i % 23) + 1}h`,
      body: bodies[i % bodies.length]!,
      hasQuote: quotes[i % quotes.length] !== null,
      quoteText: quotes[i % quotes.length] ?? null,
      tags: tagSets[i % tagSets.length]!,
      hasImage,
      imageRatio: hasImage ? [9/16, 3/4, 1, 4/3][i % 4]! : 0,
      likes: (i * 7 + 3) % 200,
    })
  }
  return posts
}

// --- Schema ---

const FONT = '14px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 20
const QUOTE_FONT = '13px Inter, system-ui, sans-serif'
const QUOTE_LINE_HEIGHT = 18
const TAG_FONT = '12px Inter, system-ui, sans-serif'

const postSchema = schema({
  padding: [12, 16, 13, 16], // 13 bottom = 12 + 1 border
  gap: 8,
  children: [
    fixed(20),                                                            // author + time
    text('body', { font: FONT, lineHeight: LINE_HEIGHT, minHeight: 20 }), // body text (minHeight)
    conditional('hasQuote', group({
      padding: [8, 12, 8, 12],
      children: [text('quoteText', { font: QUOTE_FONT, lineHeight: QUOTE_LINE_HEIGHT, maxLines: 2 })],
    })),
    conditional('hasImage', aspectRatio(0, { field: 'imageRatio', maxHeight: 300 })),
    flexWrap('tags', { font: TAG_FONT, itemHeight: 24, itemPadding: 8, columnGap: 6, rowGap: 4 }),
    fixed(20),                                                            // likes row
  ],
})

// --- Components ---

function PostCard({ post, onMount }: { post: PostItem; onMount?: (el: HTMLDivElement) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && onMount) onMount(ref.current)
  }, [onMount])

  const contentWidth = ref.current?.getBoundingClientRect().width ?? 0

  return (
    <div ref={ref} style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
      {/* Author row — fixed(20) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', height: 20, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{post.author}</span>
        <span style={{ color: '#666', fontSize: 12 }}>{post.time}</span>
      </div>

      {/* Body — text with minHeight */}
      <div style={{ marginTop: 8, font: FONT, lineHeight: `${LINE_HEIGHT}px`, minHeight: 20, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {post.body}
      </div>

      {/* Quote — conditional + group + text with maxLines: 2 */}
      {post.hasQuote && post.quoteText && (
        <div style={{
          marginTop: 8, padding: '8px 12px', background: '#1a1a1a',
          borderLeft: '3px solid #333', borderRadius: 4,
          font: QUOTE_FONT, lineHeight: `${QUOTE_LINE_HEIGHT}px`, color: '#999',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {post.quoteText}
        </div>
      )}

      {/* Image — conditional + aspectRatio */}
      {post.hasImage && (
        <div style={{
          marginTop: 8,
          width: '100%',
          aspectRatio: `1 / ${post.imageRatio}`,
          maxHeight: 300,
          background: `linear-gradient(135deg, hsl(${post.id * 37 % 360}, 40%, 15%), hsl(${post.id * 73 % 360}, 40%, 20%))`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#555', fontSize: 12,
        }}>
          {Math.round(1 / post.imageRatio * 100)}:{100} image
        </div>
      )}

      {/* Tags — flexWrap */}
      {post.tags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
          {post.tags.map(tag => (
            <span key={tag} style={{
              height: 24, padding: '0 8px', background: '#1a1a2e', borderRadius: 12,
              font: TAG_FONT, lineHeight: '24px', color: '#8b8bf5',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Likes row — fixed(20) */}
      <div style={{ marginTop: 8, height: 20, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center' }}>
        ♥ {post.likes}
      </div>
    </div>
  )
}

// --- App ---

const ITEM_COUNT = 30

function App() {
  const posts = useRef(generatePosts(ITEM_COUNT)).current
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(480)
  const [showOverlay, setShowOverlay] = useState(false)
  const overlayRef = useRef(createDevOverlay())
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Compute predicted heights
  const predictions = posts.map(post => {
    const prepared = prepareItem(post as unknown as Record<string, unknown>, postSchema)
    return layoutItem(prepared, width, postSchema)
  })

  const handleCardMount = useCallback((index: number) => (el: HTMLDivElement) => {
    cardRefs.current.set(index, el)
  }, [])

  useEffect(() => {
    if (!showOverlay) {
      overlayRef.current.hide()
      return
    }
    // Wait for render
    requestAnimationFrame(() => {
      const overlay = overlayRef.current
      overlay.destroy()
      for (const [index, el] of cardRefs.current) {
        overlay.measure(el, predictions[index]!)
      }
      overlay.show()
    })
  }, [showOverlay, predictions])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const summary = overlayRef.current.summary()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #222', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Feature Showcase</h1>
            <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {ITEM_COUNT} posts using all schema primitives at {Math.round(width)}px
            </p>
          </div>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            style={{
              padding: '8px 16px',
              background: showOverlay ? '#4ade80' : '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 6,
              color: showOverlay ? '#000' : '#e5e5e5',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showOverlay ? 'Hide DevTools' : 'Show DevTools'}
          </button>
        </div>

        {/* Schema legend */}
        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: '#666', flexWrap: 'wrap' }}>
          <span>fixed(20) = header/likes</span>
          <span>text + minHeight = body</span>
          <span>group + maxLines:2 = quote</span>
          <span>aspectRatio = image</span>
          <span>flexWrap = tags</span>
        </div>
      </div>

      {/* Cards */}
      <div ref={containerRef}>
        {posts.map((post, i) => (
          <div key={post.id} style={{ position: 'relative' }}>
            {/* Height prediction badge */}
            <div style={{
              position: 'absolute', top: 4, right: 4, zIndex: 5,
              font: '10px/1 monospace', padding: '2px 4px',
              background: '#111', border: '1px solid #333', borderRadius: 3, color: '#888',
            }}>
              predicted: {Math.round(predictions[i]!)}px
            </div>
            <PostCard post={post} onMount={handleCardMount(i)} />
          </div>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
