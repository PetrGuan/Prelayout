// Core prediction API.
//
// predictHeight() takes text, font, and breakpoints, returns the predicted
// height at each breakpoint. This is the main entry point for SSR usage.
//
// Under the hood: Pretext's prepare() segments and measures text via canvas,
// then layout() computes line count via pure arithmetic. The prepare handle
// is width-independent, so one prepare call serves all breakpoints.

import { prepare, layout, type PreparedText } from '@chenglou/pretext'

export type PredictOptions = {
  /** The text content to predict height for */
  text: string
  /** CSS font string, e.g. '16px Inter' or '600 14px/1.5 Inter' */
  font: string
  /** Line height in pixels */
  lineHeight: number
  /** Container widths to predict at (e.g. [375, 768, 1024]) */
  breakpoints: number[]
  /** Total horizontal padding to subtract from each breakpoint (left + right combined, default: 0) */
  horizontalPadding?: number
  /** Maximum lines to display (CSS -webkit-line-clamp). null = no limit */
  maxLines?: number
}

export type PredictResult = {
  /** Map from breakpoint width to predicted height */
  heights: Record<number, number>
  /** Map from breakpoint width to predicted line count */
  lines: Record<number, number>
  /** The Pretext PreparedText handle (reusable for additional breakpoints). Null for empty text. */
  prepared: PreparedText | null
}

export function predictHeight(options: PredictOptions): PredictResult {
  const { text, font, lineHeight, breakpoints, horizontalPadding = 0, maxLines } = options

  if (text.length === 0) {
    const heights: Record<number, number> = {}
    const lines: Record<number, number> = {}
    for (const bp of breakpoints) {
      heights[bp] = 0
      lines[bp] = 0
    }
    return { heights, lines, prepared: null }
  }

  const prepared = prepare(text, font)
  const heights: Record<number, number> = {}
  const lines: Record<number, number> = {}

  for (const bp of breakpoints) {
    const contentWidth = Math.max(0, bp - horizontalPadding)
    const result = layout(prepared, contentWidth, lineHeight)
    const lineCount = maxLines != null ? Math.min(result.lineCount, maxLines) : result.lineCount
    lines[bp] = lineCount
    heights[bp] = lineCount * lineHeight
  }

  return { heights, lines, prepared }
}

/**
 * Batch predict heights for multiple text blocks at the same breakpoints.
 * More efficient than calling predictHeight() in a loop because it shares
 * the breakpoint iteration overhead.
 */
export function predictHeights(
  items: { text: string; font: string; lineHeight: number; maxLines?: number; horizontalPadding?: number }[],
  breakpoints: number[],
  horizontalPadding = 0,
): { heights: Record<number, number[]>; totalHeights: Record<number, number> } {
  const heights: Record<number, number[]> = {}
  const totalHeights: Record<number, number> = {}

  for (const bp of breakpoints) {
    heights[bp] = []
    totalHeights[bp] = 0
  }

  for (const item of items) {
    const prepared = item.text.length > 0 ? prepare(item.text, item.font) : null

    for (const bp of breakpoints) {
      if (prepared === null) {
        heights[bp]!.push(0)
        continue
      }
      const pad = item.horizontalPadding ?? horizontalPadding
      const contentWidth = Math.max(0, bp - pad)
      const result = layout(prepared, contentWidth, item.lineHeight)
      const lineCount = item.maxLines != null ? Math.min(result.lineCount, item.maxLines) : result.lineCount
      const h = lineCount * item.lineHeight
      heights[bp]!.push(h)
      totalHeights[bp]! += h
    }
  }

  return { heights, totalHeights }
}
