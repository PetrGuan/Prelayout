// CSS value extraction utilities for schema generation.
//
// These helpers parse common CSS/Tailwind patterns into schema-compatible
// numbers. Use them to derive schema constants from your design tokens
// rather than hardcoding pixel values.
//
// Usage:
//   import { fromCSS, fromTailwind } from 'prelayout/extract'
//
//   const s = schema({
//     padding: fromCSS.padding('12px 16px'),
//     gap: fromCSS.px('8px'),
//     children: [
//       fixed(fromCSS.px('40px')),
//       text('body', { font: fromCSS.font('16px/22px Inter'), lineHeight: 22 }),
//     ],
//   })

// Padding type is [number, number, number, number] — matches schema.ts

// --- CSS value parsers ---

export const fromCSS = {
  /** Parse a CSS px value: '12px' → 12, '1.5rem' → 24 (assumes 16px root) */
  px(value: string, rootFontSize = 16): number {
    const trimmed = value.trim()
    if (trimmed.endsWith('px')) return parseFloat(trimmed)
    if (trimmed.endsWith('rem')) return parseFloat(trimmed) * rootFontSize
    if (trimmed.endsWith('em')) return parseFloat(trimmed) * rootFontSize
    return parseFloat(trimmed) || 0
  },

  /** Parse CSS padding shorthand: '12px' | '12px 16px' | '12px 16px 12px 16px' */
  padding(value: string, rootFontSize = 16): [number, number, number, number] {
    const parts = value.trim().split(/\s+/).map(p => fromCSS.px(p, rootFontSize))
    if (parts.length === 1) return [parts[0]!, parts[0]!, parts[0]!, parts[0]!]
    if (parts.length === 2) return [parts[0]!, parts[1]!, parts[0]!, parts[1]!]
    if (parts.length === 3) return [parts[0]!, parts[1]!, parts[2]!, parts[1]!]
    return [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
  },

  /** Parse CSS font shorthand: '16px Inter' → { font: '16px Inter', fontSize: 16 } */
  font(value: string): { font: string; fontSize: number } {
    const match = value.match(/(\d+(?:\.\d+)?)\s*px/)
    return { font: value, fontSize: match ? parseFloat(match[1]!) : 16 }
  },

  /** Parse CSS line-height: '22px' → 22, '1.5' → fontSize * 1.5 */
  lineHeight(value: string, fontSize = 16): number {
    const trimmed = value.trim()
    if (trimmed.endsWith('px')) return parseFloat(trimmed)
    const num = parseFloat(trimmed)
    if (num > 0 && num < 10) return Math.round(num * fontSize) // unitless ratio
    return num || fontSize
  },
}

// --- Tailwind class parsers ---

const twSpacingScale: Record<string, number> = {
  '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
  '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28,
  '8': 32, '9': 36, '10': 40, '11': 44, '12': 48, '14': 56,
  '16': 64, '20': 80, '24': 96, '28': 112, '32': 128,
  '36': 144, '40': 160, '44': 176, '48': 192, '52': 208,
  '56': 224, '60': 240, '64': 256, '72': 288, '80': 320, '96': 384,
  'px': 1,
}

const twTextScale: Record<string, { fontSize: number; lineHeight: number }> = {
  'xs': { fontSize: 12, lineHeight: 16 },
  'sm': { fontSize: 14, lineHeight: 20 },
  'base': { fontSize: 16, lineHeight: 24 },
  'lg': { fontSize: 18, lineHeight: 28 },
  'xl': { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
  '4xl': { fontSize: 36, lineHeight: 40 },
  '5xl': { fontSize: 48, lineHeight: 48 },
}

export const fromTailwind = {
  /** Parse a Tailwind spacing value: 'p-4' → 16, 'gap-2' → 8 */
  spacing(twClass: string): number {
    const match = twClass.match(/(?:p|m|gap|space-[xy])-\[?(\d+(?:\.\d+)?)(px|rem)?\]?$/)
    if (match) {
      if (match[2] === 'px') return parseFloat(match[1]!)
      if (match[2] === 'rem') return parseFloat(match[1]!) * 16
      return twSpacingScale[match[1]!] ?? 0
    }
    const scaleMatch = twClass.match(/(?:p|m|gap|space-[xy])-(.+)$/)
    if (scaleMatch) return twSpacingScale[scaleMatch[1]!] ?? 0
    return 0
  },

  /** Parse Tailwind padding classes: 'p-4' | 'px-4 py-3' | 'pt-3 pr-4 pb-3 pl-4' */
  padding(classes: string): [number, number, number, number] {
    const parts = classes.trim().split(/\s+/)
    let t = 0, r = 0, b = 0, l = 0
    for (const cls of parts) {
      if (cls.startsWith('p-') && !cls.startsWith('px-') && !cls.startsWith('py-') && !cls.startsWith('pt-') && !cls.startsWith('pr-') && !cls.startsWith('pb-') && !cls.startsWith('pl-')) {
        const v = fromTailwind.spacing(cls)
        t = r = b = l = v
      } else if (cls.startsWith('px-')) {
        const v = fromTailwind.spacing(cls.replace('px-', 'p-'))
        r = l = v
      } else if (cls.startsWith('py-')) {
        const v = fromTailwind.spacing(cls.replace('py-', 'p-'))
        t = b = v
      } else if (cls.startsWith('pt-')) {
        t = fromTailwind.spacing(cls.replace('pt-', 'p-'))
      } else if (cls.startsWith('pr-')) {
        r = fromTailwind.spacing(cls.replace('pr-', 'p-'))
      } else if (cls.startsWith('pb-')) {
        b = fromTailwind.spacing(cls.replace('pb-', 'p-'))
      } else if (cls.startsWith('pl-')) {
        l = fromTailwind.spacing(cls.replace('pl-', 'p-'))
      }
    }
    return [t, r, b, l]
  },

  /** Parse Tailwind text size: 'text-sm' → { fontSize: 14, lineHeight: 20 } */
  text(twClass: string): { fontSize: number; lineHeight: number } {
    const match = twClass.match(/text-(.+)$/)
    if (match && twTextScale[match[1]!]) return twTextScale[match[1]!]!
    // Arbitrary value: text-[14px]
    const arbMatch = twClass.match(/text-\[(\d+(?:\.\d+)?)(px|rem)?\]/)
    if (arbMatch) {
      const size = arbMatch[2] === 'rem' ? parseFloat(arbMatch[1]!) * 16 : parseFloat(arbMatch[1]!)
      return { fontSize: size, lineHeight: Math.round(size * 1.5) }
    }
    return { fontSize: 16, lineHeight: 24 }
  },

  /** Parse Tailwind height: 'h-10' → 40, 'h-[60px]' → 60 */
  height(twClass: string): number {
    const arbMatch = twClass.match(/h-\[(\d+(?:\.\d+)?)(px|rem)?\]/)
    if (arbMatch) {
      return arbMatch[2] === 'rem' ? parseFloat(arbMatch[1]!) * 16 : parseFloat(arbMatch[1]!)
    }
    const scaleMatch = twClass.match(/h-(.+)$/)
    if (scaleMatch) return twSpacingScale[scaleMatch[1]!] ?? 0
    return 0
  },

  /** Parse Tailwind gap: 'gap-2' → 8, 'gap-[12px]' → 12 */
  gap(twClass: string): number {
    return fromTailwind.spacing(twClass)
  },
}
