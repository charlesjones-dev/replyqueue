import { ref, readonly } from 'vue'
import type { ExtensionConfig } from '@shared/types'
import { getConfig, saveConfig, updateConfig } from '@shared/storage'
import { DEFAULT_CONFIG } from '@shared/constants'

const config = ref<ExtensionConfig>({ ...DEFAULT_CONFIG })
const isLoading = ref(false)
const error = ref<string | null>(null)

export function useConfig() {
  /**
   * Load configuration from storage
   */
  async function loadConfig(): Promise<ExtensionConfig> {
    isLoading.value = true
    error.value = null
    try {
      config.value = await getConfig()
      return config.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load config'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save complete configuration
   */
  async function save(newConfig: ExtensionConfig): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await saveConfig(newConfig)
      config.value = newConfig
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save config'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update partial configuration
   */
  async function update(updates: Partial<ExtensionConfig>): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      config.value = await updateConfig(updates)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update config'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update API key
   */
  async function setApiKey(apiKey: string): Promise<void> {
    await update({ apiKey })
  }

  /**
   * Update RSS feed URL
   */
  async function setRssFeedUrl(rssFeedUrl: string): Promise<void> {
    await update({ rssFeedUrl })
  }

  /**
   * Update selected model
   */
  async function setSelectedModel(selectedModel: string): Promise<void> {
    await update({ selectedModel })
  }

  /**
   * Mark setup as complete
   */
  async function markSetupComplete(): Promise<void> {
    await update({ isSetupComplete: true })
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
  }
}
