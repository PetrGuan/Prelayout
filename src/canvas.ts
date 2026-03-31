// Shared canvas measurement context singleton.
// Used by prepare.ts and incremental.ts to avoid duplicate contexts.

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

export function getMeasureContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (measureCtx !== null) return measureCtx
  if (typeof OffscreenCanvas !== 'undefined') {
    measureCtx = new OffscreenCanvas(1, 1).getContext('2d')!
    return measureCtx
  }
  if (typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d')!
    return measureCtx
  }
  throw new Error('Prelayout requires OffscreenCanvas or a DOM canvas context.')
}
