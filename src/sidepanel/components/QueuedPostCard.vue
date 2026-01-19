<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ExtractedPostRecord } from '@shared/types';
import PlatformBadge from './PlatformBadge.vue';

const props = withDefaults(
  defineProps<{
    post: ExtractedPostRecord;
    variant?: 'queued' | 'unmatched';
    selected?: boolean;
    showCheckbox?: boolean;
    isMatching?: boolean;
  }>(),
  {
    variant: 'queued',
    selected: false,
    showCheckbox: false,
    isMatching: false,
  }
);

const statusBadge = computed(() => {
  if (props.variant === 'unmatched') {
    return { text: 'Unmatched', class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' };
  }
  return { text: 'Queued', class: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' };
});

const emit = defineEmits<{
  (e: 'open', postId: string, platform: string): void;
  (e: 'skip', postId: string, platform: string): void;
  (e: 'select', postId: string, platform: string): void;
  (e: 'ai-match', postId: string, platform: string): void;
}>();

const isContentExpanded = ref(false);

const maxContentLength = 200;

const isTruncatable = computed(() => {
  const content = props.post.content || '';
  return content.length > maxContentLength;
});

const displayContent = computed(() => {
  const content = props.post.content || '';
  if (!isTruncatable.value || isContentExpanded.value) return content;
  return content.slice(0, maxContentLength) + '...';
});

const relativeTime = computed(() => {
  const timestamp = props.post.extractedAt;
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
});

function handleOpen() {
  emit('open', props.post.id, props.post.platform);
}

function handleSkip() {
  emit('skip', props.post.id, props.post.platform);
}

function handleSelect() {
  emit('select', props.post.id, props.post.platform);
}

function handleAIMatch() {
  emit('ai-match', props.post.id, props.post.platform);
}
</script>

<template>
  <div
    class="relative rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-gray-800"
    :class="[
      selected
        ? 'border-blue-400 ring-1 ring-blue-400 dark:border-blue-500 dark:ring-blue-500'
        : 'border-gray-200 dark:border-gray-700',
    ]"
  >
    <!-- Checkbox (only on queued tab) -->
    <div v-if="showCheckbox" class="absolute left-4 top-4">
      <input
        type="checkbox"
        :checked="selected"
        class="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
        @change="handleSelect"
      />
    </div>

    <!-- Header -->
    <div class="mb-3 flex items-start justify-between" :class="showCheckbox ? 'ml-6' : ''">
      <div class="flex items-center gap-2">
        <PlatformBadge :platform="post.platform" />
        <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusBadge.class">
          {{ statusBadge.text }}
        </span>
      </div>
      <span class="text-xs text-gray-400 dark:text-gray-500">
        {{ relativeTime }}
      </span>
    </div>

    <!-- Author -->
    <div class="mb-2 flex items-center gap-2">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        {{ post.authorName.charAt(0).toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {{ post.authorName }}
        </p>
        <p v-if="post.authorHeadline" class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ post.authorHeadline }}
        </p>
      </div>
    </div>

    <!-- Content preview -->
    <div class="mb-3">
      <p class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ displayContent }}</p>
      <button
        v-if="isTruncatable"
        type="button"
        class="mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        @click="isContentExpanded = !isContentExpanded"
      >
        {{ isContentExpanded ? 'Show less' : 'View all' }}
      </button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
      <button
        v-if="variant === 'queued'"
        type="button"
        class="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        title="AI Match this post"
        :disabled="isMatching"
        @click="handleAIMatch"
      >
        <span v-if="isMatching" class="flex items-center gap-1">
          <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Matching...
        </span>
        <span v-else>AI Match</span>
      </button>
      <button
        v-if="variant === 'queued'"
        type="button"
        class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        title="Skip this post"
        @click="handleSkip"
      >
        Skip
      </button>
      <button
        type="button"
        class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
        @click="handleOpen"
      >
        View
      </button>
    </div>
  </div>
</template>
