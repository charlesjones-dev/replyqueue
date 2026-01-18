<script setup lang="ts">
import { ref } from 'vue';
import ExampleCommentItem from './ExampleCommentItem.vue';
import { MAX_EXAMPLE_COMMENTS } from '@shared/constants';

defineProps<{
  comments: string[];
}>();

const emit = defineEmits<{
  (e: 'add', comment: string): void;
  (e: 'delete', comment: string): void;
  (e: 'update', oldComment: string, newComment: string): void;
}>();

const newComment = ref('');

function handleAdd() {
  if (newComment.value.trim()) {
    emit('add', newComment.value.trim());
    newComment.value = '';
  }
}

function handleDelete(comment: string) {
  emit('delete', comment);
}

function handleUpdate(oldComment: string, newComment: string) {
  emit('update', oldComment, newComment);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-gray-700"> Writing Style Examples </label>
      <span class="text-xs text-gray-500"> {{ comments.length }}/{{ MAX_EXAMPLE_COMMENTS }} </span>
    </div>

    <p class="text-xs text-gray-500">
      Add example comments in your writing style. These will help the AI generate replies that match how you naturally
      write.
    </p>

    <!-- Add new comment -->
    <div class="space-y-2">
      <textarea
        v-model="newComment"
        rows="2"
        class="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
        placeholder="Type an example comment..."
        :disabled="comments.length >= MAX_EXAMPLE_COMMENTS"
      />
      <button
        type="button"
        class="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!newComment.trim() || comments.length >= MAX_EXAMPLE_COMMENTS"
        @click="handleAdd"
      >
        <span class="flex items-center justify-center">
          <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Example
        </span>
      </button>
    </div>

    <!-- Comments list -->
    <div
      v-if="comments.length > 0"
      class="max-h-64 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-2"
    >
      <ExampleCommentItem
        v-for="(comment, index) in comments"
        :key="comment"
        :comment="comment"
        :index="index"
        @delete="handleDelete"
        @update="handleUpdate"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="rounded-md border border-dashed border-gray-300 p-4 text-center">
      <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <p class="mt-2 text-sm text-gray-500">No examples yet. Add some comments to help train your writing style.</p>
    </div>
  </div>
</template>
