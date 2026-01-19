/**
 * Models composable
 * Manages OpenRouter model fetching, filtering, and caching
 */

import { ref, computed, readonly } from 'vue';
import type { OpenRouterModel, ModelFilterOptions } from '@shared/types';
import { sendMessage } from '@shared/messages';
import { getConfig } from '@shared/storage';
import {
  RECOMMENDED_MODELS,
  DEFAULT_MAX_MODEL_PRICE,
  DEFAULT_MAX_MODEL_AGE_DAYS,
  DEFAULT_MIN_CONTEXT_LENGTH,
  DEFAULT_ALLOWED_VENDORS,
  DEFAULT_MODEL_NAME_EXCLUSIONS,
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
  minContextLength: DEFAULT_MIN_CONTEXT_LENGTH,
  allowedVendors: [...DEFAULT_ALLOWED_VENDORS],
  nameExclusions: [...DEFAULT_MODEL_NAME_EXCLUSIONS],
  searchQuery: '',
});

/**
 * Calculate blended price per 1M tokens (weighted: 75% input, 25% output)
 * OpenRouter returns prices per token, so we multiply by 1M
 */
function calculateBlendedPrice(pricing: { prompt: string; completion: string }): number {
  const inputPricePerToken = parseFloat(pricing.prompt) || 0;
  const outputPricePerToken = parseFloat(pricing.completion) || 0;
  // Convert to per 1M tokens and apply 3:1 weighting (input:output)
  const inputPer1M = inputPricePerToken * 1_000_000;
  const outputPer1M = outputPricePerToken * 1_000_000;
  return (3 * inputPer1M + outputPer1M) / 4;
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

/**
 * Format vendor ID into a display label
 */
function formatVendorLabel(vendor: string): string {
  // Known vendor name mappings
  const knownVendors: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    'x-ai': 'xAI',
    'meta-llama': 'Meta (Llama)',
    mistralai: 'Mistral',
    cohere: 'Cohere',
    deepseek: 'DeepSeek',
    perplexity: 'Perplexity',
    ai21: 'AI21',
  };

  if (knownVendors[vendor]) {
    return knownVendors[vendor];
  }

  // Fallback: capitalize first letter of each word
  return vendor
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function useModels() {
  // Computed values
  const recommendedModels = computed(() => {
    const recommendedSet = new Set<string>(RECOMMENDED_MODELS);
    const filtered = models.value.filter((m) => recommendedSet.has(m.id));
    // Sort by RECOMMENDED_MODELS order
    const orderMap = new Map<string, number>(RECOMMENDED_MODELS.map((id, idx) => [id, idx]));
    return filtered.sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  });

  const filteredModels = computed(() => {
    let result = [...models.value];

    // Apply vendor filter
    if (filterOptions.value.allowedVendors?.length) {
      const vendors = filterOptions.value.allowedVendors;
      result = result.filter((m) => vendors.some((v) => m.id.startsWith(`${v}/`)));
    }

    // Apply context length filter
    if (filterOptions.value.minContextLength !== undefined) {
      result = result.filter((m) => m.context_length >= (filterOptions.value.minContextLength ?? 0));
    }

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

    // Apply name exclusions filter
    if (filterOptions.value.nameExclusions?.length) {
      const exclusions = filterOptions.value.nameExclusions.map((e) => e.toLowerCase());
      result = result.filter((m) => {
        const nameLower = m.name.toLowerCase();
        const idLower = m.id.toLowerCase();
        return !exclusions.some((ex) => nameLower.includes(ex) || idLower.includes(ex));
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

    // Sort: recommended first (in RECOMMENDED_MODELS order), then by release date (newest first)
    const recommendedOrder = new Map<string, number>(RECOMMENDED_MODELS.map((id, idx) => [id, idx]));
    result.sort((a, b) => {
      // Recommended models first, preserving RECOMMENDED_MODELS order
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      if (a.isRecommended && b.isRecommended) {
        const orderA = recommendedOrder.get(a.id) ?? Infinity;
        const orderB = recommendedOrder.get(b.id) ?? Infinity;
        return orderA - orderB;
      }

      // Non-recommended: sort by release date (newest first)
      const createdA = a.created ?? 0;
      const createdB = b.created ?? 0;
      return createdB - createdA;
    });

    return result;
  });

  const hasRecommendedModels = computed(() => recommendedModels.value.length > 0);

  /**
   * Extract unique vendors from fetched models
   * Returns array of { value, label } for UI display
   */
  const availableVendors = computed(() => {
    const vendorSet = new Set<string>();
    for (const model of models.value) {
      const vendor = model.id.split('/')[0];
      if (vendor) {
        vendorSet.add(vendor);
      }
    }

    // Sort alphabetically and format for UI
    return Array.from(vendorSet)
      .sort((a, b) => a.localeCompare(b))
      .map((vendor) => ({
        value: vendor,
        label: formatVendorLabel(vendor),
      }));
  });

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
   * Format price for display (blended price per 1M tokens)
   */
  function formatPrice(pricing: { prompt: string; completion: string }): string {
    const blendedPrice = calculateBlendedPrice(pricing);
    return `$${blendedPrice.toFixed(2)}/1M`;
  }

  /**
   * Sync filter options from saved config preferences
   */
  async function syncFiltersFromConfig(): Promise<void> {
    const config = await getConfig();
    const saved = config.modelFilterPreferences ?? {};
    filterOptions.value = {
      ...filterOptions.value,
      maxPrice: saved.maxPrice ?? DEFAULT_MAX_MODEL_PRICE,
      maxAgeDays: saved.maxAgeDays ?? DEFAULT_MAX_MODEL_AGE_DAYS,
      minContextLength: saved.minContextLength ?? DEFAULT_MIN_CONTEXT_LENGTH,
      allowedVendors: saved.allowedVendors ?? [...DEFAULT_ALLOWED_VENDORS],
      nameExclusions: saved.nameExclusions ?? [...DEFAULT_MODEL_NAME_EXCLUSIONS],
    };
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
    hasRecommendedModels,
    availableVendors,

    // Actions
    fetchModels,
    refreshModels,
    updateFilters,
    setSearchQuery,
    getModel,
    isValidModel,
    getModelDisplayInfo,
    formatPrice,
    getCostTier,
    syncFiltersFromConfig,
  };
}
