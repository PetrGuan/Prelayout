// Server-side text height prediction (PreSSR).
//
// Runs Pretext in Node.js via an OffscreenCanvas polyfill (@napi-rs/canvas).
// Predicts text heights at multiple responsive breakpoints for zero-CLS SSR.
//
// IMPORTANT: Accurate for Latin text. CJK and emoji predictions are unreliable
// due to differences between @napi-rs/canvas (Skia) and browser font engines.

import { installPolyfill } from './polyfill.js'

export { predictHeight, predictHeights } from './predict.js'
export type { PredictOptions, PredictResult } from './predict.js'

export { generateInlineHeight, generateCSSVars, generateMediaQueryCSS } from './css.js'

/**
 * Initialize the OffscreenCanvas polyfill for Node.js.
 * Must be called once before any predictHeight() calls.
 */
export function init(): void {
  installPolyfill()
}
