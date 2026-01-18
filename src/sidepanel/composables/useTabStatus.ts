/**
 * Tab status composable
 * Tracks whether the current active tab is on a supported platform
 */

import { ref, readonly, onMounted, onUnmounted } from 'vue';
import { isSupportedPlatform, getPlatformForUrl } from '@/platforms';

const isActiveOnPlatform = ref(false);
const currentPlatform = ref<string | null>(null);
const currentUrl = ref<string | null>(null);

export function useTabStatus() {
  async function updateTabStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? null;
      currentUrl.value = url;

      if (url) {
        isActiveOnPlatform.value = isSupportedPlatform(url);
        const adapter = getPlatformForUrl(url);
        currentPlatform.value = adapter?.platformId ?? null;
      } else {
        isActiveOnPlatform.value = false;
        currentPlatform.value = null;
      }
    } catch (error) {
      console.error('[useTabStatus] Failed to query tab:', error);
      isActiveOnPlatform.value = false;
      currentPlatform.value = null;
      currentUrl.value = null;
    }
  }

  function handleTabActivated() {
    updateTabStatus();
  }

  function handleTabUpdated(_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab) {
    // Only update when URL changes
    if (changeInfo.url) {
      updateTabStatus();
    }
  }

  onMounted(() => {
    // Initial check
    updateTabStatus();

    // Listen for tab changes
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
  });

  onUnmounted(() => {
    chrome.tabs.onActivated.removeListener(handleTabActivated);
    chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  });

  return {
    isActiveOnPlatform: readonly(isActiveOnPlatform),
    currentPlatform: readonly(currentPlatform),
    currentUrl: readonly(currentUrl),
  };
}
