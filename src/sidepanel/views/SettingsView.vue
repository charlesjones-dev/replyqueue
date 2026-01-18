<script setup lang="ts">
import { useSettingsView } from '../composables/useSettingsView'
import ApiKeyInput from '../components/ApiKeyInput.vue'
import ExampleCommentsList from '../components/ExampleCommentsList.vue'
import { RECOMMENDED_MODELS } from '@shared/constants'

const {
  // Form state
  apiKey,
  rssFeedUrl,
  selectedModel,
  threshold,
  maxPosts,
  cacheTtlMinutes,
  exampleComments,
  communicationPreferences,

  // UI state
  isLoading,
  isSaving,
  isTestingApiKey,
  isTestingFeed,
  isClearingCache,
  cacheCleared,
  hasUnsavedChanges,
  showUnsavedWarning,

  // Validation state
  apiKeyError,
  apiKeyValid,
  feedError,
  feedValid,
  feedTitle,
  feedItemCount,
  saveError,

  // Computed
  canSave,
  // maskedApiKey - can be used for display if needed

  // Constants
  cacheTtlOptions,
  maxPostsOptions,

  // Actions
  testApiKey,
  testFeedConnection,
  saveSettings,
  cancelChanges,
  handleBack,
  confirmDiscard,
  cancelDiscard,
  clearCache,
  addExample,
  removeExample,
  updateExample,
} = useSettingsView()
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 bg-opacity-75"
    >
      <div class="flex items-center gap-2">
        <svg class="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span class="text-gray-600">Loading settings...</span>
      </div>
    </div>

    <!-- Unsaved changes warning modal -->
    <div
      v-if="showUnsavedWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="mx-4 max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 class="mb-2 text-lg font-medium text-gray-900">Unsaved Changes</h3>
        <p class="mb-4 text-sm text-gray-600">
          You have unsaved changes. Are you sure you want to leave without saving?
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            @click="cancelDiscard"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            @click="confirmDiscard"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>

    <div class="p-4">
      <div class="mx-auto max-w-md">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-center">
            <button
              type="button"
              class="mr-3 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              @click="handleBack"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 class="text-xl font-bold text-gray-900">Settings</h1>
          </div>
          <span
            v-if="hasUnsavedChanges"
            class="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700"
          >
            Unsaved changes
          </span>
        </div>

        <!-- Settings Form -->
        <div class="space-y-6">
          <!-- API Key Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">API Key</h2>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs text-gray-500">
                  OpenRouter API Key
                </label>
                <ApiKeyInput
                  v-model="apiKey"
                  :disabled="isTestingApiKey"
                  :error="apiKeyError ?? undefined"
                />
                <p v-if="apiKeyValid" class="mt-1 text-xs text-green-600">
                  API key validated successfully
                </p>
                <p v-if="apiKeyError" class="mt-1 text-xs text-red-600">
                  {{ apiKeyError }}
                </p>
              </div>
              <button
                type="button"
                class="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!apiKey || isTestingApiKey"
                @click="testApiKey"
              >
                <span v-if="isTestingApiKey" class="flex items-center justify-center">
                  <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Testing...
                </span>
                <span v-else>Test API Key</span>
              </button>
            </div>
          </section>

          <!-- RSS Feed Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">RSS Feed</h2>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs text-gray-500">
                  Feed URL
                </label>
                <input
                  v-model="rssFeedUrl"
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  :disabled="isTestingFeed"
                  class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  :class="{
                    'border-red-500 focus:border-red-500 focus:ring-red-500': feedError,
                  }"
                />
                <div v-if="feedValid" class="mt-1">
                  <p class="text-xs text-green-600">
                    Feed validated: {{ feedTitle }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ feedItemCount }} items found
                  </p>
                </div>
                <p v-if="feedError" class="mt-1 text-xs text-red-600">
                  {{ feedError }}
                </p>
              </div>
              <button
                type="button"
                class="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!rssFeedUrl || isTestingFeed"
                @click="testFeedConnection"
              >
                <span v-if="isTestingFeed" class="flex items-center justify-center">
                  <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Testing...
                </span>
                <span v-else>Test Connection</span>
              </button>
            </div>
          </section>

          <!-- Model Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">AI Model</h2>
            <div>
              <label class="mb-1 block text-xs text-gray-500">
                Selected Model
              </label>
              <select
                v-model="selectedModel"
                class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option
                  v-for="model in RECOMMENDED_MODELS"
                  :key="model"
                  :value="model"
                >
                  {{ model }}
                </option>
              </select>
              <p class="mt-1 text-xs text-gray-500">
                This model will be used for AI-powered matching and reply generation.
              </p>
            </div>
          </section>

          <!-- Matching Preferences Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">Matching Preferences</h2>
            <div class="space-y-4">
              <!-- Threshold slider -->
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <label class="text-xs text-gray-500">Relevance Threshold</label>
                  <span class="text-xs font-medium text-gray-700">
                    {{ Math.round(threshold * 100) }}%
                  </span>
                </div>
                <input
                  v-model.number="threshold"
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
                />
                <p class="mt-1 text-xs text-gray-500">
                  Posts below this score will be filtered out.
                </p>
              </div>

              <!-- Max posts dropdown -->
              <div>
                <label class="mb-1 block text-xs text-gray-500">
                  Max Posts to Show
                </label>
                <select
                  v-model.number="maxPosts"
                  class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option
                    v-for="option in maxPostsOptions"
                    :key="option"
                    :value="option"
                  >
                    {{ option }} posts
                  </option>
                </select>
              </div>

              <!-- Cache TTL dropdown -->
              <div>
                <label class="mb-1 block text-xs text-gray-500">
                  RSS Cache Duration
                </label>
                <select
                  v-model.number="cacheTtlMinutes"
                  class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option
                    v-for="option in cacheTtlOptions"
                    :key="option"
                    :value="option"
                  >
                    {{ option }} minutes
                  </option>
                </select>
                <p class="mt-1 text-xs text-gray-500">
                  How long to cache the RSS feed before refreshing.
                </p>
              </div>
            </div>
          </section>

          <!-- Writing Style Examples Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <ExampleCommentsList
              :comments="exampleComments"
              @add="addExample"
              @delete="removeExample"
              @update="updateExample"
            />
          </section>

          <!-- Communication Preferences Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">Communication Preferences</h2>
            <div>
              <label class="mb-1 block text-xs text-gray-500">
                Writing Rules for AI-Generated Replies
              </label>
              <textarea
                v-model="communicationPreferences"
                rows="4"
                placeholder="Enter rules for the AI to follow when generating replies...

