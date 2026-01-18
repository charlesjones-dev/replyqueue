import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, saveConfig, updateConfig, clearAllData } from '@shared/storage';
import { DEFAULT_CONFIG } from '@shared/constants';
import { clearMockStorage, setMockStorage } from '../setup';

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
        apiKey: 'test-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: true,
      };
      setMockStorage({ config: storedConfig });

      const config = await getConfig();
      expect(config).toEqual(storedConfig);
    });
  });

  describe('saveConfig', () => {
    it('should save config to storage', async () => {
      const newConfig = {
        apiKey: 'new-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };

      await saveConfig(newConfig);
      const config = await getConfig();
      expect(config).toEqual(newConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', async () => {
      const initialConfig = {
        apiKey: 'initial-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };
      setMockStorage({ config: initialConfig });

      const updatedConfig = await updateConfig({ isSetupComplete: true });

      expect(updatedConfig.isSetupComplete).toBe(true);
      expect(updatedConfig.apiKey).toBe('initial-key');
    });

    it('should update multiple fields', async () => {
      const initialConfig = {
        apiKey: 'initial-key',
        rssFeedUrl: '',
        selectedModel: 'anthropic/claude-haiku-4.5',
        isSetupComplete: false,
      };
      setMockStorage({ config: initialConfig });

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
  });
});
