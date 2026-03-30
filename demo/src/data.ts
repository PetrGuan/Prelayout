// Generate 10,000 realistic comment items with variable-length text.

const names = [
  'Alice Chen', 'Bob Kim', 'Carlos García', 'Diana Müller', 'Émile Dubois',
  'Fatima Al-Rashid', 'Giovanni Rossi', 'Haruki Tanaka', 'Isha Patel', 'Jakob Andersen',
  'Keiko Yamamoto', 'Liam O\'Brien', 'Maria Santos', 'Nikolai Petrov', 'Olga Ivanova',
  'Paulo Silva', 'Quinn Murphy', 'Rashid Khan', 'Sofia Hernández', 'Tomás Novák',
]

const shortTexts = [
  'Great work!',
  'Thanks for sharing.',
  'I agree with this.',
  'Interesting perspective.',
  '👍',
  'This is exactly what I needed.',
  'Well said.',
  'Can confirm this works.',
  '+1',
  'Nice find!',
]

const mediumTexts = [
  'This is a really interesting approach to the problem. I had been thinking about something similar but never got around to implementing it. Would love to see a follow-up post.',
  'I tried this in production last week and the results were impressive. The latency dropped by about 40% across the board. Highly recommend giving it a shot.',
  'One thing to keep in mind is that this won\'t work well with older browsers. We had to add a polyfill for Safari 15 and below, but after that it was smooth sailing.',
  'The performance implications here are significant. When you\'re dealing with thousands of items in a virtual list, every millisecond counts. This approach eliminates the main bottleneck.',
  'I\'ve been using a similar technique for our dashboard at work. The key insight is that you don\'t need pixel-perfect accuracy — even 95% accurate heights eliminate most of the visual jumping.',
]

const longTexts = [
  'This reminds me of a talk I saw at last year\'s conference about layout thrashing. The speaker demonstrated how a single getBoundingClientRect() call in a loop could turn a 1ms operation into a 30ms one. The solution they proposed was similar — batch all reads first, then do all writes. But what makes this library different is that it eliminates the reads entirely by predicting the values from cached measurements. That\'s a fundamentally better approach because you\'re not just reordering the work, you\'re removing it.',
  'We migrated our entire feed to virtual scrolling last quarter and the biggest pain point was exactly this — getting accurate item heights without rendering first. We tried three different approaches: 1) Fixed height estimates with ResizeObserver corrections (too jumpy), 2) Rendering items off-screen first to measure them (too slow), 3) A custom height prediction function that hard-coded our layout rules (worked but was fragile and broke every time design changed a padding value). This schema-based approach would have saved us weeks.',
  'For anyone wondering about i18n implications: text wrapping behavior varies significantly across scripts. Chinese text breaks at every character boundary, Thai has no spaces between words, Arabic goes right-to-left, and emoji widths are inconsistent across browsers. Getting height prediction right means handling all of these correctly. The fact that this builds on Pretext means it inherits all of that Unicode complexity handling for free.',
]

const quotes = [
  'The best code is no code at all.',
  'Premature optimization is the root of all evil — Donald Knuth',
  'Make it work, make it right, make it fast — Kent Beck',
  null, null, null, null, null, // most comments don't have quotes
]

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export type CommentItem = {
  id: number
  name: string
  body: string
  time: string
  quote: string | null
  hasImage: boolean
  likes: number
  replies: number
}

export function generateComments(count: number): CommentItem[] {
  const rand = seededRandom(42)
  const items: CommentItem[] = []

  for (let i = 0; i < count; i++) {
    const r = rand()
    let body: string
    if (r < 0.4) body = shortTexts[Math.floor(rand() * shortTexts.length)]!
    else if (r < 0.8) body = mediumTexts[Math.floor(rand() * mediumTexts.length)]!
    else body = longTexts[Math.floor(rand() * longTexts.length)]!

    items.push({
      id: i,
      name: names[Math.floor(rand() * names.length)]!,
      body,
      time: `${Math.floor(rand() * 23 + 1)}h`,
      quote: quotes[Math.floor(rand() * quotes.length)] ?? null,
      hasImage: rand() < 0.1,
      likes: Math.floor(rand() * 200),
      replies: Math.floor(rand() * 30),
    })
  }

  return items
}
