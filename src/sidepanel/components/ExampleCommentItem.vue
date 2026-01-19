<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  comment: string;
  index: number;
}>();

const emit = defineEmits<{
  (e: 'delete', comment: string): void;
  (e: 'update', oldComment: string, newComment: string): void;
}>();

const isEditing = ref(false);
const editValue = ref('');

const truncatedComment = computed(() => {
  const maxLength = 100;
  if (props.comment.length <= maxLength) return props.comment;
  return props.comment.slice(0, maxLength) + '...';
});

function startEdit() {
  editValue.value = props.comment;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editValue.value = '';
}

function saveEdit() {
  if (editValue.value.trim() && editValue.value.trim() !== props.comment) {
    emit('update', props.comment, editValue.value.trim());
  }
  isEditing.value = false;
  editValue.value = '';
}

function handleDelete() {
  emit('delete', props.comment);
}
</script>

<template>
  <div
    class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-600"
    :class="{ 'bg-white dark:bg-gray-700': isEditing }"
  >
    <!-- Display mode -->
    <div v-if="!isEditing" class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <span class="text-xs text-gray-400 mr-2 dark:text-gray-500">{{ index + 1 }}.</span>
        <span class="text-sm text-gray-700 dark:text-gray-200">{{ truncatedComment }}</span>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-500 dark:hover:text-gray-200"
          title="Edit"
          @click="startEdit"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/50 dark:hover:text-red-400"
          title="Delete"
          @click="handleDelete"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Edit mode -->
    <div v-else class="space-y-2">
      <textarea
        v-model="editValue"
        rows="3"
        class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        placeholder="Enter example comment..."
      />
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
          @click="cancelEdit"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          :disabled="!editValue.trim()"
          @click="saveEdit"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>
