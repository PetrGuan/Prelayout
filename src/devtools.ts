// DevTools overlay for Prelayout.
//
// Renders a visual diff between predicted and actual item heights.
// Use during development to catch schema drift instantly.
//
// Usage:
//   import { createDevOverlay } from 'prelayout/devtools'
//
//   const overlay = createDevOverlay()
//   overlay.measure(element, predictedHeight)  // call per visible item
//   overlay.show()                              // render the overlay
//   overlay.hide()                              // remove it
//   overlay.destroy()                           // clean up

export type DevMeasurement = {
  element: HTMLElement
  predicted: number
  actual: number
  diff: number
}

export type DevOverlay = {
  measure: (element: HTMLElement, predictedHeight: number) => DevMeasurement
  measurements: DevMeasurement[]
  show: () => void
  hide: () => void
  destroy: () => void
  summary: () => DevSummary
}

export type DevSummary = {
  totalItems: number
  exactMatches: number
  closeMatches: number
  maxError: number
  avgError: number
}

export function createDevOverlay(): DevOverlay {
  const measurements: DevMeasurement[] = []
  let overlayContainer: HTMLDivElement | null = null

  function measure(element: HTMLElement, predictedHeight: number): DevMeasurement {
    const actual = element.getBoundingClientRect().height
    const diff = predictedHeight - actual
    const m: DevMeasurement = { element, predicted: predictedHeight, actual, diff }
    measurements.push(m)
    return m
  }

  function summary(): DevSummary {
    const totalItems = measurements.length
    if (totalItems === 0) {
      return { totalItems: 0, exactMatches: 0, closeMatches: 0, maxError: 0, avgError: 0 }
    }
    let exactMatches = 0
    let closeMatches = 0
    let maxError = 0
    let totalError = 0
    for (const m of measurements) {
      const absErr = Math.abs(m.diff)
      if (absErr < 1) exactMatches++
      if (absErr < 3) closeMatches++
      if (absErr > maxError) maxError = absErr
      totalError += absErr
    }
    return {
      totalItems,
      exactMatches,
      closeMatches,
      maxError,
      avgError: totalError / totalItems,
    }
  }

  function show(): void {
    hide()
    overlayContainer = document.createElement('div')
    overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999'
    document.body.appendChild(overlayContainer)

    for (const m of measurements) {
      if (Math.abs(m.diff) < 1) continue // skip exact matches
      const rect = m.element.getBoundingClientRect()
      const marker = document.createElement('div')
      const isOver = m.diff > 0
      marker.style.cssText = `
        position:fixed;
        top:${rect.top}px;
        left:${rect.left}px;
        width:${rect.width}px;
        height:${rect.height}px;
        border:2px solid ${isOver ? '#f87171' : '#facc15'};
        background:${isOver ? 'rgba(248,113,113,0.1)' : 'rgba(250,204,21,0.1)'};
        pointer-events:none;
      `
      const label = document.createElement('div')
      label.style.cssText = `
        position:absolute;
        top:-18px;
        right:0;
        font:11px/1 monospace;
        padding:2px 4px;
        background:${isOver ? '#f87171' : '#facc15'};
        color:#000;
        border-radius:2px;
        white-space:nowrap;
      `
      label.textContent = `${m.diff > 0 ? '+' : ''}${m.diff.toFixed(1)}px (predicted: ${m.predicted.toFixed(0)}, actual: ${m.actual.toFixed(0)})`
      marker.appendChild(label)
      overlayContainer.appendChild(marker)
    }

    // Summary badge
    const s = summary()
    const badge = document.createElement('div')
    badge.style.cssText = `
      position:fixed;
      bottom:16px;
      right:16px;
      font:13px/1.4 system-ui,sans-serif;
      padding:12px 16px;
      background:#111;
      border:1px solid #333;
      border-radius:8px;
      color:#e5e5e5;
      pointer-events:auto;
      z-index:100000;
    `
    badge.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">Prelayout DevTools</div>
      <div>Exact (<1px): <span style="color:${s.exactMatches === s.totalItems ? '#4ade80' : '#f87171'}">${s.exactMatches}/${s.totalItems}</span></div>
      <div>Avg error: ${s.avgError.toFixed(2)}px</div>
      <div>Max error: ${s.maxError.toFixed(1)}px</div>
    `
    overlayContainer.appendChild(badge)
  }

  function hide(): void {
    if (overlayContainer !== null) {
      overlayContainer.remove()
      overlayContainer = null
    }
  }

  function destroy(): void {
    hide()
    measurements.length = 0
  }

  return { measure, measurements, show, hide, destroy, summary }
}
