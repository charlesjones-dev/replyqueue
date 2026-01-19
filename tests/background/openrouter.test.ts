import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  calculateBlendedPrice,
  calculateModelAge,
  validateModel,
  getValidRecommendedModels,
} from '@/background/openrouter';
import type { OpenRouterModel } from '@shared/types';

describe('OpenRouter API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateBlendedPrice', () => {
    it('should calculate average of prompt and completion prices', () => {
      const pricing = {
        prompt: '0.001',
        completion: '0.003',
      };

      const result = calculateBlendedPrice(pricing);

      expect(result).toBe(0.002);
    });

    it('should handle zero prices', () => {
      const pricing = {
        prompt: '0',
        completion: '0',
      };

      const result = calculateBlendedPrice(pricing);

      expect(result).toBe(0);
    });

    it('should handle invalid price strings', () => {
      const pricing = {
        prompt: 'invalid',
        completion: '0.001',
      };

      const result = calculateBlendedPrice(pricing);

      // NaN from 'invalid' becomes 0
      expect(result).toBe(0.0005);
    });

    it('should handle very small prices', () => {
      const pricing = {
        prompt: '0.00001',
        completion: '0.00001',
      };

      const result = calculateBlendedPrice(pricing);

      expect(result).toBe(0.00001);
    });
  });

  describe('calculateModelAge', () => {
    it('should calculate age in days from timestamp', () => {
      // 30 days ago in seconds
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

      const result = calculateModelAge(thirtyDaysAgo);

      expect(result).toBe(30);
    });

    it('should return null for undefined timestamp', () => {
      const result = calculateModelAge(undefined);

      expect(result).toBeNull();
    });

    it('should return 0 for very recent timestamps', () => {
      const now = Math.floor(Date.now() / 1000);

      const result = calculateModelAge(now);

      expect(result).toBe(0);
    });
  });

  describe('validateModel', () => {
    const mockModels: OpenRouterModel[] = [
      {
        id: 'anthropic/claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        context_length: 100000,
        pricing: { prompt: '0.001', completion: '0.003' },
        isRecommended: true,
      },
      {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        context_length: 8192,
        pricing: { prompt: '0.03', completion: '0.06' },
        isRecommended: false,
      },
    ];

    it('should return model if it exists', () => {
      const result = validateModel('anthropic/claude-haiku-4.5', mockModels);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('anthropic/claude-haiku-4.5');
    });

    it('should return null if model does not exist', () => {
      const result = validateModel('nonexistent/model', mockModels);

      expect(result).toBeNull();
    });

    it('should return null for empty model list', () => {
      const result = validateModel('anthropic/claude-haiku-4.5', []);

      expect(result).toBeNull();
    });
  });

  describe('getValidRecommendedModels', () => {
    const mockModels: OpenRouterModel[] = [
      {
        id: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        context_length: 100000,
        pricing: { prompt: '0.003', completion: '0.015' },
        isRecommended: true,
      },
      {
        id: 'anthropic/claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        context_length: 100000,
        pricing: { prompt: '0.001', completion: '0.003' },
        isRecommended: true,
      },
      {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        context_length: 8192,
        pricing: { prompt: '0.03', completion: '0.06' },
        isRecommended: false,
      },
    ];

    it('should return only recommended models', () => {
      const result = getValidRecommendedModels(mockModels);

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.isRecommended)).toBe(true);
    });

    it('should return empty array if no recommended models', () => {
      const models = mockModels.map((m) => ({ ...m, isRecommended: false }));

      const result = getValidRecommendedModels(models);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty model list', () => {
      const result = getValidRecommendedModels([]);

      expect(result).toHaveLength(0);
    });
  });
});
