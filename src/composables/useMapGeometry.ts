import { ref, shallowRef, watch, type Ref } from 'vue'
import { buildMapGeometry, type MapGeometry, type MapView } from '@/lib/tiles'

/** Loads and rebuilds the map whenever the view changes, keeping the last map on screen meanwhile. */
export function useMapGeometry(view: Ref<MapView>) {
  const geometry = shallowRef<MapGeometry | null>(null)
  const loading = ref(false)
  const progress = ref({ loaded: 0, total: 0 })
  const error = ref<string | null>(null)

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  async function load() {
    clearTimeout(timer)
    // A newer view supersedes the running build; it stops at the next tile.
    controller?.abort()
    const { signal } = (controller = new AbortController())
    loading.value = true
    error.value = null
    try {
      const result = await buildMapGeometry(view.value, {
        signal,
        onProgress: (loaded, total) => (progress.value = { loaded, total }),
      })
      signal.throwIfAborted()
      geometry.value = result
    } catch (cause) {
      if (signal.aborted) return
      console.error(cause)
      error.value = "The map couldn't be loaded. Check your connection, then try again."
    }
    loading.value = false
  }

  watch(
    () => JSON.stringify(view.value),
    (_, previous) => {
      // Load the first map right away; debounce while sliders are being dragged.
      if (previous === undefined) return void load()
      clearTimeout(timer)
      loading.value = true
      timer = setTimeout(load, 300)
    },
    { immediate: true },
  )

  return { geometry, loading, progress, error, reload: load }
}
