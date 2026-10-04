export type ThemeId = 'classic' | 'noir' | 'atlas' | 'blueprint' | 'sand' | 'sage' | 'blush'

export interface Theme {
  label: string
  paper: string
  urban: string
  green: string
  building: string
  water: string
  /** Roads, rail and the poster text. */
  ink: string
  /** Side streets and paths. */
  minor: string
  muted: string
  marker: string
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    label: 'Classic',
    paper: '#ffffff',
    urban: '#f0f0f0',
    green: '#f5f5f5',
    building: '#dadada',
    water: '#161616',
    ink: '#161616',
    minor: '#161616',
    muted: '#9a9a9a',
    marker: '#e2131c',
  },
  noir: {
    label: 'Noir',
    paper: '#141414',
    urban: '#1d1d1d',
    green: '#191919',
    building: '#2e2e2e',
    water: '#ececec',
    ink: '#ececec',
    minor: '#ececec',
    muted: '#6e6e6e',
    marker: '#ff3341',
  },
  atlas: {
    label: 'Atlas',
    paper: '#fbfbf9',
    urban: '#f0f0eb',
    green: '#e5ebdf',
    building: '#dddbd3',
    water: '#b7cde0',
    ink: '#22314d',
    minor: '#3a4a67',
    muted: '#8c95a6',
    marker: '#d6293b',
  },
  blueprint: {
    label: 'Blueprint',
    paper: '#1d3c66',
    urban: '#224474',
    green: '#21416e',
    building: '#2c5286',
    water: '#132a4a',
    ink: '#eef3fb',
    minor: '#c3d4ea',
    muted: '#7f98bb',
    marker: '#ffffff',
  },
  sand: {
    label: 'Sand',
    paper: '#f4eee3',
    urban: '#eae0cd',
    green: '#dddec3',
    building: '#d8cab2',
    water: '#86a2ae',
    ink: '#3d2d21',
    minor: '#3d2d21',
    muted: '#9a8875',
    marker: '#b3301f',
  },
  sage: {
    label: 'Sage',
    paper: '#ebf0e8',
    urban: '#dde5d8',
    green: '#cddbc1',
    building: '#c5d1bc',
    water: '#7a9f98',
    ink: '#1b2f24',
    minor: '#1b2f24',
    muted: '#7f9185',
    marker: '#b03d2f',
  },
  blush: {
    label: 'Blush',
    paper: '#faece9',
    urban: '#f1d9d4',
    green: '#ecd8cc',
    building: '#e6c4bd',
    water: '#c6838a',
    ink: '#5a1428',
    minor: '#5a1428',
    muted: '#b3838c',
    marker: '#c40d2b',
  },
}

export type LayerKey =
  | 'urban'
  | 'green'
  | 'water'
  | 'waterwaySmall'
  | 'ditch'
  | 'waterwayLarge'
  | 'building'
  | 'runwayArea'
  | 'taxiway'
  | 'runway'
  | 'path'
  | 'service'
  | 'minor'
  | 'rail'
  | 'tertiary'
  | 'secondary'
  | 'primary'
  | 'trunk'
  | 'motorway'

interface LayerStyle {
  key: LayerKey
  kind: 'fill' | 'line'
  color: Exclude<keyof Theme, 'label'>
  /** Stroke width in mm on the A4 master, before the line weight factor. */
  width?: number
}

/** Draw order, bottom to top. */
export const LAYER_STYLES: LayerStyle[] = [
  { key: 'urban', kind: 'fill', color: 'urban' },
  { key: 'green', kind: 'fill', color: 'green' },
  { key: 'water', kind: 'fill', color: 'water' },
  { key: 'ditch', kind: 'line', color: 'water', width: 0.18 },
  { key: 'waterwaySmall', kind: 'line', color: 'water', width: 0.18 },
  { key: 'waterwayLarge', kind: 'line', color: 'water', width: 0.5 },
  { key: 'building', kind: 'fill', color: 'building' },
  { key: 'runwayArea', kind: 'fill', color: 'ink' },
  { key: 'taxiway', kind: 'line', color: 'ink', width: 0.3 },
  { key: 'runway', kind: 'line', color: 'ink', width: 1.1 },
  { key: 'path', kind: 'line', color: 'minor', width: 0.1 },
  { key: 'service', kind: 'line', color: 'minor', width: 0.15 },
  { key: 'minor', kind: 'line', color: 'minor', width: 0.25 },
  { key: 'rail', kind: 'line', color: 'ink', width: 0.22 },
  { key: 'tertiary', kind: 'line', color: 'ink', width: 0.4 },
  { key: 'secondary', kind: 'line', color: 'ink', width: 0.5 },
  { key: 'primary', kind: 'line', color: 'ink', width: 0.62 },
  { key: 'trunk', kind: 'line', color: 'ink', width: 0.76 },
  { key: 'motorway', kind: 'line', color: 'ink', width: 0.9 },
]

/** Detail switches and the layers each one shows or hides. */
export const LAYER_TOGGLES = {
  greens: ['green'],
  paths: ['path', 'ditch'],
  buildings: ['building'],
} satisfies Record<string, LayerKey[]>

/**
 * Roads get a little bolder when zoomed in and finer when zoomed out, so a city
 * centre and a whole region both read well at the same paper size.
 */
export function lineScale(widthKm: number, weight: number) {
  const zoomFactor = Math.min(1.7, Math.max(0.65, (8 / widthKm) ** 0.35))
  return weight * zoomFactor
}
