<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MatchedPostWithScore, ReplySuggestion, PostTone } from '@shared/types';
import PlatformBadge from './PlatformBadge.vue';
import ReplySuggestionComponent from './ReplySuggestion.vue';

// Extended type that includes reply suggestions
interface MatchedPostWithSuggestions extends MatchedPostWithScore {
  replySuggestions?: ReplySuggestion[];
}

const props = defineProps<{
  match: MatchedPostWithSuggestions;
}>();

const emit = defineEmits<{
  (e: 'skip', postId: string, platform: string): void;
  (e: 'replied', postId: string, platform: string): void;
  (e: 'open', postId: string, platform: string): void;
  (e: 'regenerate', postId: string, platform: string): void;
  (e: 'jumpToPost', postId: string, platform: string): void;
}>();

// State for expanded suggestions and content
const showAllSuggestions = ref(false);
const isRegenerating = ref(false);
const isJumping = ref(false);
const isContentExpanded = ref(false);

const scorePercentage = computed(() => Math.round(props.match.score * 100));

const scoreColor = computed(() => {
  if (props.match.score >= 0.7) return 'text-green-600 bg-green-100';
  if (props.match.score >= 0.4) return 'text-yellow-600 bg-yellow-100';
  return 'text-gray-600 bg-gray-100';
});

const statusBadge = computed(() => {
  switch (props.match.status) {
    case 'pending':
      return { text: 'Pending', class: 'bg-gray-100 text-gray-600' };
    case 'replied':
      return { text: 'Replied', class: 'bg-green-100 text-green-600' };
    case 'skipped':
      return { text: 'Skipped', class: 'bg-gray-100 text-gray-400' };
    default:
      return { text: 'Unknown', class: 'bg-gray-100 text-gray-600' };
  }
});

const maxContentLength = 200;

const isTruncatable = computed(() => {
  const content = props.match.post.content || '';
  return content.length > maxContentLength;
});

const displayContent = computed(() => {
  const content = props.match.post.content || '';
  if (!isTruncatable.value || isContentExpanded.value) return content;
  return content.slice(0, maxContentLength) + '...';
});

// Heat check badge configuration
const heatBadgeConfig = computed(() => {
  const heatCheck = props.match.heatCheck;
  if (!heatCheck) return null;

  const configs: Record<PostTone, { label: string; class: string; icon: string }> = {
    positive: {
      label: 'Positive',
      class: 'bg-green-100 text-green-700',
      icon: '✓',
    },
    educational: {
      label: 'Educational',
      class: 'bg-blue-100 text-blue-700',
      icon: '📚',
    },
    question: {
      label: 'Question',
      class: 'bg-purple-100 text-purple-700',
      icon: '?',
    },
    negative: {
      label: 'Negative',
      class: 'bg-red-100 text-red-700',
      icon: '⚠',
    },
    promotional: {
      label: 'Promo',
      class: 'bg-orange-100 text-orange-700',
      icon: '📢',
    },
    neutral: {
      label: 'Neutral',
      class: 'bg-gray-100 text-gray-600',
      icon: '•',
    },
  };

  return configs[heatCheck.tone];
});

