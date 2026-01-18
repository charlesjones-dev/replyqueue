<script setup lang="ts">
import { useCreditsModal } from '../composables/useCreditsModal'

const { state, hide, openCreditsPage } = useCreditsModal()

function handleAddCredits(): void {
  openCreditsPage()
  hide()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="hide"
        />

        <!-- Modal -->
        <div
          class="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credits-modal-title"
        >
          <!-- Warning icon -->
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <svg
              class="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <!-- Content -->
          <div class="mt-4 text-center">
            <h3
              id="credits-modal-title"
              class="text-lg font-semibold text-gray-900"
            >
              Insufficient OpenRouter Credits
            </h3>

            <p class="mt-2 text-sm text-gray-600">
              Your OpenRouter account doesn't have enough credits to complete this request.
            </p>

            <!-- Token details if available -->
            <div
              v-if="state.requestedTokens && state.availableTokens"
              class="mt-3 rounded-md bg-gray-50 p-3 text-sm"
            >
              <div class="flex justify-between text-gray-600">
                <span>Requested:</span>
                <span class="font-medium text-gray-900">{{ state.requestedTokens.toLocaleString() }} tokens</span>
              </div>
              <div class="mt-1 flex justify-between text-gray-600">
                <span>Available:</span>
                <span class="font-medium text-red-600">{{ state.availableTokens.toLocaleString() }} tokens</span>
              </div>
            </div>

            <p class="mt-3 text-sm text-gray-600">
              Add credits to your OpenRouter account to continue using AI features.
            </p>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="hide"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="handleAddCredits"
            >
              Add Credits
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
