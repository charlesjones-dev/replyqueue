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
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    };
  }
  return {
    label: 'Inactive',
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-200',
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
