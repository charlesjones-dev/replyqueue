import { ref } from 'vue'
import type { AppView } from '@shared/types'
import { getConfig } from '@shared/storage'

const currentView = ref<AppView>('setup')

export function useAppState() {
  /**
   * Check setup status and determine initial view
   */
  async function checkSetupStatus(): Promise<void> {
    try {
      const config = await getConfig()
      if (config.isSetupComplete && config.apiKey && config.rssFeedUrl) {
        currentView.value = 'main'
      } else {
        currentView.value = 'setup'
      }
    } catch {
      currentView.value = 'setup'
    }
  }

  /**
   * Navigate to a specific view
   */
  function navigateTo(view: AppView): void {
    currentView.value = view
  }

  /**
   * Navigate to main view after setup completion
   */
  function completeSetup(): void {
    currentView.value = 'main'
  }

  /**
   * Navigate to settings view
   */
  function openSettings(): void {
    currentView.value = 'settings'
  }

  /**
   * Navigate back to main view from settings
   */
  function closeSettings(): void {
    currentView.value = 'main'
  }

  /**
   * Navigate to setup view
   */
  function openSetup(): void {
    currentView.value = 'setup'
  }

  return {
    currentView,
    checkSetupStatus,
    navigateTo,
    completeSetup,
    openSettings,
    closeSettings,
    openSetup,
  }
}
