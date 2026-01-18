<script setup lang="ts">
import { useToast, type ToastType } from '../composables/useToast'

const { toasts, dismiss } = useToast()

function getToastClasses(type: ToastType): string {
  const baseClasses = 'rounded-lg px-4 py-3 shadow-lg border flex items-start gap-3'

  switch (type) {
    case 'success':
      return `${baseClasses} bg-green-50 border-green-200 text-green-800`
    case 'error':
      return `${baseClasses} bg-red-50 border-red-200 text-red-800`
    case 'warning':
      return `${baseClasses} bg-yellow-50 border-yellow-200 text-yellow-800`
    case 'info':
    default:
      return `${baseClasses} bg-blue-50 border-blue-200 text-blue-800`
  }
}

function getIconColor(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    case 'warning':
      return 'text-yellow-500'
    case 'info':
    default:
      return 'text-blue-500'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="getToastClasses(toast.type)"
          role="alert"
        >
          <!-- Icon -->
          <div :class="getIconColor(toast.type)" class="flex-shrink-0 mt-0.5">
            <!-- Success icon -->
            <svg
              v-if="toast.type === 'success'"
              class="h-5 w-5"
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

            <!-- Error icon -->
            <svg
              v-else-if="toast.type === 'error'"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>

            <!-- Warning icon -->
            <svg
              v-else-if="toast.type === 'warning'"
              class="h-5 w-5"
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

            <!-- Info icon -->
            <svg
              v-else
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <!-- Message -->
          <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>

          <!-- Dismiss button -->
          <button
            type="button"
            class="flex-shrink-0 rounded-md p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2"
            :class="{
              'focus:ring-green-500': toast.type === 'success',
              'focus:ring-red-500': toast.type === 'error',
              'focus:ring-yellow-500': toast.type === 'warning',
              'focus:ring-blue-500': toast.type === 'info',
            }"
            @click="dismiss(toast.id)"
          >
            <span class="sr-only">Dismiss</span>
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
