import { reactive, watch } from 'vue'
import { formatLocationLine } from '@/lib/geo'
import type { FileType } from '@/lib/export'
import type { LayoutId, PaperFormatId } from '@/lib/layout'
import type { ThemeId } from '@/lib/mapStyle'
import type { MarkerId } from '@/lib/markers'
import type { TitleFontId } from '@/lib/text'

export interface PosterState {
  place: { lat: number; lon: number; name: string; city: string }
  widthKm: number
  theme: ThemeId
  lineWeight: number
  buildings: boolean
  paths: boolean
  greens: boolean
  layout: LayoutId
  marker: MarkerId
  /** A colour picked by hand; null follows the style's marker colour. */
  markerColor: string | null
  markerSize: number
  title: string
  titleFont: TitleFontId
  names: string
  location: string
  attribution: boolean
  format: PaperFormatId
  fileType: FileType
}

const STORAGE_KEY = 'mapr:poster'

const START = { lat: 53.1761, lon: 8.7004 }

function defaults(): PosterState {
  return {
    place: { ...START, name: 'Bremen', city: 'Bremen' },
    widthKm: 10,
    theme: 'classic',
    lineWeight: 1,
    buildings: false,
    paths: true,
    greens: true,
    layout: 'bleed',
    marker: 'heart',
    markerColor: null,
    markerSize: 10,
    title: 'Zuhause',
    titleFont: 'script',
    names: 'Anna & Paul',
    location: formatLocationLine('Bremen', START),
    attribution: true,
    format: 'A4',
    fileType: 'png',
  }
}

function restore(): PosterState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PosterState>
    return { ...defaults(), ...saved }
  } catch {
    return defaults()
  }
}

export function usePosterState() {
  const state = reactive(restore())

  // Saving is debounced so slider drags and typing don't write storage on every tick.
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(timer)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  watch(
    state,
    () => {
      clearTimeout(timer)
      timer = setTimeout(save, 500)
    },
    { deep: true },
  )
  addEventListener('pagehide', save)

  function setTheme(theme: ThemeId) {
    state.theme = theme
    state.markerColor = null
  }

  function reset() {
    Object.assign(state, defaults())
  }

  return { state, setTheme, reset }
}
