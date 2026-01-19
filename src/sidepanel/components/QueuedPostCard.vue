<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ExtractedPostRecord } from '@shared/types';
import PlatformBadge from './PlatformBadge.vue';

const props = defineProps<{
  post: ExtractedPostRecord;
}>();

const emit = defineEmits<{
  (e: 'open', postId: string, platform: string): void;
  (e: 'jumpToPost', postId: string, platform: string): void;
  (e: 'skip', postId: string, platform: string): void;
}>();

const isJumping = ref(false);
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

function handleJumpToPost() {
  isJumping.value = true;
  emit('jumpToPost', props.post.id, props.post.platform);
  setTimeout(() => {
    isJumping.value = false;
  }, 1500);
}

function handleSkip() {
  emit('skip', props.post.id, props.post.platform);
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
    <!-- Header -->
    <div class="mb-3 flex items-start justify-between">
      <div class="flex items-center gap-2">
        <PlatformBadge :platform="post.platform" />
        <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600"> Queued </span>
      </div>
      <span class="text-xs text-gray-400">
        {{ relativeTime }}
      </span>
    </div>

    <!-- Author -->
    <div class="mb-2 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
        {{ post.authorName.charAt(0).toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-gray-900">
          {{ post.authorName }}
        </p>
        <p v-if="post.authorHeadline" class="truncate text-xs text-gray-500">
          {{ post.authorHeadline }}
        </p>
      </div>
    </div>

    <!-- Content preview -->
    <div class="mb-3">
      <p class="whitespace-pre-wrap text-sm text-gray-700">{{ displayContent }}</p>
      <button
        v-if="isTruncatable"
        type="button"
        class="mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
        @click="isContentExpanded = !isContentExpanded"
      >
        {{ isContentExpanded ? 'Show less' : 'View all' }}
      </button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
      <button
        type="button"
        class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        title="Skip this post"
        @click="handleSkip"
      >
        Skip
      </button>
      <button
        type="button"
        class="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        :disabled="isJumping"
        title="Scroll to post in feed"
        @click="handleJumpToPost"
      >
        <svg v-if="isJumping" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
        <span>Jump</span>
      </button>
      <button
        type="button"
        class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100"
        @click="handleOpen"
      >
        View
      </button>
    </div>
  </div>
</template>
