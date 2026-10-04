import { fetchOk } from './fetch'
import type { LatLon } from './geo'

/** Nominatim: OpenStreetMap's geocoder. Its policy allows light use, one request per second. */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

export interface Place extends LatLon {
  name: string
  city: string
  detail: string
}

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  hamlet?: string
  county?: string
  state?: string
}

interface NominatimResult {
  lat: string
  lon: string
  name?: string
  display_name: string
  address?: NominatimAddress
}

function cityOf(address: NominatimAddress | undefined, fallback: string) {
  if (!address) return fallback
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.hamlet ??
    address.county ??
    address.state ??
    fallback
  )
}

function toPlace(result: NominatimResult): Place {
  const [first = '', ...rest] = result.display_name.split(', ')
  const name = result.name || first
  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    name,
    city: cityOf(result.address, name),
    detail: (result.name ? result.display_name.replace(`${result.name}, `, '') : rest.join(', '))
      .split(', ')
      .slice(0, 4)
      .join(', '),
  }
}

async function nominatim<T>(path: string, params: Record<string, string>, signal?: AbortSignal) {
  const query = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': navigator.language,
    ...params,
  })
  const response = await fetchOk(`${NOMINATIM_URL}/${path}?${query}`, { signal })
  return (await response.json()) as T
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const results = await nominatim<NominatimResult[]>('search', { q: query, limit: '8' }, signal)
  // A square, its station and its bus stop often share one label; keep the first of each.
  const seen = new Set<string>()
  return results.map(toPlace).filter((place) => {
    const key = `${place.name}|${place.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function reverseGeocode(
  position: LatLon,
  signal?: AbortSignal,
): Promise<Place | null> {
  const result = await nominatim<NominatimResult & { error?: string }>(
    'reverse',
    { lat: String(position.lat), lon: String(position.lon), zoom: '14' },
    signal,
  )
  if (result.error) return null
  return { ...toPlace(result), ...position }
}
