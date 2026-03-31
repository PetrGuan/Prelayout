// CSS generation utilities.
//
// Generates inline styles or CSS custom properties from predicted heights,
// ready to inject into SSR HTML for zero-CLS rendering.

/**
 * Generate a CSS style string with custom properties per breakpoint.
 *
 * Usage in SSR HTML:
 *   <div style="${generateStyle(heights, breakpoints)}">...</div>
 *
 * Then in CSS:
 *   .text-block { height: var(--h); }
 */
export function generateInlineHeight(
  heights: Record<number, number>,
  defaultBreakpoint: number,
): string {
  const h = heights[defaultBreakpoint]
  if (h === undefined) return ''
  return `height:${Math.ceil(h)}px`
}

/**
 * Generate CSS custom properties for each breakpoint.
 * Returns an object suitable for React's style prop.
 *
 * Example:
 *   { '--h-sm': '120px', '--h-md': '80px', '--h-lg': '60px' }
 */
export function generateCSSVars(
  heights: Record<number, number>,
  prefix = 'h',
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [bp, h] of Object.entries(heights)) {
    vars[`--${prefix}-${bp}`] = `${Math.ceil(Number(h))}px`
  }
  return vars
}

/**
 * Generate a mobile-first <style> block with min-width media queries.
 * The smallest breakpoint becomes the base rule (no media query).
 *
 * Example output:
 *   .article-body { height: 120px; }
 *   @media (min-width: 768px) { .article-body { height: 80px; } }
 *   @media (min-width: 1024px) { .article-body { height: 60px; } }
 */
export function generateMediaQueryCSS(
  selector: string,
  heights: Record<number, number>,
  breakpoints: number[],
): string {
  const sorted = breakpoints.slice().sort((a, b) => a - b)
  const lines: string[] = []

  for (let i = 0; i < sorted.length; i++) {
    const bp = sorted[i]!
    const h = heights[bp]
    if (h === undefined) continue

    if (i === 0) {
      lines.push(`${selector}{height:${Math.ceil(h)}px}`)
    } else {
      lines.push(`@media(min-width:${bp}px){${selector}{height:${Math.ceil(h)}px}}`)
    }
  }

  return lines.join('\n')
}
