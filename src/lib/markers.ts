export type MarkerId = 'heart' | 'pin' | 'dot' | 'none'

interface MarkerShape {
  label: string
  /** Path in a 24×24 box. */
  d: string
  /** The point that sits exactly on the location. */
  anchor: [number, number]
  /** Size of the drawn shape inside the 24×24 box, used to scale it to the chosen size. */
  extent: number
}

export const MARKERS: Record<Exclude<MarkerId, 'none'>, MarkerShape> = {
  heart: {
    label: 'Heart',
    d: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    anchor: [12, 12.2],
    extent: 20,
  },
  pin: {
    label: 'Pin',
    d: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
    anchor: [12, 22],
    extent: 20,
  },
  dot: {
    label: 'Dot',
    d: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0z',
    anchor: [12, 12],
    extent: 16,
  },
}
