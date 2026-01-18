/**
 * Vitest test setup
 */

import { vi } from 'vitest';

// Mock chrome API - separate storage for sync and local
const mockSyncStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};

const mockChrome = {
  storage: {
    sync: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockSyncStorage[keys] });
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = mockSyncStorage[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockSyncStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          delete mockSyncStorage[keys];
        } else {
          for (const key of keys) {
            delete mockSyncStorage[key];
          }
        }
        return Promise.resolve();
      }),
    },
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockLocalStorage[keys] });
        }
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = mockLocalStorage[key];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          delete mockLocalStorage[keys];
        } else {
          for (const key of keys) {
            delete mockLocalStorage[key];
          }
        }
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

// @ts-expect-error - Mocking chrome global
globalThis.chrome = mockChrome;

// Helper to clear mock storage between tests
export function clearMockStorage() {
  for (const key of Object.keys(mockSyncStorage)) {
    delete mockSyncStorage[key];
  }
  for (const key of Object.keys(mockLocalStorage)) {
    delete mockLocalStorage[key];
  }
}

// Helper to set mock storage
export function setMockStorage(data: Record<string, unknown>, storageType: 'sync' | 'local' = 'sync') {
  if (storageType === 'sync') {
    Object.assign(mockSyncStorage, data);
  } else {
    Object.assign(mockLocalStorage, data);
  }
}

// Export mock for assertions
export { mockChrome };
