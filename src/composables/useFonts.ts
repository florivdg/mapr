import { shallowRef } from 'vue'
import { loadFont, type FontId, type FontStack } from '@/lib/text'

const fonts = shallowRef<Partial<Record<FontId, FontStack>>>({})
const pending = new Set<FontId>()

/** Shared, lazily loaded font outlines. Reading a font that is not loaded yet starts loading it. */
export function useFonts() {
  function font(id: FontId): FontStack | undefined {
    const stack = fonts.value[id]
    if (!stack && !pending.has(id)) {
      pending.add(id)
      loadFont(id)
        .then((loaded) => (fonts.value = { ...fonts.value, [id]: loaded }))
        .catch((error: unknown) => console.error(error))
        .finally(() => pending.delete(id))
    }
    return stack
  }

  return { font }
}
