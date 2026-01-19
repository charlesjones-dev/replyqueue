<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isActive: boolean;
  platform?: string | null;
}>();

const statusInfo = computed(() => {
  if (props.isActive) {
    return {
      label: 'Active',
      dotColor: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800',
    };
  }
  return {
    label: 'Inactive',
    dotColor: 'bg-gray-400 dark:bg-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-700',
    textColor: 'text-gray-500 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-600',
  };
});

const platformLabel = computed(() => {
  if (!props.isActive || !props.platform) return null;
  return props.platform.charAt(0).toUpperCase() + props.platform.slice(1);
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
    :class="[statusInfo.bgColor, statusInfo.textColor, statusInfo.borderColor]"
    :title="isActive ? `Scanning ${platformLabel}` : 'Not on a supported platform'"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="statusInfo.dotColor" />
    {{ statusInfo.label }}
  </span>
</template>
