<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { OpenRouterModel } from '@shared/types';
import { useModels, getCostTier } from '../composables/useModels';
import { useConfig } from '../composables/useConfig';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { filteredModels, isLoading, error, fetchModels, refreshModels, setSearchQuery, formatPrice } = useModels();

const { config } = useConfig();

const isExpanded = ref(false);
const searchInput = ref('');

// Watch search input and update filter
watch(searchInput, (value) => {
  setSearchQuery(value);
});

// Selected model computed from props or config
const selectedModelId = computed(() => props.modelValue ?? config.value.selectedModel);

// Get selected model details
const selectedModel = computed(() => {
  return filteredModels.value.find((m) => m.id === selectedModelId.value);
});

// Auto-select first model if current selection is invalid (model removed, filtered out, or bad default)
watch(
  [filteredModels, selectedModelId],
  ([models, currentId]) => {
    if (models.length > 0 && currentId && !models.find((m) => m.id === currentId)) {
      emit('update:modelValue', models[0].id);
    }
  },
  { immediate: true }
);

// Cost tier color
function getCostTierColor(tier: '$' | '$$' | '$$$'): string {
  switch (tier) {
    case '$':
      return 'text-green-600 dark:text-green-400';
    case '$$':
      return 'text-yellow-600 dark:text-yellow-400';
    case '$$$':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

// Format context length for display
function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(contextLength % 1_000_000 === 0 ? 0 : 1)}M context`;
  }
  return `${Math.round(contextLength / 1_000)}K context`;
}

// Format release date for display (MM/YYYY)
function formatReleaseDate(created?: number): string {
  if (!created) return '';
  const date = new Date(created * 1000);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${year}`;
}

function selectModel(model: OpenRouterModel) {
  emit('update:modelValue', model.id);
  isExpanded.value = false;
}

async function handleRefresh() {
  await refreshModels();
}

onMounted(() => {
  fetchModels();
});
</script>

<template>
  <div class="relative">
    <!-- Selected model button -->
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2 min-w-0">
        <template v-if="selectedModel">
          <span class="font-medium" :class="getCostTierColor(getCostTier(selectedModel.pricing))">
            {{ getCostTier(selectedModel.pricing) }}
          </span>
          <span class="truncate dark:text-gray-100">{{ selectedModel.name }}</span>
          <span
            v-if="selectedModel.isRecommended"
            class="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300"
          >
            Recommended
          </span>
        </template>
        <template v-else>
          <span class="text-gray-500 dark:text-gray-400">Select a model</span>
        </template>
      </div>
      <svg
        class="h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="isExpanded"
      class="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      <!-- Header with search and controls -->
      <div class="sticky top-0 border-b border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center gap-2">
          <!-- Search input -->
          <div class="relative flex-1">
            <input
              v-model="searchInput"
              type="text"
              placeholder="Search models..."
              class="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
            <svg
              class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <!-- Refresh button -->
          <button
            type="button"
            class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            :disabled="isLoading"
            title="Refresh model list"
            @click="handleRefresh"
          >
            <svg
              class="h-4 w-4"
              :class="{ 'animate-spin': isLoading }"
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

      <!-- Error state -->
      <div v-if="error" class="p-3 text-center text-sm text-red-600 dark:text-red-400">
        {{ error }}
        <button type="button" class="mt-1 text-blue-600 hover:underline dark:text-blue-400" @click="handleRefresh">
          Retry
        </button>
      </div>

      <!-- Loading state -->
      <div v-else-if="isLoading && filteredModels.length === 0" class="p-4 text-center">
        <svg class="mx-auto h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading models...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredModels.length === 0" class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No models found
      </div>

      <!-- Model list -->
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <button
          v-for="model in filteredModels"
          :key="model.id"
          type="button"
          class="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'bg-blue-50 dark:bg-blue-900/30': model.id === selectedModelId,
          }"
          @click="selectModel(model)"
        >
          <!-- Selected checkmark -->
          <div class="mt-0.5 w-4 shrink-0">
            <svg
              v-if="model.id === selectedModelId"
              class="h-4 w-4 text-blue-600 dark:text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <!-- Model info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <!-- Cost tier -->
              <span class="font-medium" :class="getCostTierColor(getCostTier(model.pricing))">
                {{ getCostTier(model.pricing) }}
              </span>

              <!-- Model name -->
              <span class="truncate font-medium text-gray-900 dark:text-gray-100">
                {{ model.name }}
              </span>

              <!-- Recommended badge -->
              <span
                v-if="model.isRecommended"
                class="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300"
              >
                Recommended
              </span>
            </div>

            <!-- Context window, price, and release date -->
            <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ formatContextLength(model.context_length) }}</span>
              <span class="text-gray-300 dark:text-gray-600">|</span>
              <span>{{ formatPrice(model.pricing) }}</span>
              <template v-if="model.created">
                <span class="text-gray-300 dark:text-gray-600">|</span>
                <span>{{ formatReleaseDate(model.created) }}</span>
              </template>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Backdrop to close dropdown -->
    <div v-if="isExpanded" class="fixed inset-0 z-0" @click="isExpanded = false" />
  </div>
</template>
