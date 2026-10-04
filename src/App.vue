<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import FrameShape from '@/components/FrameShape.vue'
import OptionGroup from '@/components/OptionGroup.vue'
import PlaceSearch from '@/components/PlaceSearch.vue'
import PosterStage from '@/components/PosterStage.vue'
import PosterSvg from '@/components/PosterSvg.vue'
import ThemePicker from '@/components/ThemePicker.vue'
import { useFonts } from '@/composables/useFonts'
import { useMapGeometry } from '@/composables/useMapGeometry'
import { usePosterState } from '@/composables/usePosterState'
import { exportPoster, type FileType } from '@/lib/export'
import { formatCoordinates, formatLocationLine } from '@/lib/geo'
import type { Place } from '@/lib/geocode'
import { EXPORT_DPI, LAYOUTS, PAGE, PAPER_FORMATS, pixelSize } from '@/lib/layout'
import { THEMES } from '@/lib/mapStyle'
import { MARKERS, type MarkerId } from '@/lib/markers'
import { toOptions } from '@/lib/options'
import { textToPath, TITLE_STYLES, type TitleFontId } from '@/lib/text'
import type { MapView } from '@/lib/tiles'

const { state, setTheme, reset } = usePosterState()
const { font } = useFonts()

const view = computed<MapView>(() => ({
  center: { lat: state.place.lat, lon: state.place.lon },
  widthKm: state.widthKm,
  frame: LAYOUTS[state.layout].frame,
}))
const { geometry, loading, progress, error, reload } = useMapGeometry(view)

function selectPlace(place: Place) {
  state.place = { lat: place.lat, lon: place.lon, name: place.name, city: place.city }
  state.location = formatLocationLine(place.city, place)
}

const coordinates = computed(() => formatCoordinates(state.place))
const autoLocation = computed(() => formatLocationLine(state.place.city, state.place))

// The area slider is logarithmic: fine steps for a neighbourhood, big ones for a region.
const MIN_KM = 1
const MAX_KM = 40
const areaSlider = computed({
  get: () => Math.round((Math.log(state.widthKm / MIN_KM) / Math.log(MAX_KM / MIN_KM)) * 1000),
  set: (value: number) => {
    state.widthKm = Number((MIN_KM * (MAX_KM / MIN_KM) ** (value / 1000)).toFixed(2))
  },
})
const areaLabel = computed(() =>
  state.widthKm < 10 ? `${state.widthKm.toFixed(1)} km` : `${Math.round(state.widthKm)} km`,
)

const markerOptions: { value: MarkerId; label: string }[] = [
  ...toOptions(MARKERS),
  { value: 'none', label: 'None' },
]
const titleFontOptions = toOptions(TITLE_STYLES)
const layoutOptions = toOptions(LAYOUTS)
const formatOptions = toOptions(PAPER_FORMATS).map((option) => ({
  ...option,
  hint: `${PAPER_FORMATS[option.value].width} × ${PAPER_FORMATS[option.value].height} mm`,
}))

/** Each font option previews the poster title in that typeface. */
const titlePreviews = computed(() => {
  const text = state.title.trim() || 'Zuhause'
  return Object.fromEntries(
    titleFontOptions.map(({ value }) => {
      const style = TITLE_STYLES[value]
      const stack = font(style.font)
      const placement = { x: 50, y: 21, maxWidth: 84, size: style.size * 1.15, capMiddle: true }
      return [value, stack ? textToPath(stack, style, text, placement) : '']
    }),
  ) as Record<TitleFontId, string>
})

const fileOptions: { value: FileType; label: string; hint: string }[] = [
  { value: 'png', label: 'PNG', hint: 'Lossless' },
  { value: 'jpeg', label: 'JPEG', hint: 'Smaller file' },
  { value: 'svg', label: 'SVG', hint: 'Vector' },
]

const fileLabel = computed(() => state.fileType.toUpperCase())
const exportDetail = computed(() => {
  const { width, height } = PAPER_FORMATS[state.format]
  if (state.fileType === 'svg') return `Vector file at ${width} × ${height} mm, sharp at any size`
  const pixels = pixelSize(state.format)
  return `${pixels.width} × ${pixels.height} px at ${EXPORT_DPI} dpi`
})

