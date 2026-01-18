<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'gray' | 'white';
  label?: string;
}>();

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};

const colorClasses = {
  blue: 'text-blue-600',
  gray: 'text-gray-400',
  white: 'text-white',
};
</script>

<template>
  <div class="flex items-center gap-2" :aria-label="label || 'Loading'" role="status">
    <svg
      class="animate-spin"
      :class="[sizeClasses[size ?? 'md'], colorClasses[color ?? 'blue']]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <span v-if="label" class="text-sm" :class="colorClasses[color ?? 'gray']">
      {{ label }}
    </span>
  </div>
</template>
