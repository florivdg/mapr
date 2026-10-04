<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import FrameShape from '@/components/FrameShape.vue'
import { useFonts } from '@/composables/useFonts'
import type { PosterState } from '@/composables/usePosterState'
import { PAGE, TEXT_BLOCK } from '@/lib/layout'
import { LAYER_STYLES, LAYER_TOGGLES, lineScale, THEMES, type LayerKey } from '@/lib/mapStyle'
import { MARKERS } from '@/lib/markers'
import {
  ATTRIBUTION_STYLE,
  capHeightRatio,
  LOCATION_STYLE,
  NAMES_STYLE,
  textToPath,
  TITLE_STYLES,
  type TextStyle,
} from '@/lib/text'
import { projectionFor, type MapGeometry, type MapView } from '@/lib/tiles'

const props = defineProps<{
  state: PosterState
  view: MapView
  geometry: MapGeometry | null
}>()

const { font } = useFonts()

const theme = computed(() => THEMES[props.state.theme])
const frame = computed(() => props.view.frame)
const projection = computed(() => projectionFor(props.view))
const viewBox = `0 0 ${PAGE.width} ${PAGE.height}`

/**
 * While a new map is loading, the previous one is moved and scaled to where it
 * belongs in the new view, so zooming and switching layouts respond instantly.
 */
const mapTransform = computed(() => {
  const built = props.geometry?.projection
  if (!built) return { attr: undefined, scale: 1 }
  const now = projection.value
  const scale = now.scale / built.scale
  const tx = now.cx + (built.mx - now.mx) * now.scale
  const ty = now.cy + (built.my - now.my) * now.scale
  if (scale === 1 && tx === built.cx && ty === built.cy) return { attr: undefined, scale: 1 }
  return {
    attr: `translate(${tx} ${ty}) scale(${scale}) translate(${-built.cx} ${-built.cy})`,
    scale,
  }
})

const hiddenLayers = computed(
  () =>
    new Set<LayerKey>(
      (Object.keys(LAYER_TOGGLES) as (keyof typeof LAYER_TOGGLES)[]).flatMap((toggle) =>
        props.state[toggle] ? [] : LAYER_TOGGLES[toggle],
      ),
    ),
)

const layers = computed(() => {
  const geometry = props.geometry
  if (!geometry) return []
  const strokeScale =
    lineScale(props.state.widthKm, props.state.lineWeight) / mapTransform.value.scale
  return LAYER_STYLES.filter((style) => !hiddenLayers.value.has(style.key))
    .map((style) => ({
      key: style.key,
      d: geometry.layers[style.key],
      fill: style.kind === 'fill' ? theme.value[style.color] : 'none',
      stroke: style.kind === 'line' ? theme.value[style.color] : undefined,
      strokeWidth: style.kind === 'line' ? (style.width ?? 0) * strokeScale : undefined,
    }))
    .filter((layer) => layer.d)
})

const marker = computed(() => {
  if (props.state.marker === 'none') return null
  const shape = MARKERS[props.state.marker]
  const scale = props.state.markerSize / shape.extent
  const { cx, cy } = projection.value
  return {
    d: shape.d,
    fill: props.state.markerColor ?? theme.value.marker,
    transform: `translate(${cx} ${cy}) scale(${scale}) translate(${-shape.anchor[0]} ${-shape.anchor[1]})`,
  }
})

const title = computed(() => {
  const style = TITLE_STYLES[props.state.titleFont]
  const stack = font(style.font)
  if (!stack || !props.state.title.trim()) return null
  // Centre the title's capitals between the map and the names line.
  const namesCapTop =
    TEXT_BLOCK.namesBaseline - NAMES_STYLE.size * capHeightRatio(font(NAMES_STYLE.font) ?? [])
  return textToPath(stack, style, props.state.title.trim(), {
    x: TEXT_BLOCK.centerX,
    y: (frame.value.y + frame.value.h + namesCapTop) / 2,
    maxWidth: TEXT_BLOCK.maxWidth,
    capMiddle: true,
  })
})

function bodyLine(text: string, style: TextStyle, baseline: number) {
  const stack = font(style.font)
  if (!stack || !text.trim()) return null
  return textToPath(stack, style, text.trim(), {
    x: TEXT_BLOCK.centerX,
    y: baseline,
    maxWidth: TEXT_BLOCK.maxWidth,
  })
}

const names = computed(() => bodyLine(props.state.names, NAMES_STYLE, TEXT_BLOCK.namesBaseline))
const location = computed(() =>
  bodyLine(props.state.location, LOCATION_STYLE, TEXT_BLOCK.locationBaseline),
)
const attribution = computed(() =>
  props.state.attribution
    ? bodyLine('© OpenStreetMap contributors', ATTRIBUTION_STYLE, TEXT_BLOCK.attributionBaseline)
    : null,
)

const mapSvg = useTemplateRef<SVGSVGElement>('mapSvg')
const overlaySvg = useTemplateRef<SVGSVGElement>('overlaySvg')

/** One standalone SVG of the whole poster, for export. */
function snapshot() {
  const svg = mapSvg.value!.cloneNode(true) as SVGSVGElement
  for (const child of overlaySvg.value!.children) svg.append(child.cloneNode(true))
  for (const attribute of ['class', 'role', 'aria-label']) svg.removeAttribute(attribute)
  return svg
}

defineExpose({ snapshot })
</script>

<template>
  <div class="poster">
    <!-- The map lives in its own SVG so editing text doesn't repaint thousands of streets. -->
    <svg
      ref="mapSvg"
      class="poster-layer poster-map"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="viewBox"
      role="img"
      aria-label="Poster preview"
    >
      <defs>
        <clipPath id="poster-map-clip">
          <FrameShape :frame="frame" />
        </clipPath>
      </defs>
      <rect :width="PAGE.width" :height="PAGE.height" :fill="theme.paper" />
      <g clip-path="url(#poster-map-clip)">
        <g :transform="mapTransform.attr" stroke-linecap="round" stroke-linejoin="round">
          <path
            v-for="layer in layers"
            :key="layer.key"
            :d="layer.d"
            :fill="layer.fill"
            :stroke="layer.stroke"
            :stroke-width="layer.strokeWidth"
          />
        </g>
      </g>
    </svg>
    <svg
      ref="overlaySvg"
      class="poster-layer"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="viewBox"
      aria-hidden="true"
    >
      <path v-if="marker" :d="marker.d" :transform="marker.transform" :fill="marker.fill" />
      <path v-if="title" :d="title" :fill="theme.ink" />
      <path v-if="names" :d="names" :fill="theme.ink" />
      <path v-if="location" :d="location" :fill="theme.ink" />
      <path v-if="attribution" :d="attribution" :fill="theme.muted" />
    </svg>
  </div>
</template>

<style>
.poster {
  position: relative;
  width: 100%;
  height: 100%;
}

.poster-layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.poster-map {
  will-change: transform;
}
</style>