const poster = useTemplateRef<InstanceType<typeof PosterSvg>>('poster')
const exporting = ref(false)
const exportError = ref<string | null>(null)

const downloadLabel = computed(() => {
  if (exporting.value) return `Preparing ${state.format} ${fileLabel.value}…`
  if (loading.value) return 'Waiting for the map…'
  return `Download ${state.format} ${fileLabel.value}`
})

function fileBaseName() {
  const name = (state.place.city || state.title || 'poster')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `mapr-${name || 'poster'}`
}

async function download() {
  if (!poster.value) return
  exporting.value = true
  exportError.value = null
  // Let the button show its busy state before the main thread is busy rendering.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
  try {
    await exportPoster(poster.value.snapshot(), state.format, state.fileType, fileBaseName())
  } catch (cause) {
    console.error(cause)
    exportError.value =
      cause instanceof Error && cause.message.startsWith('This browser')
        ? cause.message
        : "The file couldn't be created. Try again, or pick a different file type."
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="app">
    <aside class="panel">
      <header class="brand">
        <span class="wordmark">mapr</span>
        <button type="button" class="link" @click="reset">Start over</button>
      </header>

      <div class="controls">
        <section class="group" aria-labelledby="place-heading">
          <h2 id="place-heading">Place</h2>
          <PlaceSearch @select="selectPlace" />
          <p class="current-place">
            <span class="current-name">{{ state.place.name || 'Pinned location' }}</span>
            <span class="current-coords">{{ coordinates }}</span>
          </p>
        </section>

        <section class="group" aria-labelledby="style-heading">
          <h2 id="style-heading">Style</h2>
          <ThemePicker :model-value="state.theme" @update:model-value="setTheme" />
        </section>

        <section class="group" aria-labelledby="map-heading">
          <h2 id="map-heading">Map</h2>
          <label class="field">
            <span class="field-label">
              Area <output>{{ areaLabel }} wide</output>
            </span>
            <input v-model.number="areaSlider" type="range" min="0" max="1000" step="1" />
          </label>
          <label class="field">
            <span class="field-label">
              Line weight <output>{{ state.lineWeight.toFixed(2) }}×</output>
            </span>
            <input v-model.number="state.lineWeight" type="range" min="0.5" max="2" step="0.05" />
          </label>
          <div class="checks">
            <label class="check">
              <input v-model="state.greens" type="checkbox" />
              Parks and forests
            </label>
            <label class="check">
              <input v-model="state.paths" type="checkbox" />
              Footpaths, tracks and ditches
            </label>
            <label class="check">
              <input v-model="state.buildings" type="checkbox" />
              Buildings
            </label>
          </div>
        </section>

        <section class="group" aria-labelledby="marker-heading">
          <h2 id="marker-heading">Marker</h2>
          <OptionGroup v-model="state.marker" label="Marker shape" :options="markerOptions">
            <template #option="{ option }">
              <svg
                v-if="option.value !== 'none'"
                class="marker-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path :d="MARKERS[option.value as Exclude<MarkerId, 'none'>].d" />
              </svg>
              <span class="option-label">{{ option.label }}</span>
            </template>
          </OptionGroup>
          <div v-if="state.marker !== 'none'" class="row">
            <label class="color-field">
              <input
                type="color"
                :value="state.markerColor ?? THEMES[state.theme].marker"
                @input="state.markerColor = ($event.target as HTMLInputElement).value"
              />
              <span>Colour</span>
            </label>
            <label class="field grow">
              <span class="field-label">
                Size <output>{{ state.markerSize }} mm</output>
              </span>
              <input v-model.number="state.markerSize" type="range" min="4" max="20" step="0.5" />
            </label>
          </div>
        </section>

        <section class="group" aria-labelledby="text-heading">
          <h2 id="text-heading">Text</h2>
          <label class="field">
            <span class="field-label">Title</span>
            <input v-model="state.title" type="text" placeholder="Zuhause" />
          </label>
          <OptionGroup v-model="state.titleFont" label="Title typeface" :options="titleFontOptions">
            <template #option="{ option }">
              <svg class="font-preview" viewBox="0 0 100 34" aria-hidden="true">
                <path :d="titlePreviews[option.value]" />
              </svg>
              <span class="option-hint">{{ option.label }}</span>
            </template>
          </OptionGroup>
          <label class="field">
            <span class="field-label">Names</span>
            <input v-model="state.names" type="text" placeholder="Anna & Paul" />
          </label>
          <label class="field">
            <span class="field-label">
              Location line
              <button
                v-if="state.location !== autoLocation"
                type="button"
                class="link"
                @click="state.location = autoLocation"
              >
                Use place and coordinates
              </button>
            </span>
            <input v-model="state.location" type="text" />
          </label>
          <label class="check">
            <input v-model="state.attribution" type="checkbox" />
            Credit OpenStreetMap on the poster
          </label>
        </section>

        <section class="group" aria-labelledby="layout-heading">
          <h2 id="layout-heading">Layout</h2>
          <OptionGroup v-model="state.layout" label="Layout" :options="layoutOptions">
            <template #option="{ option }">
              <svg
                class="layout-icon"
                :viewBox="`0 0 ${PAGE.width} ${PAGE.height}`"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="5"
                  :width="PAGE.width - 10"
                  :height="PAGE.height - 10"
                  class="layout-page"
                />
                <FrameShape :frame="LAYOUTS[option.value].frame" class="layout-map" />
                <rect x="65" y="250" width="80" height="12" class="layout-text" />
              </svg>
              <span class="option-hint">{{ option.label }}</span>
            </template>
          </OptionGroup>
        </section>
      </div>

      <footer class="export" aria-labelledby="export-heading">
        <h2 id="export-heading" class="sr-only">Download</h2>
        <OptionGroup v-model="state.format" label="Paper size" :options="formatOptions" />
        <OptionGroup v-model="state.fileType" label="File type" :options="fileOptions" />
        <button
          type="button"
          class="button primary"
          :disabled="exporting || loading || !geometry"
          @click="download"
        >
          {{ downloadLabel }}
        </button>
        <p class="export-detail">{{ exportDetail }}</p>
        <p v-if="exportError" class="export-error" role="alert">{{ exportError }}</p>
      </footer>
    </aside>

    <main class="workspace">
      <PosterStage
        :format="state.format"
        :loading="loading"
        :progress="progress"
        :error="error"
        @retry="reload"
      >
        <PosterSvg ref="poster" :state="state" :view="view" :geometry="geometry" />
      </PosterStage>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
}

.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--rule);
  background: var(--panel);
}

