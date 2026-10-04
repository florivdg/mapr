import { PbfReader } from 'pbf'
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile'
import { memoizeAsync, fetchOk } from './fetch'
import { metersPerUnit, project, type LatLon } from './geo'
import { frameCenter, roundMm as round, type Frame } from './layout'
import { LAYER_STYLES, type LayerKey } from './mapStyle'

/** OpenFreeMap: free OpenStreetMap vector tiles (OpenMapTiles schema), no API key. */
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
const MAX_ZOOM = 14
const MIN_ZOOM = 8
const MAX_TILES = 64
/** Decoded tiles kept in memory; older ones are re-read from the browser's HTTP cache. */
const MAX_CACHED_TILES = 256

/** Geometry outside the frame by more than this (mm) is dropped. */
const CLIP_PADDING = 3
/** Points closer than this (mm) to the previous one are dropped. */
const SIMPLIFY_TOLERANCE = 0.05

export interface MapView {
  center: LatLon
  widthKm: number
  frame: Frame
}

/** Maps normalized mercator coordinates onto the poster (mm). */
export interface Projection {
  cx: number
  cy: number
  mx: number
  my: number
  scale: number
}

export interface MapGeometry {
  projection: Projection
  layers: Record<LayerKey, string>
}

export function projectionFor(view: MapView): Projection {
  const { x, y } = project(view.center)
  const widthUnits = (view.widthKm * 1000) / metersPerUnit(view.center.lat)
  const center = frameCenter(view.frame)
  return {
    cx: center.x,
    cy: center.y,
    mx: x,
    my: y,
    scale: view.frame.w / widthUnits,
  }
}

const loadTileJson = memoizeAsync(
  async (url: string) => (await (await fetchOk(url)).json()) as { tiles: string[] },
)

const loadTile = memoizeAsync(async (key: string): Promise<VectorTile | null> => {
  const [z, x, y] = key.split('/') as [string, string, string]
  const { tiles } = await loadTileJson(TILEJSON_URL)
  const response = await fetch(tiles[0]!.replace('{z}', z).replace('{x}', x).replace('{y}', y))
  if (response.status === 404 || response.status === 204) return null
  if (!response.ok) throw new Error(`Tile ${key} answered ${response.status}`)
  return new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())))
}, MAX_CACHED_TILES)

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

function tileRange(box: Box, projection: Projection, z: number) {
  const n = 2 ** z
  const toTile = (mm: number, center: number, mercator: number) =>
    Math.floor((mercator + (mm - center) / projection.scale) * n)
  return {
    x0: toTile(box.x0, projection.cx, projection.mx),
    x1: toTile(box.x1, projection.cx, projection.mx),
    y0: Math.max(0, toTile(box.y0, projection.cy, projection.my)),
    y1: Math.min(n - 1, toTile(box.y1, projection.cy, projection.my)),
  }
}

/** Tile-local coordinates → poster mm, dropping points that add no visible detail. */
function transformRing(ring: { x: number; y: number }[], ox: number, oy: number, k: number) {
  const out: number[] = []
  const tolerance = SIMPLIFY_TOLERANCE * SIMPLIFY_TOLERANCE
  let lastX = Infinity
  let lastY = Infinity
  for (let i = 0; i < ring.length; i++) {
    const point = ring[i]!
    const x = ox + point.x * k
    const y = oy + point.y * k
    const dx = x - lastX
    const dy = y - lastY
    if (i === ring.length - 1 || dx * dx + dy * dy >= tolerance) {
      out.push(x, y)
      lastX = x
      lastY = y
    }
  }
  return out
}

/** Emits only the runs of a polyline that touch the clip box. */
function emitLine(out: string[], pts: number[], box: Box) {
  let d = ''
  let open = false
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2]!
    const y0 = pts[i - 1]!
    const x1 = pts[i]!
    const y1 = pts[i + 1]!
    const outside =
      (x0 < box.x0 && x1 < box.x0) ||
      (x0 > box.x1 && x1 > box.x1) ||
      (y0 < box.y0 && y1 < box.y0) ||
      (y0 > box.y1 && y1 > box.y1)
    if (outside) {
      open = false
      continue
    }
    if (!open) {
      d += `M${round(x0)} ${round(y0)}`
      open = true
    }
    d += ` ${round(x1)} ${round(y1)}`
  }
  if (d) out.push(d)
}

function emitRing(out: string[], pts: number[], box: Box, minSize: number) {
  if (pts.length < 6) return
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i]!
    const y = pts[i + 1]!
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (maxX < box.x0 || minX > box.x1 || maxY < box.y0 || minY > box.y1) return
  if (maxX - minX < minSize && maxY - minY < minSize) return
  let d = `M${round(pts[0]!)} ${round(pts[1]!)}`
  for (let i = 2; i < pts.length; i += 2) d += ` ${round(pts[i]!)} ${round(pts[i + 1]!)}`
  out.push(d + 'Z')
}

const LINE = 2
const POLYGON = 3

const URBAN_LANDUSE = new Set(['residential', 'commercial', 'industrial', 'retail', 'railway'])
const PARK_GRASS = new Set([
  'park',
  'garden',
  'village_green',
  'recreation_ground',
  'golf_course',
  'allotments',
])

type Classifier = (feature: VectorTileFeature) => LayerKey | null

