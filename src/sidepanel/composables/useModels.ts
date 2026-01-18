/**
 * Models composable
 * Manages OpenRouter model fetching, filtering, and caching
 */

import { ref, computed, readonly } from 'vue';
import type { OpenRouterModel, ModelFilterOptions } from '@shared/types';
import { sendMessage } from '@shared/messages';
import {
  RECOMMENDED_MODELS,
  DEFAULT_MAX_MODEL_PRICE,
  DEFAULT_MAX_MODEL_AGE_DAYS,
  COST_TIER_THRESHOLDS,
} from '@shared/constants';

// State
const models = ref<OpenRouterModel[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const lastFetchedAt = ref<number | null>(null);
const fromCache = ref(false);

// Filter state
const filterOptions = ref<ModelFilterOptions>({
  maxPrice: DEFAULT_MAX_MODEL_PRICE,
  maxAgeDays: DEFAULT_MAX_MODEL_AGE_DAYS,
  searchQuery: '',
  showAll: false,
});

/**
 * Calculate blended price (average of prompt and completion)
 */
function calculateBlendedPrice(pricing: { prompt: string; completion: string }): number {
  const promptPrice = parseFloat(pricing.prompt) || 0;
  const completionPrice = parseFloat(pricing.completion) || 0;
  return (promptPrice + completionPrice) / 2;
}

/**
 * Calculate model age in days
 */
function calculateModelAge(created?: number): number | null {
  if (!created) return null;
  const now = Date.now() / 1000; // Convert to seconds
  const ageSeconds = now - created;
  return Math.floor(ageSeconds / (60 * 60 * 24));
}

/**
 * Get cost tier for a model
 */
export function getCostTier(pricing: { prompt: string; completion: string }): '$' | '$$' | '$$$' {
  const blendedPrice = calculateBlendedPrice(pricing);

  if (blendedPrice <= COST_TIER_THRESHOLDS.cheap) return '$';
  if (blendedPrice <= COST_TIER_THRESHOLDS.medium) return '$$';
  return '$$$';
}

export function useModels() {
  // Computed values
  const recommendedModels = computed(() => {
    const recommendedSet = new Set<string>(RECOMMENDED_MODELS);
    return models.value.filter((m) => recommendedSet.has(m.id));
  });

  const filteredModels = computed(() => {
    let result = [...models.value];

    // Apply price filter
    if (filterOptions.value.maxPrice !== undefined) {
      result = result.filter((m) => {
        const blendedPrice = calculateBlendedPrice(m.pricing);
        return blendedPrice <= (filterOptions.value.maxPrice ?? Infinity);
      });
    }

    // Apply age filter
    if (filterOptions.value.maxAgeDays !== undefined) {
      result = result.filter((m) => {
        const age = calculateModelAge(m.created);
        if (age === null) return true; // Include models without age data
        return age <= (filterOptions.value.maxAgeDays ?? Infinity);
      });
    }

    // Apply search filter
    if (filterOptions.value.searchQuery) {
      const query = filterOptions.value.searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.id.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    // Sort: recommended first, then by price
    result.sort((a, b) => {
      // Recommended models first
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;

      // Then by price (cheaper first)
      const priceA = calculateBlendedPrice(a.pricing);
      const priceB = calculateBlendedPrice(b.pricing);
      return priceA - priceB;
    });

    return result;
  });

  const displayModels = computed(() => {
    if (filterOptions.value.showAll) {
      return filteredModels.value;
    }
    return recommendedModels.value;
  });

  const hasRecommendedModels = computed(() => recommendedModels.value.length > 0);

  /**
   * Fetch models from OpenRouter API (via background script)
   */
  async function fetchModels(forceRefresh: boolean = false): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendMessage<{
        models: OpenRouterModel[];
        fromCache: boolean;
      }>({
        type: 'FETCH_MODELS',
        forceRefresh,
      } as never);

      if (!response.success) {
        throw new Error(response.error ?? 'Failed to fetch models');
      }

      if (response.data) {
        models.value = response.data.models;
        fromCache.value = response.data.fromCache;
        lastFetchedAt.value = Date.now();
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch models';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh models (force fetch from API)
   */
  async function refreshModels(): Promise<void> {
    await fetchModels(true);
  }

  /**
   * Update filter options
   */
  function updateFilters(options: Partial<ModelFilterOptions>): void {
    filterOptions.value = { ...filterOptions.value, ...options };
  }

  /**
   * Set search query
   */
  function setSearchQuery(query: string): void {
    filterOptions.value = { ...filterOptions.value, searchQuery: query };
  }

  /**
   * Toggle show all models
   */
  function toggleShowAll(): void {
    filterOptions.value = {
      ...filterOptions.value,
      showAll: !filterOptions.value.showAll,
    };
  }

  /**
   * Get model by ID
   */
  function getModel(modelId: string): OpenRouterModel | undefined {
    return models.value.find((m) => m.id === modelId);
  }

  /**
   * Check if a model ID is valid
   */
  function isValidModel(modelId: string): boolean {
    return models.value.some((m) => m.id === modelId);
  }

  /**
   * Get model display info
   */
  function getModelDisplayInfo(model: OpenRouterModel): {
    costTier: '$' | '$$' | '$$$';
    blendedPrice: number;
    ageDays: number | null;
  } {
    return {
      costTier: getCostTier(model.pricing),
      blendedPrice: calculateBlendedPrice(model.pricing),
      ageDays: calculateModelAge(model.created),
    };
  }

  /**
   * Format price for display
   */
  function formatPrice(pricing: { prompt: string; completion: string }): string {
    const blendedPrice = calculateBlendedPrice(pricing);
    if (blendedPrice < 0.01) {
      return `$${(blendedPrice * 1000).toFixed(3)}/1K`;
    }
    return `$${blendedPrice.toFixed(4)}/1M`;
  }

  return {
    // State
    models: readonly(models),
    isLoading: readonly(isLoading),
    error: readonly(error),
    lastFetchedAt: readonly(lastFetchedAt),
    fromCache: readonly(fromCache),
    filterOptions: readonly(filterOptions),

    // Computed
    recommendedModels,
    filteredModels,
    displayModels,
    hasRecommendedModels,

    // Actions
    fetchModels,
    refreshModels,
    updateFilters,
    setSearchQuery,
    toggleShowAll,
    getModel,
    isValidModel,
    getModelDisplayInfo,
    formatPrice,
    getCostTier,
  };
}
