// Chat demo: predict message bubble heights as you type.
//
// Shows a live preview of the predicted bubble height while the user
// types a message. The virtual list at the top uses predicted heights
// for instant scroll positioning — no measureElement needed.

import { createRoot } from 'react-dom/client'
import { useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { schema, fixed, text, prepareItem, layoutItem } from 'prelayout'
import { usePrelayout } from 'prelayout/react'

const FONT = '14px Inter, system-ui, sans-serif'
const LINE_HEIGHT = 20

// Bubble schema: different padding for sent vs received
const sentSchema = schema({
  padding: [8, 12, 8, 12],
  gap: 4,
  children: [
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    fixed(14), // timestamp
  ],
})

const receivedSchema = schema({
  padding: [8, 12, 8, 12],
  gap: 4,
  children: [
    fixed(16), // sender name
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
    fixed(14), // timestamp
  ],
})

// Row schema: message + vertical spacing
const rowSchema = schema({
  padding: [4, 0, 4, 0],
  children: [
    text('body', { font: FONT, lineHeight: LINE_HEIGHT }),
  ],
})

type Message = {
  id: number
  body: string
  sender: string
  isSent: boolean
  time: string
}

const initialMessages: Message[] = [
  { id: 0, body: 'Hey! Have you seen the Prelayout library?', sender: 'Alice', isSent: false, time: '10:01' },
  { id: 1, body: 'No, what is it?', sender: 'You', isSent: true, time: '10:02' },
  { id: 2, body: 'It predicts virtual list item heights without DOM measurement. Built on Pretext — the text layout engine that replicates browser line breaking in JavaScript.', sender: 'Alice', isSent: false, time: '10:02' },
  { id: 3, body: 'That sounds interesting. How accurate is it?', sender: 'You', isSent: true, time: '10:03' },
  { id: 4, body: '500/500 exact match in their accuracy test. And it\'s about 100x faster than DOM measurement for the resize path.', sender: 'Alice', isSent: false, time: '10:03' },
  { id: 5, body: 'Wow 🚀', sender: 'You', isSent: true, time: '10:04' },
  { id: 6, body: 'Yeah, it handles CJK, Arabic, Thai, emoji... basically all Unicode scripts. They stress tested with 28 adversarial cases.', sender: 'Alice', isSent: false, time: '10:04' },
  { id: 7, body: 'Does it work with tanstack virtual?', sender: 'You', isSent: true, time: '10:05' },
  { id: 8, body: 'Yep! It replaces estimateSize with exact heights. No more measureElement, no more scroll jumping.', sender: 'Alice', isSent: false, time: '10:05' },
  { id: 9, body: '让我试试中文消息 — Prelayout 应该能正确处理 CJK 文本换行吧？', sender: 'Alice', isSent: false, time: '10:06' },
  { id: 10, body: '当然可以！它用 Intl.Segmenter 做分词，canvas.measureText() 做度量，和浏览器用的是同一个字体引擎。', sender: 'You', isSent: true, time: '10:06' },
  { id: 11, body: 'مرحبا! هل يدعم النصوص العربية أيضا؟', sender: 'Alice', isSent: false, time: '10:07' },
  { id: 12, body: 'Yes, Arabic RTL is supported through Pretext\'s bidi handling 🎉', sender: 'You', isSent: true, time: '10:07' },
]

function Bubble({ msg, maxWidth }: { msg: Message; maxWidth: number }) {
  const bubbleMaxWidth = Math.min(maxWidth * 0.75, 400)
  const s = msg.isSent ? sentSchema : receivedSchema
  const prepared = prepareItem(msg as unknown as Record<string, unknown>, s)
  const height = layoutItem(prepared, bubbleMaxWidth, s)

  return (
    <div style={{
      display: 'flex',
      justifyContent: msg.isSent ? 'flex-end' : 'flex-start',
      padding: '4px 16px',
    }}>
      <div style={{
        maxWidth: bubbleMaxWidth,
        padding: '8px 12px',
        borderRadius: msg.isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: msg.isSent ? '#2563eb' : '#222',
      }}>
        {!msg.isSent && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8b8bf5', height: 16, lineHeight: '16px' }}>
            {msg.sender}
          </div>
        )}
        <div style={{
          font: FONT, lineHeight: `${LINE_HEIGHT}px`, color: '#e5e5e5',
          marginTop: !msg.isSent ? 4 : 0,
          wordBreak: 'break-word', overflowWrap: 'break-word',
        }}>
          {msg.body}
        </div>
        <div style={{
          fontSize: 11, color: msg.isSent ? '#93b5f5' : '#666', textAlign: 'right',
          height: 14, lineHeight: '14px', marginTop: 4,
        }}>
          {msg.time}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
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

  // Predict heights for virtual list
  const messageHeights = useMemo(() => {
    if (containerWidth === 0) return messages.map(() => 50)
    const bubbleMaxWidth = Math.min(containerWidth * 0.75, 400)
    return messages.map(msg => {
      const s = msg.isSent ? sentSchema : receivedSchema
      const prepared = prepareItem(msg as unknown as Record<string, unknown>, s)
      return layoutItem(prepared, bubbleMaxWidth, s) + 8 // +8 for row padding
    })
  }, [messages, containerWidth])

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => messageHeights[i] ?? 50,
    overscan: 5,
  })

  // Auto-scroll to bottom when new message added
  useEffect(() => {
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
  }, [messages.length, virtualizer])

  // Live preview of draft height
  const draftHeight = useMemo(() => {
    if (!draft || containerWidth === 0) return 0
    const bubbleMaxWidth = Math.min(containerWidth * 0.75, 400)
    const prepared = prepareItem({ body: draft } as Record<string, unknown>, sentSchema)
    return layoutItem(prepared, bubbleMaxWidth, sentSchema)
  }, [draft, containerWidth])

  function send() {
    if (!draft.trim()) return
    setMessages(prev => [...prev, {
      id: prev.length,
      body: draft.trim(),
      sender: 'You',
      isSent: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
    setDraft('')
  }

  return (
    <div ref={containerRef} style={{ maxWidth: 500, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Chat Demo</h1>
        <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          Bubble heights predicted in real time — type to see live preview
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(row => (
            <div key={row.key} style={{
              position: 'absolute', top: 0, left: 0, width: '100%',
              height: row.size,
              transform: `translateY(${row.start}px)`,
            }}>
              <Bubble msg={messages[row.index]!} maxWidth={containerWidth} />
            </div>
          ))}
        </div>
      </div>

      {/* Draft preview */}
      {draft && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
          Predicted bubble height: {draftHeight}px
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #222', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Type a message..."
          style={{
            flex: 1, padding: '10px 14px', background: '#111', border: '1px solid #333',
            borderRadius: 20, color: '#e5e5e5', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={send} style={{
          padding: '10px 20px', background: '#2563eb', border: 'none', borderRadius: 20,
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          Send
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
