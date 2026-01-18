<script setup lang="ts">
import { computed } from 'vue'
import type { ReplySuggestion } from '@shared/types'
import { useClipboard } from '../composables/useClipboard'

const props = defineProps<{
  suggestion: ReplySuggestion
  isFirst?: boolean
}>()

const emit = defineEmits<{
  (e: 'copied', id: string): void
}>()

const { copyToClipboard, wasCopied } = useClipboard()

const isCopied = computed(() => wasCopied(props.suggestion.id))

async function handleCopy() {
  const success = await copyToClipboard(props.suggestion.text, props.suggestion.id)
  if (success) {
    emit('copied', props.suggestion.id)
  }
}
</script>

<template>
  <div
    class="group rounded-md border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-gray-300"
  >
    <!-- Suggestion text -->
    <p class="text-sm text-gray-700 whitespace-pre-wrap">
      {{ suggestion.text }}
    </p>

    <!-- Actions -->
    <div class="mt-2 flex items-center justify-end gap-2">
      <button
        type="button"
        class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
        :class="
          isCopied
            ? 'bg-green-100 text-green-700'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        "
        @click="handleCopy"
      >
        <template v-if="isCopied">
          <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          <span>Copied!</span>
        </template>
        <template v-else>
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span>Copy</span>
        </template>
      </button>
    </div>
  </div>
</template>
