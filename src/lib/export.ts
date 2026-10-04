import { EXPORT_DPI, PAPER_FORMATS, pixelSize, type PaperFormatId } from './layout'

export type FileType = 'png' | 'jpeg' | 'svg'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function serialize(svg: SVGSVGElement) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Enough to cover the PNG chunks that precede the image data. */
const HEADER_BYTES = 64 * 1024

/**
 * Canvas output carries no resolution, so image viewers would open it at 72/96 dpi.
 * Stamping 300 dpi in makes the file open at its real DIN size.
 */
async function withResolution(blob: Blob, type: 'png' | 'jpeg') {
  // Only the header is read and patched; the image data is passed through as a slice.
  const header = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer())
  const view = new DataView(header.buffer)

  if (type === 'jpeg') {
    const isJfif = String.fromCharCode(...header.subarray(6, 11)) === 'JFIF\0'
    if (!isJfif) return blob
    header[13] = 1 // density unit: dots per inch
    view.setUint16(14, EXPORT_DPI)
    view.setUint16(16, EXPORT_DPI)
    return new Blob([header, blob.slice(header.length)], { type: 'image/jpeg' })
  }

  // PNG: insert a pHYs chunk right after IHDR (8 byte signature + 25 byte IHDR chunk),
  // unless the browser already wrote one.
  for (let offset = 8; offset + 8 <= header.length;) {
    const chunkType = String.fromCharCode(...header.subarray(offset + 4, offset + 8))
    if (chunkType === 'pHYs') return blob
    if (chunkType === 'IDAT') break
    offset += 12 + view.getUint32(offset)
  }
  const ihdrEnd = 33
  const chunk = new Uint8Array(21)
  const chunkView = new DataView(chunk.buffer)
  const pixelsPerMeter = Math.round(EXPORT_DPI / 0.0254)
  chunkView.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  chunkView.setUint32(8, pixelsPerMeter)
  chunkView.setUint32(12, pixelsPerMeter)
  chunk[16] = 1 // unit: metre
  chunkView.setUint32(17, crc32(chunk.subarray(4, 17)))
  return new Blob([blob.slice(0, ihdrEnd), chunk, blob.slice(ihdrEnd)], { type: 'image/png' })
}

async function rasterize(svg: SVGSVGElement, format: PaperFormatId, type: 'png' | 'jpeg') {
  const { width, height } = pixelSize(format)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  const url = URL.createObjectURL(new Blob([serialize(svg)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, `image/${type}`, 0.93),
    )
    if (!blob) {
      throw new Error(
        `This browser can't create a ${width} × ${height} px image. Try the SVG download instead.`,
      )
    }
    return withResolution(blob, type)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportPoster(
  svg: SVGSVGElement,
  format: PaperFormatId,
  type: FileType,
  baseName: string,
) {
  const filename = `${baseName}-${format}.${type === 'jpeg' ? 'jpg' : type}`
  if (type === 'svg') {
    const { width, height } = PAPER_FORMATS[format]
    svg.setAttribute('width', `${width}mm`)
    svg.setAttribute('height', `${height}mm`)
    download(new Blob([serialize(svg)], { type: 'image/svg+xml' }), filename)
    return
  }
  download(await rasterize(svg, format, type), filename)
}
