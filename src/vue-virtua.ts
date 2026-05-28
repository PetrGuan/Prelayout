// virtua integration for Vue.
//
// Returns reactive computeds for cache, widthKey, heights, totalHeight.
//
// Usage:
//
//   <script setup>
//   import { ref } from 'vue'
//   import { VList } from 'virtua/vue'
//   import { usePrelayoutVirtuaCache } from 'prelayout/vue-virtua'
//
//   const items = ref([...])
//   const width = ref(480)
//   const { cache, widthKey } = usePrelayoutVirtuaCache(items, schema, width)
//   </script>
//
//   <template>
//     <!-- static mode -->
//     <VList :cache="cache">...</VList>
//     <!-- reset mode -->
//     <VList :key="widthKey" :cache="cache">...</VList>
//   </template>

import { computed, isRef, type Ref, type ComputedRef } from 'vue'
import type { Schema } from './schema.js'
import { usePrelayout } from './vue.js'
import {
  buildCache,
  buildWidthKey,
  type CacheSnapshot,
} from './cache-utils.js'

export type PrelayoutVueVirtuaCacheResult = {
  cache: ComputedRef<CacheSnapshot>
  widthKey: ComputedRef<string>
  heights: ComputedRef<number[]>
  totalHeight: ComputedRef<number>
}

export function usePrelayoutVirtuaCache(
  items: Ref<Record<string, unknown>[]>,
  schema: Ref<Schema> | Schema,
  containerWidth: Ref<number>,
): PrelayoutVueVirtuaCacheResult {
  const { heights, totalHeight } = usePrelayout(items, schema, containerWidth)

  const cache = computed(() => buildCache(heights.value))

  const widthKey = computed(() => {
    const schemaValue = isRef(schema) ? schema.value : schema
    return buildWidthKey(
      containerWidth.value,
      items.value.length,
      JSON.stringify(schemaValue),
    )
  })

  return { cache, widthKey, heights, totalHeight }
}
