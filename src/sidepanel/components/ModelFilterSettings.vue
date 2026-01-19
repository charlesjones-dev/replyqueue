<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  minContextLength: number;
  maxAgeDays: number;
  maxPrice: number;
  allowedVendors: string[];
  nameExclusions: string[];
  newNameExclusion: string;
  contextLengthOptions: readonly { value: number; label: string }[];
  modelAgeOptions: readonly { value: number; label: string }[];
  maxPriceOptions: readonly { value: number; label: string }[];
  availableVendors: readonly { value: string; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:minContextLength', value: number): void;
  (e: 'update:maxAgeDays', value: number): void;
  (e: 'update:maxPrice', value: number): void;
  (e: 'update:newNameExclusion', value: string): void;
  (e: 'toggleVendor', vendor: string): void;
  (e: 'addNameExclusion'): void;
  (e: 'removeNameExclusion', exclusion: string): void;
}>();

const isExpanded = ref(false);

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toggle button -->
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      @click="toggleExpanded"
    >
      <span class="flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        Advanced Model Filters
      </span>
      <svg
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Collapsible content -->
    <div
      v-show="isExpanded"
      class="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
    >
      <!-- Min Context Length dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Minimum Context Length</label>
        <select
          :value="minContextLength"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:minContextLength', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in contextLengthOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Filter models by minimum context window size.</p>
      </div>

      <!-- Max Model Age dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Maximum Model Age</label>
        <select
          :value="maxAgeDays"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:maxAgeDays', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in modelAgeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Exclude models older than this age.</p>
      </div>

      <!-- Max Price dropdown -->
      <div>
        <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Maximum Price</label>
        <select
          :value="maxPrice"
          class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          @change="emit('update:maxPrice', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in maxPriceOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Blended price limit (75% input, 25% output weighted).
        </p>
      </div>

      <!-- Allowed Vendors multi-select pills -->
      <div>
        <label class="mb-2 block text-xs text-gray-500 dark:text-gray-400">Allowed Vendors</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="vendor in availableVendors"
            :key="vendor.value"
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            :class="
              allowedVendors.includes(vendor.value)
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500'
            "
            @click="emit('toggleVendor', vendor.value)"
          >
            {{ vendor.label }}
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Click to toggle which vendors appear in the model list.
        </p>
      </div>

      <!-- Name Exclusions tag input -->
      <div>
        <label class="mb-2 block text-xs text-gray-500 dark:text-gray-400">Name Exclusions</label>
        <div class="mb-2 flex gap-2">
          <input
            :value="newNameExclusion"
            type="text"
            placeholder="Add exclusion term..."
            class="flex-1 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            @input="emit('update:newNameExclusion', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="emit('addNameExclusion')"
          />
          <button
            type="button"
            class="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            :disabled="!newNameExclusion.trim()"
            @click="emit('addNameExclusion')"
          >
            Add
          </button>
        </div>
        <div v-if="nameExclusions.length > 0" class="flex flex-wrap gap-1">
          <span
            v-for="exclusion in nameExclusions"
            :key="exclusion"
            class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300"
          >
            {{ exclusion }}
            <button
              type="button"
              class="ml-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800"
              @click="emit('removeNameExclusion', exclusion)"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">No exclusions set.</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Models with these terms in their name or ID will be hidden.
        </p>
      </div>
    </div>
  </div>
</template>
