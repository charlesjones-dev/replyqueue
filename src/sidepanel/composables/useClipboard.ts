/**
 * Clipboard composable
 * Provides copy-to-clipboard functionality with confirmation feedback
 */

import { ref } from 'vue';

// State for copied confirmation
const copiedId = ref<string | null>(null);
const copyTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null);

// Duration to show "Copied!" confirmation
const COPIED_DISPLAY_DURATION = 2000;

export function useClipboard() {
  /**
   * Copy text to clipboard
   * @param text The text to copy
   * @param id Optional ID to track which item was copied (for UI feedback)
   * @returns Promise that resolves to true if successful, false otherwise
   */
  async function copyToClipboard(text: string, id?: string): Promise<boolean> {
    try {
      // Clear any existing timeout
      if (copyTimeoutId.value) {
        clearTimeout(copyTimeoutId.value);
      }

      // Use the Clipboard API
      await navigator.clipboard.writeText(text);

      // Set copied state for UI feedback
      if (id) {
        copiedId.value = id;

        // Reset after delay
        copyTimeoutId.value = setTimeout(() => {
          copiedId.value = null;
          copyTimeoutId.value = null;
        }, COPIED_DISPLAY_DURATION);
      }

      return true;
    } catch (error) {
      console.error('[useClipboard] Failed to copy to clipboard:', error);

      // Fallback: try using execCommand (for older browsers)
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful && id) {
          copiedId.value = id;

          copyTimeoutId.value = setTimeout(() => {
            copiedId.value = null;
            copyTimeoutId.value = null;
          }, COPIED_DISPLAY_DURATION);
        }

        return successful;
      } catch (fallbackError) {
        console.error('[useClipboard] Fallback copy also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Check if a specific item was just copied
   * @param id The item ID to check
   */
  function wasCopied(id: string): boolean {
    return copiedId.value === id;
  }

  /**
   * Reset the copied state
   */
  function resetCopied(): void {
    if (copyTimeoutId.value) {
      clearTimeout(copyTimeoutId.value);
      copyTimeoutId.value = null;
    }
    copiedId.value = null;
  }

  return {
    copiedId,
    copyToClipboard,
    wasCopied,
    resetCopied,
  };
}
