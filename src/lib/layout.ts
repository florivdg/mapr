export type PaperFormatId = 'A4' | 'A3'

export const PAPER_FORMATS: Record<
  PaperFormatId,
  { label: string; width: number; height: number }
> = {
  A4: { label: 'DIN A4', width: 210, height: 297 },
  A3: { label: 'DIN A3', width: 297, height: 420 },
}

/**
 * The poster is designed once on an A4 sheet in millimetres. A3 shares the same
 * DIN aspect ratio, so it is the identical design scaled up by √2.
 */
export const PAGE = PAPER_FORMATS.A4

/** Poster coordinates are kept to 0.01 mm, far below what a 300 dpi print resolves. */
export const roundMm = (value: number) => Math.round(value * 100) / 100

export type LayoutId = 'bleed' | 'margin' | 'circle'

export interface Frame {
  x: number
  y: number
  w: number
  h: number
  shape: 'rect' | 'circle'
}

export function frameCenter(frame: Frame) {
  return { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }
}

export const LAYOUTS: Record<LayoutId, { label: string; frame: Frame }> = {
  bleed: { label: 'Full bleed', frame: { x: 0, y: 0, w: 210, h: 224, shape: 'rect' } },
  margin: { label: 'Margin', frame: { x: 15, y: 15, w: 180, h: 204, shape: 'rect' } },
  circle: { label: 'Circle', frame: { x: 27, y: 26, w: 156, h: 156, shape: 'circle' } },
}

export const TEXT_BLOCK = {
  centerX: PAGE.width / 2,
  maxWidth: 176,
  namesBaseline: 270,
  locationBaseline: 278.5,
  attributionBaseline: 292,
}

export const EXPORT_DPI = 300

export function pixelSize(format: PaperFormatId) {
  const { width, height } = PAPER_FORMATS[format]
  return {
    width: Math.round((width / 25.4) * EXPORT_DPI),
    height: Math.round((height / 25.4) * EXPORT_DPI),
  }
}
