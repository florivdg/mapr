<script setup lang="ts">
import { ref, useId } from 'vue'
import { formatCoordinates, parseCoordinates } from '@/lib/geo'
import { reverseGeocode, searchPlaces, type Place } from '@/lib/geocode'

const emit = defineEmits<{ select: [place: Place] }>()

const inputId = useId()
const query = ref('')
const results = ref<Place[]>([])
const message = ref('')
const busy = ref(false)
let controller: AbortController | null = null

function choose(place: Place) {
  clear()
  emit('select', place)
}

async function search() {
  const text = query.value.trim()
  if (!text) return
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  busy.value = true
  message.value = ''
  results.value = []

  try {
    const coordinates = parseCoordinates(text)
    if (coordinates) {
      // Coordinates are used as typed; the lookup only adds a place name for the text.
      const place = await reverseGeocode(coordinates, signal).catch(() => null)
      choose(
        place ?? { ...coordinates, name: formatCoordinates(coordinates), city: '', detail: '' },
      )
      return
    }
    const places = await searchPlaces(text, signal)
    if (places.length === 1) choose(places[0]!)
    else if (places.length) results.value = places
    else
      message.value = `Nothing found for “${text}”. Try a street with its city, or coordinates like 53.1761, 8.7004.`
  } catch (error) {
    if (signal.aborted) return
    console.error(error)
    message.value =
      'Search is unavailable right now. You can still enter coordinates, like 53.1761, 8.7004.'
  } finally {
    if (!signal.aborted) busy.value = false
  }
}

function clear() {
  results.value = []
  message.value = ''
}
</script>

<template>
  <div class="place-search" @keydown.esc="clear">
    <form role="search" @submit.prevent="search">
      <label :for="inputId" class="field-label">Address, place or coordinates</label>
      <div class="search-row">
        <input
          :id="inputId"
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="e.g. Am Wall 1, Bremen"
        />
        <button type="submit" class="button" :disabled="busy || !query.trim()">
          {{ busy ? 'Searching…' : 'Search' }}
        </button>
      </div>
    </form>

    <p v-if="message" class="message" role="status">{{ message }}</p>

    <ul v-if="results.length" class="results" aria-label="Search results">
      <li v-for="place in results" :key="`${place.lat},${place.lon}`">
        <button type="button" @click="choose(place)">
          <span class="result-name">{{ place.name }}</span>
          <span class="result-detail">{{ place.detail }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.search-row input {
  flex: 1;
  min-width: 0;
}

.message {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ink-soft);
}

.results {
  margin: 8px 0 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--field);
}

.results button {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.results button:hover,
.results button:focus-visible {
  background: var(--hover);
}

.result-name {
  font-size: 14px;
  font-weight: 500;
}

.result-detail {
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}
</style>
