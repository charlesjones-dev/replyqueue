import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConfig,
  saveConfig,
  updateConfig,
  clearAllData,
  getApiKey,
  saveApiKey,
  clearApiKey,
} from '@shared/storage';
import { DEFAULT_CONFIG, STORAGE_KEYS } from '@shared/constants';
import { clearMockStorage, setMockStorage, mockChrome } from '../setup';

describe('storage utilities', () => {
  beforeEach(() => {
    clearMockStorage();
  });

  describe('getConfig', () => {
    it('should return default config when no config exists', async () => {
      const config = await getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should return stored config', async () => {
      const storedConfig = {
        apiKey: '',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: true,
      };
      setMockStorage({ config: storedConfig });
      // API key is stored separately in local storage
      setMockStorage({ [STORAGE_KEYS.API_KEY]: 'test-key' }, 'local');

      const config = await getConfig();
      expect(config.apiKey).toBe('test-key');
      expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
      expect(config.selectedModel).toBe('anthropic/claude-haiku-4.5');
      expect(config.isSetupComplete).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should save config to storage', async () => {
      const newConfig = {
        ...DEFAULT_CONFIG,
        apiKey: 'new-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };

      await saveConfig(newConfig);
      const config = await getConfig();
      expect(config.apiKey).toBe('new-key');
      expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
      expect(config.selectedModel).toBe('anthropic/claude-haiku-4.5');
      expect(config.isSetupComplete).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', async () => {
      const initialConfig = {
        ...DEFAULT_CONFIG,
        apiKey: '',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };
      setMockStorage({ config: initialConfig });
      // API key stored separately in local storage
      setMockStorage({ [STORAGE_KEYS.API_KEY]: 'initial-key' }, 'local');

      const updatedConfig = await updateConfig({ isSetupComplete: true });

      expect(updatedConfig.isSetupComplete).toBe(true);
      expect(updatedConfig.apiKey).toBe('initial-key');
    });

    it('should update multiple fields', async () => {
      const initialConfig = {
        ...DEFAULT_CONFIG,
        apiKey: '',
        rssFeedUrl: '',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };
      setMockStorage({ config: initialConfig });
      // API key stored separately in local storage
      setMockStorage({ [STORAGE_KEYS.API_KEY]: 'initial-key' }, 'local');

      const updatedConfig = await updateConfig({
        rssFeedUrl: 'https://new.com/feed.xml',
        isSetupComplete: true,
      });

      expect(updatedConfig.rssFeedUrl).toBe('https://new.com/feed.xml');
      expect(updatedConfig.isSetupComplete).toBe(true);
      expect(updatedConfig.apiKey).toBe('initial-key');
    });
  });

  describe('clearAllData', () => {
    it('should clear all stored data', async () => {
      setMockStorage({
        config: { apiKey: 'test' },
        matchedPosts: [{ id: '1' }],
      });

      await clearAllData();

      const config = await getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should clear API key from local storage', async () => {
      setMockStorage({ [STORAGE_KEYS.API_KEY]: 'secret-key' }, 'local');

      await clearAllData();

      const apiKey = await getApiKey();
      expect(apiKey).toBe('');
    });
  });

  // ============================================================
  // API Key Storage Security Tests
  // ============================================================

  describe('API key storage security', () => {
    describe('getApiKey', () => {
      it('should return empty string when no API key exists', async () => {
        const apiKey = await getApiKey();
        expect(apiKey).toBe('');
      });

      it('should return API key from local storage', async () => {
        setMockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-or-v1-abc123' }, 'local');

        const apiKey = await getApiKey();
        expect(apiKey).toBe('sk-or-v1-abc123');
      });
    });

    describe('saveApiKey', () => {
      it('should save API key to local storage only', async () => {
        await saveApiKey('sk-or-v1-newkey');

        // Verify it was saved to local storage
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          [STORAGE_KEYS.API_KEY]: 'sk-or-v1-newkey',
        });

        // Verify it was NOT saved to sync storage
        expect(mockChrome.storage.sync.set).not.toHaveBeenCalledWith(
          expect.objectContaining({ [STORAGE_KEYS.API_KEY]: expect.anything() })
        );
      });
    });

    describe('clearApiKey', () => {
      it('should remove API key from local storage', async () => {
        setMockStorage({ [STORAGE_KEYS.API_KEY]: 'secret-key' }, 'local');

        await clearApiKey();

        expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(STORAGE_KEYS.API_KEY);
      });
    });

    describe('config with API key separation', () => {
      it('should store API key in local storage when saving config', async () => {
        const config = {
          ...DEFAULT_CONFIG,
          apiKey: 'sk-or-v1-secret',
          rssFeedUrl: 'https://example.com/feed.xml',
        };

        await saveConfig(config);

        // API key should be in local storage
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          [STORAGE_KEYS.API_KEY]: 'sk-or-v1-secret',
        });

        // Sync storage should have empty API key
        expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
          expect.objectContaining({
            [STORAGE_KEYS.CONFIG]: expect.objectContaining({
              apiKey: '',
              rssFeedUrl: 'https://example.com/feed.xml',
            }),
          })
        );
      });

      it('should merge API key from local storage when getting config', async () => {
        // Set synced config without API key
        setMockStorage(
          {
            [STORAGE_KEYS.CONFIG]: {
              apiKey: '',
              rssFeedUrl: 'https://example.com/feed.xml',
              isSetupComplete: true,
            },
          },
          'sync'
        );
        // Set API key in local storage
        setMockStorage({ [STORAGE_KEYS.API_KEY]: 'sk-or-v1-local' }, 'local');

        const config = await getConfig();

        expect(config.apiKey).toBe('sk-or-v1-local');
        expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
      });

      it('should update API key in local storage when using updateConfig', async () => {
        setMockStorage({ [STORAGE_KEYS.CONFIG]: DEFAULT_CONFIG }, 'sync');

        await updateConfig({ apiKey: 'sk-or-v1-updated' });

        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          [STORAGE_KEYS.API_KEY]: 'sk-or-v1-updated',
        });
      });

      it('should not store API key in sync storage during updateConfig', async () => {
        setMockStorage({ [STORAGE_KEYS.CONFIG]: DEFAULT_CONFIG }, 'sync');

        await updateConfig({ apiKey: 'sk-or-v1-new', isSetupComplete: true });

        // Verify sync storage has empty apiKey
        expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
          expect.objectContaining({
            [STORAGE_KEYS.CONFIG]: expect.objectContaining({
              apiKey: '',
              isSetupComplete: true,
            }),
          })
        );
      });
    });
  });
});
