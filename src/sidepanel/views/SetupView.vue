<script setup lang="ts">
import { useSetup } from '../composables/useSetup';
import ApiKeyInput from '../components/ApiKeyInput.vue';

const {
  currentStep,
  apiKey,
  rssFeedUrl,
  isValidatingApiKey,
  isValidatingFeed,
  apiKeyValidation,
  feedValidation,
  canCompleteSetup,
  validateApiKey,
  validateFeedUrl,
  finishSetup,
  goToStep1,
} = useSetup();
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="mx-auto max-w-md">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">ReplyQueue</h1>
        <p class="mt-2 text-sm text-gray-600">Set up your extension to start monitoring posts</p>
      </div>

      <!-- Progress indicator -->
      <div class="mb-8">
        <div class="flex items-center justify-center space-x-4">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
            :class="currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'"
          >
            1
          </div>
          <div class="h-1 w-16" :class="currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'" />
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
            :class="currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'"
          >
            2
          </div>
        </div>
        <div class="mt-2 flex justify-between text-xs text-gray-500">
          <span class="w-24 text-center">API Key</span>
          <span class="w-24 text-center">RSS Feed</span>
        </div>
      </div>

      <!-- Step 1: API Key -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700"> OpenRouter API Key </label>
          <p class="mt-1 text-xs text-gray-500">
            Get your API key from
            <a href="https://openrouter.ai/keys" target="_blank" class="text-blue-600 hover:underline"
              >openrouter.ai/keys</a
            >
          </p>
          <div class="mt-2">
            <ApiKeyInput v-model="apiKey" :disabled="isValidatingApiKey" :error="apiKeyValidation?.error" />
          </div>
          <p v-if="apiKeyValidation?.error" class="mt-1 text-sm text-red-600">
            {{ apiKeyValidation.error }}
          </p>
          <p v-if="apiKeyValidation?.valid" class="mt-1 text-sm text-green-600">API key validated successfully</p>
        </div>

        <button
          type="button"
          class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!apiKey || isValidatingApiKey"
          @click="validateApiKey"
        >
          <span v-if="isValidatingApiKey" class="flex items-center justify-center">
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Validating...
          </span>
          <span v-else>Validate Key</span>
        </button>
      </div>

      <!-- Step 2: RSS Feed -->
      <div v-if="currentStep === 2" class="space-y-4">
        <div class="flex items-center justify-between">
          <button type="button" class="text-sm text-blue-600 hover:underline" @click="goToStep1">
            Back to API Key
          </button>
          <span class="text-sm text-green-600">API Key verified</span>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700"> RSS Feed URL </label>
          <p class="mt-1 text-xs text-gray-500">Enter the RSS feed URL to monitor for new posts</p>
          <div class="mt-2">
            <input
              v-model="rssFeedUrl"
              type="url"
              placeholder="https://example.com/feed.xml"
              :disabled="isValidatingFeed"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              :class="{
                'border-red-500 focus:border-red-500 focus:ring-red-500': feedValidation?.error,
              }"
            />
          </div>
          <p v-if="feedValidation?.error" class="mt-1 text-sm text-red-600">
            {{ feedValidation.error }}
          </p>
          <div v-if="feedValidation?.valid" class="mt-1 text-sm text-green-600">
            <p>Feed validated: {{ feedValidation.feedTitle }}</p>
            <p class="text-xs text-gray-500">{{ feedValidation.itemCount }} items found</p>
          </div>
        </div>

        <button
          type="button"
          class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!rssFeedUrl || isValidatingFeed"
          @click="validateFeedUrl"
        >
          <span v-if="isValidatingFeed" class="flex items-center justify-center">
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Testing Feed...
          </span>
          <span v-else>Test Feed</span>
        </button>

        <button
          type="button"
          class="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canCompleteSetup"
          @click="finishSetup"
        >
          Complete Setup
        </button>
      </div>
    </div>
  </div>
</template>
