import { ref, computed } from 'vue'
import type { ApiKeyValidationResult, RssFeedValidationResult } from '@shared/types'
import { validateApiKeyWithServer, validateRssFeed } from '@shared/validation'
import { useConfig } from './useConfig'
import { useAppState } from './useAppState'

export type SetupStep = 1 | 2

export function useSetup() {
  const { update, markSetupComplete } = useConfig()
  const { completeSetup } = useAppState()

  // Current step in the setup flow
  const currentStep = ref<SetupStep>(1)

  // Form values
  const apiKey = ref('')
  const rssFeedUrl = ref('')

  // Validation states
  const isValidatingApiKey = ref(false)
  const isValidatingFeed = ref(false)
  const apiKeyValidation = ref<ApiKeyValidationResult | null>(null)
  const feedValidation = ref<RssFeedValidationResult | null>(null)

  // Computed states
  const isApiKeyValid = computed(() => apiKeyValidation.value?.valid === true)
  const isFeedValid = computed(() => feedValidation.value?.valid === true)
  const canCompleteSetup = computed(() => isApiKeyValid.value && isFeedValid.value)

  /**
   * Validate the API key with OpenRouter
   */
  async function validateApiKey(): Promise<void> {
    isValidatingApiKey.value = true
    apiKeyValidation.value = null
    try {
      apiKeyValidation.value = await validateApiKeyWithServer(apiKey.value)
      if (apiKeyValidation.value.valid) {
        // Save the API key and move to step 2
        await update({ apiKey: apiKey.value })
        currentStep.value = 2
      }
    } finally {
      isValidatingApiKey.value = false
    }
  }

  /**
   * Validate the RSS feed URL
   */
  async function validateFeedUrl(): Promise<void> {
    isValidatingFeed.value = true
    feedValidation.value = null
    try {
      feedValidation.value = await validateRssFeed(rssFeedUrl.value)
      if (feedValidation.value.valid) {
        // Save the RSS feed URL
        await update({ rssFeedUrl: rssFeedUrl.value })
      }
    } finally {
      isValidatingFeed.value = false
    }
  }

  /**
   * Complete the setup process
   */
  async function finishSetup(): Promise<void> {
    if (!canCompleteSetup.value) return

    await markSetupComplete()
    completeSetup()
  }

  /**
   * Go back to step 1
   */
  function goToStep1(): void {
    currentStep.value = 1
  }

  /**
   * Reset all setup state
   */
  function resetSetup(): void {
    currentStep.value = 1
    apiKey.value = ''
    rssFeedUrl.value = ''
    apiKeyValidation.value = null
    feedValidation.value = null
  }

  return {
    // State
    currentStep,
    apiKey,
    rssFeedUrl,
    isValidatingApiKey,
    isValidatingFeed,
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
  }
}
