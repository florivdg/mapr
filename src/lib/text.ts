import { parse, type Font, type Glyph, type Path } from 'opentype.js'
import greatVibesLatin from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?url'
import greatVibesLatinExt from '@fontsource/great-vibes/files/great-vibes-latin-ext-400-normal.woff?url'
import delafieldLatin from '@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff?url'
import delafieldLatinExt from '@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-ext-400-normal.woff?url'
import cormorantLatin from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff?url'
import cormorantLatinExt from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-ext-500-italic.woff?url'
import montserratLightLatin from '@fontsource/montserrat/files/montserrat-latin-300-normal.woff?url'
import montserratLightLatinExt from '@fontsource/montserrat/files/montserrat-latin-ext-300-normal.woff?url'
import montserratLatin from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url'
import montserratLatinExt from '@fontsource/montserrat/files/montserrat-latin-ext-400-normal.woff?url'
import { fetchOk, memoizeAsync } from './fetch'
import { roundMm as round } from './layout'

/**
 * Poster text is converted to vector outlines, so previews, PNG/JPEG renders and
 * SVG files look identical and never depend on fonts installed on a machine.
 */
export type FontId = 'greatVibes' | 'delafield' | 'cormorant' | 'montserratLight' | 'montserrat'

const FONT_FILES: Record<FontId, string[]> = {
  greatVibes: [greatVibesLatin, greatVibesLatinExt],
  delafield: [delafieldLatin, delafieldLatinExt],
  cormorant: [cormorantLatin, cormorantLatinExt],
  montserratLight: [montserratLightLatin, montserratLightLatinExt],
  montserrat: [montserratLatin, montserratLatinExt],
}

/** A typeface split into unicode subsets; characters fall back through the list. */
export type FontStack = Font[]

export const loadFont = memoizeAsync((id: FontId): Promise<FontStack> =>
  Promise.all(FONT_FILES[id].map(async (url) => parse(await (await fetchOk(url)).arrayBuffer()))),
)

export type TitleFontId = 'script' | 'signature' | 'serif' | 'sans'

export interface TextStyle {
  font: FontId
  /** Font size in mm. */
  size: number
  /** Extra space between letters, in em. */
  tracking: number
  uppercase: boolean
}

export const TITLE_STYLES: Record<TitleFontId, TextStyle & { label: string }> = {
  script: { label: 'Script', font: 'greatVibes', size: 25, tracking: 0, uppercase: false },
  signature: { label: 'Signature', font: 'delafield', size: 34, tracking: 0, uppercase: false },
  serif: { label: 'Serif', font: 'cormorant', size: 21, tracking: 0.01, uppercase: false },
  sans: { label: 'Sans', font: 'montserratLight', size: 11, tracking: 0.3, uppercase: true },
}

export const NAMES_STYLE: TextStyle = {
  font: 'montserrat',
  size: 4.2,
  tracking: 0.3,
  uppercase: true,
}
export const LOCATION_STYLE: TextStyle = {
  font: 'montserrat',
  size: 3.3,
  tracking: 0.22,
  uppercase: true,
}
export const ATTRIBUTION_STYLE: TextStyle = {
  font: 'montserrat',
  size: 1.6,
  tracking: 0.04,
  uppercase: false,
}

interface PlacedGlyph {
  font: Font
  glyph: Glyph
  x: number
}

function fontFor(stack: FontStack, char: string) {
  return stack.find((font) => font.hasChar(char))
}

/** Applies ligatures where opentype.js can; some fonts use substitution tables it doesn't support. */
function toGlyphs(font: Font, text: string) {
  try {
    return font.stringToGlyphs(text)
  } catch {
    return Array.from(text, (char) => font.charToGlyph(char))
  }
}

function layoutGlyphs(stack: FontStack, text: string, size: number, tracking: number) {
  // Split the text into runs that share a font subset, so ligatures and kerning still apply.
  const runs: { font: Font; text: string }[] = []
  for (const char of text) {
    const font = fontFor(stack, char)
    if (!font) continue
    const last = runs.at(-1)
    if (last?.font === font) last.text += char
    else runs.push({ font, text: char })
  }

  const glyphs: PlacedGlyph[] = []
  let x = 0
  let previous: PlacedGlyph | null = null
  for (const run of runs) {
    const scale = size / run.font.unitsPerEm
    for (const glyph of toGlyphs(run.font, run.text)) {
      if (previous) {
        x += tracking * size
        if (previous.font === run.font) x += run.font.getKerningValue(previous.glyph, glyph) * scale
      }
      previous = { font: run.font, glyph, x }
      glyphs.push(previous)
      x += (glyph.advanceWidth ?? 0) * scale
    }
  }
  return { glyphs, width: x }
}

// opentype.js's own toPathData() produces NaN for some coordinates, so serialize directly.
function toPathData(path: Path) {
  let d = ''
  for (const c of path.commands) {
    if (c.type === 'M' || c.type === 'L') d += `${c.type}${round(c.x)} ${round(c.y)}`
    else if (c.type === 'Q') d += `Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`
    else if (c.type === 'C') {
      d += `C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`
    } else d += 'Z'
  }
  return d
}

/** Cap height as a fraction of the font size. */
export function capHeightRatio(stack: FontStack) {
  const font = stack[0]
  const capHeight = font?.tables.os2?.sCapHeight
  return font && capHeight ? capHeight / font.unitsPerEm : 0.7
}

/**
 * Lays out one centred line of text as SVG path data, shrinking it to fit maxWidth.
 * `y` is the baseline, or with `capMiddle` the height where the capitals are centred.
 */
export function textToPath(
  stack: FontStack,
  style: TextStyle,
  text: string,
  placement: { x: number; y: number; maxWidth: number; size?: number; capMiddle?: boolean },
) {
  const { x, y, maxWidth, size = style.size, capMiddle = false } = placement
  const content = style.uppercase ? text.toUpperCase() : text
  const layout = layoutGlyphs(stack, content, size, style.tracking)
  // Layout scales linearly with size, so shrinking to fit needs no second pass.
  const fit = Math.min(1, maxWidth / layout.width)
  const fittedSize = size * fit
  const baseline = capMiddle ? y + (capHeightRatio(stack) * fittedSize) / 2 : y
  const left = x - (layout.width * fit) / 2
  return layout.glyphs
    .map(({ font, glyph, x: offset }) =>
      toPathData(glyph.getPath(left + offset * fit, baseline, fittedSize, undefined, font)),
    )
    .join('')
}