const relativeTime = computed(() => {
  const timestamp = props.match.post.extractedAt;
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

function handleSkip() {
  emit('skip', props.match.post.id, props.match.post.platform);
}

function handleReplied() {
  emit('replied', props.match.post.id, props.match.post.platform);
}

function handleOpen() {
  emit('open', props.match.post.id, props.match.post.platform);
}

function handleJumpToPost() {
  isJumping.value = true;
  emit('jumpToPost', props.match.post.id, props.match.post.platform);
  // Reset after a short delay
  setTimeout(() => {
    isJumping.value = false;
  }, 1500);
}

function handleRegenerate() {
  isRegenerating.value = true;
  emit('regenerate', props.match.post.id, props.match.post.platform);
  // Reset after a short delay (the actual regeneration happens async)
  setTimeout(() => {
    isRegenerating.value = false;
  }, 2000);
}

// Computed for suggestions display
const hasSuggestions = computed(() => props.match.replySuggestions && props.match.replySuggestions.length > 0);

const displayedSuggestions = computed(() => {
  if (!props.match.replySuggestions) return [];
  if (showAllSuggestions.value) return props.match.replySuggestions;
  return props.match.replySuggestions.slice(0, 1);
});

const hiddenSuggestionsCount = computed(() => {
  if (!props.match.replySuggestions) return 0;
  return Math.max(0, props.match.replySuggestions.length - 1);
});
</script>

<template>
  <div
    class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    :class="{ 'opacity-60': match.status === 'skipped' }"
  >
    <!-- Header -->
    <div class="mb-3 flex items-start justify-between">
      <div class="flex items-center gap-2">
        <PlatformBadge :platform="match.post.platform" />
        <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusBadge.class">
          {{ statusBadge.text }}
        </span>
        <span
          v-if="match.skippedBeforeAnalysis"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
        >
          Pre-Skipped
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- Heat Check Badge -->
        <span
          v-if="heatBadgeConfig"
          class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          :class="heatBadgeConfig.class"
          :title="match.heatCheck?.reason"
        >
          <span class="text-[10px]">{{ heatBadgeConfig.icon }}</span>
          {{ heatBadgeConfig.label }}
        </span>
        <!-- Relevance Score -->
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="scoreColor"
          :title="`Relevance score: ${scorePercentage}%`"
        >
          {{ scorePercentage }}%
        </span>
      </div>
    </div>

    <!-- Author -->
    <div class="mb-2 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
        {{ match.post.authorName.charAt(0).toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-gray-900">
          {{ match.post.authorName }}
        </p>
        <p v-if="match.post.authorHeadline" class="truncate text-xs text-gray-500">
          {{ match.post.authorHeadline }}
        </p>
      </div>
    </div>

    <!-- Content preview -->
    <div class="mb-3">
      <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ displayContent }}</p>
      <button
        v-if="isTruncatable"
        type="button"
        class="mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
        @click="isContentExpanded = !isContentExpanded"
      >
        {{ isContentExpanded ? 'Show less' : 'View all' }}
      </button>
    </div>

    <!-- Match reason -->
    <p class="mb-3 text-xs text-gray-500 italic">
      {{ match.matchReason }}
    </p>

    <!-- Reply Suggestions Section -->
    <div v-if="hasSuggestions" class="mb-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-gray-700">Reply Suggestions</span>
        <button
          type="button"
          class="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          :disabled="isRegenerating"
          @click="handleRegenerate"
        >
          <svg
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': isRegenerating }"
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
          <span>{{ isRegenerating ? 'Regenerating...' : 'Regenerate' }}</span>
        </button>
      </div>

      <div class="space-y-2">
        <ReplySuggestionComponent
          v-for="(suggestion, index) in displayedSuggestions"
          :key="suggestion.id"
          :suggestion="suggestion"
          :is-first="index === 0"
        />
      </div>

      <!-- Show more/less toggle -->
      <button
        v-if="hiddenSuggestionsCount > 0"
        type="button"
        class="mt-2 text-xs text-blue-600 hover:text-blue-700"
        @click="showAllSuggestions = !showAllSuggestions"
      >
        {{
          showAllSuggestions
            ? 'Show less'
            : `Show ${hiddenSuggestionsCount} more suggestion${hiddenSuggestionsCount > 1 ? 's' : ''}`
        }}
      </button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between border-t border-gray-100 pt-3">
      <span class="text-xs text-gray-400">
        {{ relativeTime }}
      </span>

      <div class="flex gap-2">
        <button
          v-if="match.status === 'pending'"
          type="button"
          class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
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
        <!-- Show "Generate Reply" if pending and no suggestions yet -->
        <button
          v-if="match.status === 'pending' && !hasSuggestions"
          type="button"
          class="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
          :disabled="isRegenerating"
          @click="handleRegenerate"
        >
          <svg v-if="isRegenerating" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {{ isRegenerating ? 'Generating...' : 'Draft Reply' }}
        </button>
        <!-- Show "Replied" if pending and has suggestions -->
        <button
          v-if="match.status === 'pending' && hasSuggestions"
          type="button"
          class="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
          @click="handleReplied"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Replied
        </button>
      </div>
    </div>
  </div>
</template>
