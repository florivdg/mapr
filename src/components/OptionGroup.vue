<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

defineProps<{
  label: string
  options: { value: T; label: string; hint?: string }[]
  columns?: number
  /** Drop the boxed tile styling, for options that draw their own (like style swatches). */
  plain?: boolean
}>()

const model = defineModel<T>({ required: true })
const name = useId()

defineSlots<{
  option?(props: { option: { value: T; label: string; hint?: string }; selected: boolean }): unknown
}>()
</script>

<template>
  <fieldset
    class="option-group"
    :class="{ plain }"
    :style="{ '--columns': columns ?? options.length }"
  >
    <legend class="sr-only">{{ label }}</legend>
    <label
      v-for="option in options"
      :key="option.value"
      class="option"
      :class="{ selected: model === option.value }"
    >
      <input v-model="model" class="sr-only" type="radio" :name="name" :value="option.value" />
      <slot name="option" :option="option" :selected="model === option.value">
        <span class="option-label">{{ option.label }}</span>
        <span v-if="option.hint" class="option-hint">{{ option.hint }}</span>
      </slot>
    </label>
  </fieldset>
</template>

<style scoped>
.option-group {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 38px;
  padding: 6px 4px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--field);
  color: var(--ink-soft);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 120ms,
    color 120ms,
    box-shadow 120ms;
}

.option:hover {
  border-color: var(--rule-strong);
  color: var(--ink);
}

.option.selected {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink);
  color: var(--ink);
}

.plain {
  gap: 12px 8px;
}

.plain .option,
.plain .option:hover,
.plain .option.selected {
  min-height: 0;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
}

.option:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
