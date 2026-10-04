const EARTH_CIRCUMFERENCE = 40_075_016.686

export interface LatLon {
  lat: number
  lon: number
}

/** Web Mercator, normalized to 0..1 (x grows east, y grows south). */
export function project({ lat, lon }: LatLon) {
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: lon / 360 + 0.5,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  }
}

/** Ground meters covered by one normalized mercator unit at the given latitude. */
export function metersPerUnit(lat: number) {
  return EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)
}

export function formatCoordinates({ lat, lon }: LatLon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`
}

export function formatLocationLine(city: string, position: LatLon) {
  const coords = formatCoordinates(position)
  return city ? `${city}, ${coords}` : coords
}

const COORDINATE_PATTERN =
  /^(-?\d{1,2}(?:[.,]\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([EWO])?$/i

/** Parses "53.1761, 8.7004", "53.1761 8.7004" or "53.1761° N, 8.7004° E". */
export function parseCoordinates(input: string): LatLon | null {
  const match = input.trim().match(COORDINATE_PATTERN)
  if (!match) return null
  const [, latText, ns, lonText, ew] = match
  let lat = Number(latText!.replace(',', '.'))
  let lon = Number(lonText!.replace(',', '.'))
  if (ns?.toUpperCase() === 'S') lat = -Math.abs(lat)
  if (ew?.toUpperCase() === 'W') lon = -Math.abs(lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null
  return { lat, lon }
}
