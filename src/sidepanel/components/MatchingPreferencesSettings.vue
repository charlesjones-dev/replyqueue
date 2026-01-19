<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  threshold: number;
  maxQueueSize: number;
  maxMatchedPosts: number;
  blogContentCharLimit: number;
  postContentCharLimit: number;
  maxMatchedPostsOptions: readonly number[];
  blogContentCharLimitOptions: readonly { value: number; label: string }[];
  postContentCharLimitOptions: readonly { value: number; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:threshold', value: number): void;
  (e: 'update:maxQueueSize', value: number): void;
  (e: 'update:maxMatchedPosts', value: number): void;
  (e: 'update:blogContentCharLimit', value: number): void;
  (e: 'update:postContentCharLimit', value: number): void;
}>();

const isExpanded = ref(false);

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toggle button -->
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      @click="toggleExpanded"
    >
      <span class="flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        Matching Preferences
      </span>
      <svg
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Collapsible content -->
    <div
      v-show="isExpanded"
      class="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
    >
      <!-- Threshold slider -->
      <div>
        <div class="mb-1 flex items-center justify-between">
          <label class="text-xs text-gray-500 dark:text-gray-400">Relevance Threshold</label>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ Math.round(threshold * 100) }}%</span>
        </div>
        <input
          :value="threshold"
          type="range"
          min="0.1"
          max="0.9"
          step="0.1"
          class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-600"
          @input="emit('update:threshold', Number(($event.target as HTMLInputElement).value))"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Posts below this score will be filtered out.</p>
      </div>

      <!-- Max Queue Size input -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Max Queue Size</label>
        <input
          :value="maxQueueSize"
          type="number"
          min="5"
          max="100"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @input="emit('update:maxQueueSize', Number(($event.target as HTMLInputElement).value))"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Maximum posts to queue while browsing. Prevents overload from long browsing sessions.
        </p>
      </div>

      <!-- Max Matched Posts dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Max Matched Posts</label>
        <select
          :value="maxMatchedPosts"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:maxMatchedPosts', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in maxMatchedPostsOptions" :key="option" :value="option">{{ option }} posts</option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Maximum matched posts to keep after AI analysis.</p>
      </div>

      <!-- Blog Content Char Limit dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Blog Content Sent to AI</label>
        <select
          :value="blogContentCharLimit"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:blogContentCharLimit', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in blogContentCharLimitOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Amount of blog content included when matching posts.
        </p>
        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Higher limits provide better context but use more tokens and cost more.
        </p>
      </div>

      <!-- Post Content Char Limit dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Social Post Content Sent to AI</label>
        <select
          :value="postContentCharLimit"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:postContentCharLimit', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in postContentCharLimitOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Amount of social media post content included when evaluating relevance.
        </p>
        <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Higher limits capture more context but use more tokens and cost more.
        </p>
      </div>
    </div>
  </div>
</template>
