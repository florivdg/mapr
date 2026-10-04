<script setup lang="ts">
import OptionGroup from '@/components/OptionGroup.vue'
import { THEMES, type ThemeId } from '@/lib/mapStyle'
import { toOptions } from '@/lib/options'

const model = defineModel<ThemeId>({ required: true })

const options = toOptions(THEMES)
</script>

<template>
  <OptionGroup v-model="model" label="Map style" :options="options" :columns="4" plain>
    <template #option="{ option, selected }">
      <svg class="swatch" :class="{ selected }" viewBox="0 0 40 56" aria-hidden="true">
        <rect width="40" height="56" :fill="THEMES[option.value].paper" />
        <rect x="18" y="4" width="16" height="14" :fill="THEMES[option.value].urban" />
        <path d="M0 29c9-4 17 3 40-3v6c-21 5-30-2-40 3z" :fill="THEMES[option.value].water" />
        <path
          d="M0 9l40 6M8 0l3 42M0 22l40-4M30 0l-4 42M18 0l3 28M0 37l14-6"
          :stroke="THEMES[option.value].minor"
          stroke-width="0.5"
          fill="none"
        />
        <path
          d="M3 0l16 42M0 13l40 8M27 0l-6 42"
          :stroke="THEMES[option.value].ink"
          stroke-width="1.2"
          fill="none"
        />
        <rect y="42" width="40" height="14" :fill="THEMES[option.value].paper" />
        <circle cx="19.5" cy="17" r="2.4" :fill="THEMES[option.value].marker" />
        <rect x="12" y="46" width="16" height="1.8" rx="0.9" :fill="THEMES[option.value].ink" />
        <rect
          x="15"
          y="50.5"
          width="10"
          height="1"
          rx="0.5"
          :fill="THEMES[option.value].ink"
          opacity="0.6"
        />
      </svg>
      <span class="theme-name" :class="{ selected }">{{ option.label }}</span>
    </template>
  </OptionGroup>
</template>

<style scoped>
.swatch {
  display: block;
  width: 100%;
  max-width: 56px;
  aspect-ratio: 40 / 56;
  margin-bottom: 4px;
  border-radius: 2px;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.12),
    0 2px 6px rgb(24 32 28 / 0.12);
  transition:
    transform 140ms,
    box-shadow 140ms;
}

.option:hover .swatch {
  transform: translateY(-2px);
}

.swatch.selected {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--ink);
}

.theme-name {
  font-size: 12px;
  color: var(--muted);
}

.theme-name.selected {
  color: var(--ink);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .swatch {
    transition: none;
  }
}
</style>
