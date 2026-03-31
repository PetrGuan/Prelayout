// OffscreenCanvas polyfill for Node.js.
//
// Pretext internally looks for globalThis.OffscreenCanvas to create its
// measurement context. Node.js doesn't have OffscreenCanvas, but
// @napi-rs/canvas provides a compatible canvas implementation.
//
// This polyfill must be called before any Pretext imports.

import { createCanvas } from '@napi-rs/canvas'

let installed = false

export function installPolyfill(): void {
  if (installed) return

  const g = globalThis as Record<string, unknown>
  if (g['OffscreenCanvas'] !== undefined) {
    installed = true
    return
  }

  // Pretext only calls: new OffscreenCanvas(1, 1).getContext('2d')
  // We provide just enough to satisfy that.
  g['OffscreenCanvas'] = class NodeOffscreenCanvas {
    private _canvas

    constructor(width: number, height: number) {
      this._canvas = createCanvas(width, height)
    }

    getContext(_type: string): unknown {
      return this._canvas.getContext('2d')
    }
  }

  installed = true
}
