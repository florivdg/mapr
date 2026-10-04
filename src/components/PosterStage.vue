<script setup lang="ts">
import { computed } from 'vue'
import { PAGE, PAPER_FORMATS, type PaperFormatId } from '@/lib/layout'

const props = defineProps<{
  format: PaperFormatId
  loading: boolean
  progress: { loaded: number; total: number }
  error: string | null
}>()

defineEmits<{ retry: [] }>()

const size = computed(() => PAPER_FORMATS[props.format])
const pageRatio = PAGE.width / PAGE.height
</script>

<template>
  <section class="stage" aria-label="Poster preview">
    <div class="sheet" :style="{ '--page-ratio': pageRatio }">
      <slot />
      <span class="crop crop-tl" aria-hidden="true" />
      <span class="crop crop-tr" aria-hidden="true" />
      <span class="crop crop-bl" aria-hidden="true" />
      <span class="crop crop-br" aria-hidden="true" />
      <span class="dimension dimension-width">
        <span>{{ size.width }} mm</span>
      </span>
      <span class="dimension dimension-height">
        <span>{{ size.height }} mm</span>
      </span>
    </div>

    <p v-if="error" class="status status-error" role="alert">
      {{ error }}
      <button type="button" @click="$emit('retry')">Try again</button>
    </p>
    <p v-else-if="loading" class="status" role="status">
      <span class="spinner" aria-hidden="true" />
      <template v-if="progress.total">
        Loading map: {{ progress.loaded }} of {{ progress.total }} tiles
      </template>
      <template v-else>Loading map</template>
    </p>
  </section>
</template>

<style scoped>
.stage {
  --gap: clamp(2.5rem, 7cqmin, 5rem);
  position: relative;
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  container-type: size;
  background-color: var(--mat);
  /* Self-healing cutting mat: centimetre grid with a heavier line every five. */
  background-image:
    linear-gradient(var(--mat-line-strong) 1px, transparent 1px),
    linear-gradient(90deg, var(--mat-line-strong) 1px, transparent 1px),
    linear-gradient(var(--mat-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--mat-line) 1px, transparent 1px);
  background-size:
    150px 150px,
    150px 150px,
    30px 30px,
    30px 30px;
  background-position: center;
}

.sheet {
  position: relative;
  width: min(100cqw - 2 * var(--gap), (100cqh - 2 * var(--gap)) * var(--page-ratio));
  aspect-ratio: var(--page-ratio);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.25),
    0 12px 40px -8px rgb(0 0 0 / 0.45);
}

.crop {
  position: absolute;
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.crop::before,
.crop::after {
  content: '';
  position: absolute;
  background: var(--mat-ink);
}

.crop::before {
  width: 100%;
  height: 1px;
}

.crop::after {
  width: 1px;
  height: 100%;
}

/* Each mark sits 8px outside the sheet edge, pointing along it. */
.crop-tl,
.crop-tr {
  top: -26px;
}
.crop-bl,
.crop-br {
  bottom: -26px;
}
.crop-tl,
.crop-bl {
  left: -26px;
}
.crop-tr,
.crop-br {
  right: -26px;
}
.crop-tl::before,
.crop-tr::before {
  bottom: 8px;
}
.crop-bl::before,
.crop-br::before {
  top: 8px;
}
.crop-tl::after,
.crop-bl::after {
  right: 8px;
}
.crop-tr::after,
.crop-br::after {
  left: 8px;
}

.dimension {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mat-ink);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.dimension > span {
  padding: 0 8px;
  background: var(--mat);
}

.dimension-width {
  left: 0;
  right: 0;
  bottom: -22px;
  height: 9px;
  border: solid var(--mat-ink);
  border-width: 0 1px;
  background: linear-gradient(var(--mat-ink), var(--mat-ink)) center / 100% 1px no-repeat;
}

.dimension-height {
  top: 0;
  bottom: 0;
  right: -22px;
  width: 9px;
  border: solid var(--mat-ink);
  border-width: 1px 0;
  background: linear-gradient(var(--mat-ink), var(--mat-ink)) center / 1px 100% no-repeat;
}

.dimension-height > span {
  transform: rotate(90deg);
  white-space: nowrap;
}

.status {
  position: absolute;
  top: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 14px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--panel);
  color: var(--ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
}

.status-error {
  white-space: normal;
  width: max-content;
  max-width: calc(100% - 32px);
  border-radius: 10px;
}

.status button {
  flex: none;
  padding: 4px 10px;
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: none;
  color: var(--ink);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--rule);
  border-top-color: var(--ink);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}
</style>
