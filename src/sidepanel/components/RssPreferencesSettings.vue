<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  cacheTtlMinutes: number;
  maxRssItems: number;
  maxBlogItemsInPrompt: number;
  cacheTtlOptions: readonly number[];
  maxRssItemsOptions: readonly number[];
  maxBlogItemsInPromptOptions: readonly number[];
}>();

const emit = defineEmits<{
  (e: 'update:cacheTtlMinutes', value: number): void;
  (e: 'update:maxRssItems', value: number): void;
  (e: 'update:maxBlogItemsInPrompt', value: number): void;
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        RSS Preferences
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
      <!-- Cache Duration dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Cache Duration</label>
        <select
          :value="cacheTtlMinutes"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:cacheTtlMinutes', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in cacheTtlOptions" :key="option" :value="option">{{ option }} minutes</option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">How long to cache the RSS feed before refreshing.</p>
      </div>

      <!-- Max RSS Items dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Max RSS Items</label>
        <select
          :value="maxRssItems"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:maxRssItems', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in maxRssItemsOptions" :key="option" :value="option">{{ option }} posts</option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Maximum blog posts to fetch from your RSS feed.</p>
      </div>

      <!-- Max Blog Items in AI Prompts dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Max Blog Items in AI Prompts</label>
        <select
          :value="maxBlogItemsInPrompt"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:maxBlogItemsInPrompt', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in maxBlogItemsInPromptOptions" :key="option" :value="option">
            {{ option }} posts
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Blog posts to include when generating AI matches and reply suggestions.
        </p>
      </div>
    </div>
  </div>
</template>
