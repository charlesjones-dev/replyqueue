<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '../composables/useTheme';

const { themePreference, toggleTheme } = useTheme();

const tooltipText = computed(() => {
  switch (themePreference.value) {
    case 'system':
      return 'Theme: System';
    case 'light':
      return 'Theme: Light';
    case 'dark':
      return 'Theme: Dark';
    default:
      return 'Toggle theme';
  }
});
</script>

<template>
  <button
    type="button"
    class="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
    :title="tooltipText"
    @click="toggleTheme"
  >
    <!-- System icon (monitor) -->
    <svg v-if="themePreference === 'system'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
    <!-- Light icon (sun) -->
    <svg v-else-if="themePreference === 'light'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
    <!-- Dark icon (moon) -->
    <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  </button>
</template>
