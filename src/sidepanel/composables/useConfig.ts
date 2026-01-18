import { ref, readonly } from 'vue';
import type { ExtensionConfig } from '@shared/types';
import { getConfig, saveConfig, updateConfig } from '@shared/storage';
import { DEFAULT_CONFIG } from '@shared/constants';

const config = ref<ExtensionConfig>({ ...DEFAULT_CONFIG });
const isLoading = ref(false);
const error = ref<string | null>(null);

/**
 * Extract origin pattern from URL for permission requests
 */
function getOriginPattern(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}/*`;
}

/**
 * Check if we have permission to access a URL's origin
 */
async function hasHostPermission(url: string): Promise<boolean> {
  try {
    const origin = getOriginPattern(url);
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

/**
 * Request permission to access a URL's origin
 * Must be called from a user gesture context (e.g., click handler)
 */
async function requestHostPermission(url: string): Promise<boolean> {
  try {
    const origin = getOriginPattern(url);

    // Check if we already have permission
    const alreadyHas = await chrome.permissions.contains({ origins: [origin] });
    if (alreadyHas) {
      return true;
    }

    // Request permission - this will show Chrome's permission prompt
    return await chrome.permissions.request({ origins: [origin] });
  } catch (e) {
    console.error('[useConfig] Failed to request permission:', e);
    return false;
  }
}

export function useConfig() {
  /**
   * Load configuration from storage
   */
  async function loadConfig(): Promise<ExtensionConfig> {
    isLoading.value = true;
    error.value = null;
    try {
      config.value = await getConfig();
      return config.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load config';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save complete configuration
   */
  async function save(newConfig: ExtensionConfig): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      await saveConfig(newConfig);
      config.value = newConfig;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save config';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update partial configuration
   */
  async function update(updates: Partial<ExtensionConfig>): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      config.value = await updateConfig(updates);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update config';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update API key
   */
  async function setApiKey(apiKey: string): Promise<void> {
    await update({ apiKey });
  }

  /**
   * Update RSS feed URL
   * Automatically requests host permission if needed
   * @throws Error if permission is denied
   */
  async function setRssFeedUrl(rssFeedUrl: string): Promise<void> {
    if (rssFeedUrl) {
      // Request permission for this URL's origin
      const granted = await requestHostPermission(rssFeedUrl);
      if (!granted) {
        throw new Error('Permission denied: Cannot access RSS feed URL. Please grant permission to fetch the feed.');
      }
    }
    await update({ rssFeedUrl });
  }

  /**
   * Check if we have permission to access the current RSS feed URL
   */
  async function checkRssFeedPermission(): Promise<boolean> {
    if (!config.value.rssFeedUrl) {
      return true; // No URL configured, so no permission needed
    }
    return hasHostPermission(config.value.rssFeedUrl);
  }

  /**
   * Request permission for the current RSS feed URL
   * Must be called from a user gesture context
   */
  async function requestRssFeedPermission(): Promise<boolean> {
    if (!config.value.rssFeedUrl) {
      return true;
    }
    return requestHostPermission(config.value.rssFeedUrl);
  }

  /**
   * Update selected model
   */
  async function setSelectedModel(selectedModel: string): Promise<void> {
    await update({ selectedModel });
  }

  /**
   * Mark setup as complete
   */
  async function markSetupComplete(): Promise<void> {
    await update({ isSetupComplete: true });
  }

  return {
    config: readonly(config),
    isLoading: readonly(isLoading),
    error: readonly(error),
    loadConfig,
    save,
    update,
    setApiKey,
    setRssFeedUrl,
    setSelectedModel,
    markSetupComplete,
    checkRssFeedPermission,
    requestRssFeedPermission,
  };
}
