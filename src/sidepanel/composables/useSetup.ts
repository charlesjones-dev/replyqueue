import { ref, computed } from 'vue';
import type { ApiKeyValidationResult, RssFeedValidationResult } from '@shared/types';
import { validateApiKeyWithServer, validateRssFeed, validateRssUrlFormat } from '@shared/validation';
import { useConfig } from './useConfig';
import { useAppState } from './useAppState';

/**
 * Extract origin pattern from URL for permission requests
 */
function getOriginPattern(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}/*`;
}

export type SetupStep = 1 | 2;

export function useSetup() {
  const { update, markSetupComplete, resetAllConfig } = useConfig();
  const { completeSetup } = useAppState();

  // Current step in the setup flow
  const currentStep = ref<SetupStep>(1);

  // Form values
  const apiKey = ref('');
  const rssFeedUrl = ref('');

  // Validation states
  const isValidatingApiKey = ref(false);
  const isValidatingFeed = ref(false);
  const isResetting = ref(false);
  const apiKeyValidation = ref<ApiKeyValidationResult | null>(null);
  const feedValidation = ref<RssFeedValidationResult | null>(null);

  // Computed states
  const isApiKeyValid = computed(() => apiKeyValidation.value?.valid === true);
  const isFeedValid = computed(() => feedValidation.value?.valid === true);
  const canCompleteSetup = computed(() => isApiKeyValid.value && isFeedValid.value);

  /**
   * Validate the API key with OpenRouter
   */
  async function validateApiKey(): Promise<void> {
    isValidatingApiKey.value = true;
    apiKeyValidation.value = null;
    try {
      apiKeyValidation.value = await validateApiKeyWithServer(apiKey.value);
      if (apiKeyValidation.value.valid) {
        // Save the API key and move to step 2
        await update({ apiKey: apiKey.value });
        currentStep.value = 2;
      }
    } finally {
      isValidatingApiKey.value = false;
    }
  }

  /**
   * Validate the RSS feed URL
   * Requests host permission if needed (must be called from user gesture context)
   */
  async function validateFeedUrl(): Promise<void> {
    isValidatingFeed.value = true;
    feedValidation.value = null;
    try {
      // First check URL format locally
      const formatResult = validateRssUrlFormat(rssFeedUrl.value);
      if (!formatResult.valid) {
        feedValidation.value = formatResult;
        return;
      }

      // Request permission for this URL's origin (this is a user gesture context)
      const origin = getOriginPattern(rssFeedUrl.value.trim());
      const hasPermission = await chrome.permissions.contains({ origins: [origin] });

      if (!hasPermission) {
        // Request permission - this will show Chrome's permission prompt
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          feedValidation.value = {
            valid: false,
            error: 'Permission denied: Cannot access RSS feed URL. Please grant permission to fetch the feed.',
          };
          return;
        }
      }

      // Now validate the feed
      feedValidation.value = await validateRssFeed(rssFeedUrl.value);
      if (feedValidation.value.valid) {
        // Save the RSS feed URL
        await update({ rssFeedUrl: rssFeedUrl.value });
      }
    } finally {
      isValidatingFeed.value = false;
    }
  }

  /**
   * Complete the setup process
   */
  async function finishSetup(): Promise<void> {
    if (!canCompleteSetup.value) return;

    await markSetupComplete();
    completeSetup();
  }

  /**
   * Go back to step 1
   */
  function goToStep1(): void {
    currentStep.value = 1;
  }

  /**
   * Reset all setup state
   */
  function resetSetup(): void {
    currentStep.value = 1;
    apiKey.value = '';
    rssFeedUrl.value = '';
    apiKeyValidation.value = null;
    feedValidation.value = null;
  }

  /**
   * Reset extension to initial state and clear all config
   * Shows confirmation dialog before proceeding
   */
  async function resetAndClearConfig(): Promise<boolean> {
    const confirmed = window.confirm(
      'Are you sure you want to reset? This will clear your API key, RSS feed URL, and all cached data.'
    );
    if (!confirmed) return false;

    isResetting.value = true;
    try {
      await resetAllConfig();
      resetSetup();
      return true;
    } finally {
      isResetting.value = false;
    }
  }

  return {
    // State
    currentStep,
    apiKey,
    rssFeedUrl,
    isValidatingApiKey,
    isValidatingFeed,
    isResetting,
    apiKeyValidation,
    feedValidation,

    // Computed
    isApiKeyValid,
    isFeedValid,
    canCompleteSetup,

    // Actions
    validateApiKey,
    validateFeedUrl,
    finishSetup,
    goToStep1,
    resetSetup,
    resetAndClearConfig,
  };
}
