/** fetch() that treats any non-2xx answer as an error. */
export async function fetchOk(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response
}

/**
 * Caches one promise per key. Failed loads are forgotten so they can be retried,
 * and beyond `limit` entries the least recently used one is dropped.
 */
export function memoizeAsync<K, V>(load: (key: K) => Promise<V>, limit = Infinity) {
  const cache = new Map<K, Promise<V>>()
  return (key: K): Promise<V> => {
    let value = cache.get(key)
    if (value) {
      cache.delete(key)
    } else {
      const pending = load(key)
      pending.catch(() => {
        if (cache.get(key) === pending) cache.delete(key)
      })
      value = pending
    }
    cache.set(key, value)
    if (cache.size > limit) cache.delete(cache.keys().next().value!)
    return value
  }
}