Example:
- Never use em dashes. Use commas, colons, or periods instead.
- Favor simple, direct sentence structures.
- Keep a professional but friendly tone."
                class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                These rules will be included in the prompt when generating reply suggestions.
              </p>
            </div>
          </section>

          <!-- Cache Management Section -->
          <section class="rounded-lg bg-white p-4 shadow">
            <h2 class="mb-3 text-sm font-medium text-gray-900">Data Management</h2>
            <p class="mb-3 text-xs text-gray-500">
              Clear cached posts, matches, and RSS feed data. Your settings and API key will be preserved.
            </p>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isClearingCache"
              @click="clearCache"
            >
              <svg
                v-if="isClearingCache"
                class="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <svg
                v-else-if="cacheCleared"
                class="h-4 w-4 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span v-if="isClearingCache">Clearing...</span>
              <span v-else-if="cacheCleared">Cache Cleared</span>
              <span v-else>Clear Cache</span>
            </button>
          </section>

          <!-- Error message -->
          <div v-if="saveError" class="rounded-md bg-red-50 p-3">
            <p class="text-sm text-red-600">{{ saveError }}</p>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              :disabled="!hasUnsavedChanges"
              @click="cancelChanges"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canSave || isSaving"
              @click="saveSettings"
            >
              <span v-if="isSaving" class="flex items-center justify-center">
                <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
