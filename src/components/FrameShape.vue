<script setup lang="ts">
import { computed } from 'vue'
import { frameCenter, type Frame } from '@/lib/layout'

const props = defineProps<{ frame: Frame }>()

const center = computed(() => frameCenter(props.frame))
</script>

<template>
  <circle v-if="frame.shape === 'circle'" :cx="center.x" :cy="center.y" :r="frame.w / 2" />
  <rect v-else :x="frame.x" :y="frame.y" :width="frame.w" :height="frame.h" />
</template>
