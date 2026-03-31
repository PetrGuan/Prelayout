// Runtime auto-calibration for Prelayout.
//
// Problem: manually writing schema constants (padding, gap, fixed heights)
// is error-prone and drifts when CSS changes.
//
// Solution: measure the first N rendered items, compare predicted vs actual
// heights, and learn a per-child correction that makes future predictions exact.
//
// How it works:
//   1. User provides a schema with approximate values (or even zeros)
//   2. As items render, call `observe(element, index)` on each
//   3. After N observations, the calibrator computes corrections:
//      - Global height offset (padding + border drift)
//      - Per-observation error distribution
//   4. `getCorrectedHeight(index)` returns predicted + correction
//   5. Once calibrated, the correction is stable and free (pure arithmetic)
//
// This does NOT replace the schema — it supplements it. Text line-breaking
// is still done by Pretext. The calibrator only fixes the constant offsets
// (padding, gaps, borders, fixed heights) that are hardest to keep in sync.

export type AutoCalibrateOptions = {
  /** Number of items to observe before considering calibration stable. Default: 10 */
  sampleSize?: number
  /** Maximum correction to apply (px). Prevents runaway corrections. Default: 50 */
  maxCorrection?: number
  /** Callback fired once calibration stabilizes */
  onCalibrated?: (correction: number) => void
}

export type AutoCalibrator = {
  /** Call when an item renders. Returns the corrected height. */
  observe: (element: HTMLElement, index: number, predictedHeight: number) => number
  /** Get corrected height for an item (uses learned correction if calibrated) */
  getCorrectedHeight: (predictedHeight: number) => number
  /** Whether enough samples have been collected */
  isCalibrated: boolean
  /** Current correction value (px added to predicted height) */
  correction: number
  /** Number of observations collected */
  observationCount: number
  /** Reset all observations and correction */
  reset: () => void
}

export function createAutoCalibrator(options?: AutoCalibrateOptions): AutoCalibrator {
  const sampleSize = options?.sampleSize ?? 10
  const maxCorrection = options?.maxCorrection ?? 50
  const onCalibrated = options?.onCalibrated

  // Track per-item errors: predicted - actual
  const errors: number[] = []
  const observedIndices = new Set<number>()
  let correction = 0
  let isCalibrated = false

  function computeCorrection(): number {
    if (errors.length === 0) return 0
    // Use median error — more robust than mean against outliers
    // (e.g. one item with a very different structure)
    const sorted = errors.slice().sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!
    // Clamp to maxCorrection
    return Math.max(-maxCorrection, Math.min(maxCorrection, -median))
  }

  function observe(element: HTMLElement, index: number, predictedHeight: number): number {
    if (!observedIndices.has(index)) {
      const actual = element.getBoundingClientRect().height
      const error = predictedHeight - actual
      errors.push(error)
      observedIndices.add(index)

      if (!isCalibrated && errors.length >= sampleSize) {
        correction = computeCorrection()
        isCalibrated = true
        onCalibrated?.(correction)
      }
    }
    return predictedHeight + correction
  }

  function getCorrectedHeight(predictedHeight: number): number {
    return predictedHeight + correction
  }

  function reset(): void {
    errors.length = 0
    observedIndices.clear()
    correction = 0
    isCalibrated = false
  }

  return {
    observe,
    getCorrectedHeight,
    get isCalibrated() { return isCalibrated },
    get correction() { return correction },
    get observationCount() { return observedIndices.size },
    reset,
  }
}