.brand {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--rule);
}

.wordmark {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.wordmark::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-radius: 50%;
  background: var(--mark);
}

.controls {
  /* Contains the absolutely positioned, visually hidden inputs so they can't grow the page. */
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 24px 24px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 0 22px;
  border-bottom: 1px solid var(--rule);
}

.group:last-child {
  border-bottom: 0;
}

h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.current-place {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding-left: 12px;
  border-left: 2px solid var(--mark);
}

.current-name {
  font-size: 14px;
  font-weight: 500;
}

.current-coords {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.grow {
  flex: 1;
}

.color-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 2px;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
}

.color-field input {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.color-field input::-webkit-color-swatch-wrapper {
  padding: 3px;
}

.color-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 50%;
}

.color-field input::-moz-color-swatch {
  border: 0;
  border-radius: 50%;
}

.marker-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.font-preview {
  width: 100%;
  height: 30px;
  fill: currentColor;
}

.layout-icon {
  width: 24px;
  height: 34px;
  margin-bottom: 2px;
}

.layout-page {
  fill: var(--field);
  stroke: currentColor;
  stroke-width: 8;
}

.layout-map,
.layout-text {
  fill: currentColor;
  opacity: 0.75;
}

.export {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--rule);
  background: var(--panel);
  box-shadow: 0 -8px 20px -14px rgb(24 32 28 / 0.25);
}

.export-detail {
  margin: -2px 0 0;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.export-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--error);
}

.workspace {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 820px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: 72vh auto;
    height: auto;
  }

  .workspace {
    grid-row: 1;
  }

  .panel {
    border-right: 0;
  }

  .controls {
    overflow: visible;
  }

  .export {
    position: sticky;
    bottom: 0;
  }
}
</style>
