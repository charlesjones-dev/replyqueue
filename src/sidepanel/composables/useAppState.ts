import { ref } from 'vue';
import type { AppView } from '@shared/types';
import { useConfig } from './useConfig';

const currentView = ref<AppView>('setup');

export function useAppState() {
  const { config } = useConfig();

  /**
   * Check setup status and determine initial view
   * Note: loadConfig() should be called before this to populate the shared config state
   */
  function checkSetupStatus(): void {
    if (config.value.isSetupComplete && config.value.apiKey && config.value.rssFeedUrl) {
      currentView.value = 'main';
    } else {
      currentView.value = 'setup';
    }
  }

  /**
   * Navigate to a specific view
   */
  function navigateTo(view: AppView): void {
    currentView.value = view;
  }

  /**
   * Navigate to main view after setup completion
   */
  function completeSetup(): void {
    currentView.value = 'main';
  }

  /**
   * Navigate to settings view
   */
  function openSettings(): void {
    currentView.value = 'settings';
  }

  /**
   * Navigate back to main view from settings
   */
  function closeSettings(): void {
    currentView.value = 'main';
  }

  /**
   * Navigate to setup view
   */
  function openSetup(): void {
    currentView.value = 'setup';
  }

  return {
    currentView,
    checkSetupStatus,
    navigateTo,
    completeSetup,
    openSettings,
    closeSettings,
    openSetup,
  };
}
