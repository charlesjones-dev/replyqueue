/**
 * Credits modal composable
 * Manages the state for the insufficient OpenRouter credits modal
 */

import { ref, readonly } from 'vue';

export interface CreditsModalState {
  isOpen: boolean;
  requestedTokens?: number;
  availableTokens?: number;
}

// Shared state across all components
const state = ref<CreditsModalState>({
  isOpen: false,
});

export function useCreditsModal() {
  /**
   * Show the insufficient credits modal
   */
  function show(requestedTokens?: number, availableTokens?: number): void {
    state.value = {
      isOpen: true,
      requestedTokens,
      availableTokens,
    };
  }

  /**
   * Hide the modal
   */
  function hide(): void {
    state.value = {
      isOpen: false,
    };
  }

  /**
   * Open OpenRouter credits page
   */
  function openCreditsPage(): void {
    window.open('https://openrouter.ai/settings/credits', '_blank');
  }

  return {
    state: readonly(state),
    show,
    hide,
    openCreditsPage,
  };
}