function roadLayer(feature: VectorTileFeature): LayerKey | null {
  if (feature.type !== LINE || feature.properties.indoor) return null
  const { class: cls, subclass, ramp, brunnel } = feature.properties
  switch (cls) {
    case 'motorway':
    case 'trunk':
      return ramp ? 'tertiary' : cls
    case 'primary':
    case 'secondary':
    case 'tertiary':
      return cls
    case 'minor':
    case 'busway':
      return 'minor'
    case 'service':
      return 'service'
    case 'path':
      return subclass === 'pedestrian' ? 'minor' : 'path'
    case 'track':
      return 'path'
    case 'rail':
    case 'transit':
      return brunnel === 'tunnel' ? null : 'rail'
    default:
      return null
  }
}

const CLASSIFIERS: Record<string, Classifier> = {
  transportation: roadLayer,
  water: (f) =>
    f.type === POLYGON &&
    f.properties.class !== 'swimming_pool' &&
    f.properties.brunnel !== 'tunnel'
      ? 'water'
      : null,
  waterway: (f) => {
    if (f.type !== LINE || f.properties.brunnel === 'tunnel') return null
    const cls = f.properties.class
    if (cls === 'river' || cls === 'canal') return 'waterwayLarge'
    // Drainage ditches criss-cross farmland; they get their own layer so they can be hidden.
    return cls === 'ditch' || cls === 'drain' ? 'ditch' : 'waterwaySmall'
  },
  landuse: (f) => {
    if (f.type !== POLYGON) return null
    const cls = String(f.properties.class)
    if (cls === 'cemetery') return 'green'
    return URBAN_LANDUSE.has(cls) ? 'urban' : null
  },
  landcover: (f) => {
    if (f.type !== POLYGON) return null
    const { class: cls, subclass } = f.properties
    if (cls === 'wood') return 'green'
    return cls === 'grass' && PARK_GRASS.has(String(subclass)) ? 'green' : null
  },
  building: (f) => (f.type === POLYGON ? 'building' : null),
  aeroway: (f) => {
    const cls = f.properties.class
    if (f.type === POLYGON) return cls === 'runway' ? 'runwayArea' : null
    if (f.type === LINE && (cls === 'runway' || cls === 'taxiway')) return cls
    return null
  },
}

/** Smallest polygons (mm) still worth drawing, per layer. */
const MIN_POLYGON_SIZE: Partial<Record<LayerKey, number>> = {
  building: 0.25,
  urban: 0.6,
  green: 0.6,
  water: 0.3,
}

/** Appends one tile's features to the per-layer path data. */
function addTile(
  out: Record<LayerKey, string[]>,
  tile: VectorTile,
  x: number,
  y: number,
  n: number,
  projection: Projection,
  box: Box,
) {
  for (const [name, classify] of Object.entries(CLASSIFIERS)) {
    const layer = tile.layers[name]
    if (!layer) continue
    // Tile-local → mm: x_mm = ox + px * k
    const k = projection.scale / (layer.extent * n)
    const ox = projection.cx + (x / n - projection.mx) * projection.scale
    const oy = projection.cy + (y / n - projection.my) * projection.scale
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i)
      const key = classify(feature)
      if (!key) continue
      const target = out[key]
      for (const ring of feature.loadGeometry()) {
        const pts = transformRing(ring, ox, oy, k)
        if (feature.type === LINE) emitLine(target, pts, box)
        else emitRing(target, pts, box, MIN_POLYGON_SIZE[key] ?? 0)
      }
    }
  }
}

export async function buildMapGeometry(
  view: MapView,
  options: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<MapGeometry> {
  const { signal, onProgress } = options
  const projection = projectionFor(view)
  const { frame } = view
  const box: Box = {
    x0: frame.x - CLIP_PADDING,
    y0: frame.y - CLIP_PADDING,
    x1: frame.x + frame.w + CLIP_PADDING,
    y1: frame.y + frame.h + CLIP_PADDING,
  }

  // Use the most detailed zoom level that keeps the download reasonable.
  let z = MAX_ZOOM
  let range = tileRange(box, projection, z)
  while (z > MIN_ZOOM && (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > MAX_TILES) {
    z--
    range = tileRange(box, projection, z)
  }

  const n = 2 ** z
  const coords: { x: number; y: number }[] = []
  for (let y = range.y0; y <= range.y1; y++) {
    for (let x = range.x0; x <= range.x1; x++) coords.push({ x, y })
  }

  // Each tile is converted as soon as it arrives, spreading the work over the download.
  const out = Object.fromEntries(LAYER_STYLES.map(({ key }) => [key, [] as string[]])) as Record<
    LayerKey,
    string[]
  >
  let loaded = 0
  onProgress?.(0, coords.length)
  await Promise.all(
    coords.map(async ({ x, y }) => {
      const tile = await loadTile(`${z}/${((x % n) + n) % n}/${y}`)
      signal?.throwIfAborted()
      if (tile) addTile(out, tile, x, y, n, projection, box)
      onProgress?.(++loaded, coords.length)
    }),
  )

  const layers = Object.fromEntries(
    Object.entries(out).map(([key, paths]) => [key, paths.join('')]),
  ) as Record<LayerKey, string>
  return { projection, layers }
}
