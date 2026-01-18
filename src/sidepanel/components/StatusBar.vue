<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  rssFeedConnected: boolean
  rssFeedMessage: string
  extractedPostCount: number
  matchedPostCount: number
  isRefreshing?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const statusColor = computed(() => {
  return props.rssFeedConnected ? 'bg-green-400' : 'bg-yellow-400'
})
</script>

<template>
  <div class="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-xs">
    <!-- RSS Status -->
    <div class="flex items-center gap-2">
      <span class="relative flex h-2 w-2">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          :class="statusColor"
        />
        <span
          class="relative inline-flex h-2 w-2 rounded-full"
          :class="statusColor"
        />
      </span>
      <span class="text-gray-600">{{ rssFeedMessage }}</span>
    </div>

    <!-- Stats -->
    <div class="flex items-center gap-4">
      <span class="text-gray-500" title="Extracted posts">
        <svg class="mr-1 inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {{ extractedPostCount }}
      </span>
      <span class="text-gray-500" title="Matched posts">
        <svg class="mr-1 inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        {{ matchedPostCount }}
      </span>

      <!-- Refresh button -->
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        title="Refresh matches"
        :disabled="isRefreshing"
        @click="emit('refresh')"
      >
        <svg
          class="h-3.5 w-3.5"
          :class="{ 'animate-spin': isRefreshing }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
