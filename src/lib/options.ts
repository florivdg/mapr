/** Turns a catalogue keyed by id into the option list a picker shows. */
export function toOptions<K extends string>(catalogue: Record<K, { label: string }>) {
  return (Object.keys(catalogue) as K[]).map((value) => ({
    value,
    label: catalogue[value].label,
  }))
}
