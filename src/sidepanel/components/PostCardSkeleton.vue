<script setup lang="ts">
// PostCardSkeleton - skeleton loader for PostCard component
</script>

<template>
  <div
    class="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    aria-hidden="true"
  >
    <!-- Header skeleton -->
    <div class="mb-3 flex items-start justify-between">
      <div class="flex items-center gap-2">
        <!-- Platform badge skeleton -->
        <div class="h-5 w-16 rounded bg-gray-200" />
        <!-- Status badge skeleton -->
        <div class="h-5 w-14 rounded-full bg-gray-200" />
      </div>
      <!-- Score skeleton -->
      <div class="h-5 w-10 rounded-full bg-gray-200" />
    </div>

    <!-- Author skeleton -->
    <div class="mb-3 flex items-center gap-2">
      <!-- Avatar skeleton -->
      <div class="h-8 w-8 rounded-full bg-gray-200" />
      <div class="flex-1">
        <!-- Name skeleton -->
        <div class="mb-1 h-4 w-32 rounded bg-gray-200" />
        <!-- Headline skeleton -->
        <div class="h-3 w-48 rounded bg-gray-200" />
      </div>
    </div>

    <!-- Content skeleton -->
    <div class="mb-3 space-y-2">
      <div class="h-3 w-full rounded bg-gray-200" />
      <div class="h-3 w-full rounded bg-gray-200" />
      <div class="h-3 w-3/4 rounded bg-gray-200" />
    </div>

    <!-- Match reason skeleton -->
    <div class="mb-3 h-3 w-2/3 rounded bg-gray-200" />

    <!-- Footer skeleton -->
    <div class="flex items-center justify-between border-t border-gray-100 pt-3">
      <!-- Timestamp skeleton -->
      <div class="h-3 w-16 rounded bg-gray-200" />
      <!-- Buttons skeleton -->
      <div class="flex gap-2">
        <div class="h-6 w-12 rounded bg-gray-200" />
        <div class="h-6 w-12 rounded bg-gray-200" />
        <div class="h-6 w-20 rounded bg-gray-200" />
      </div>
    </div>
  </div>
</template>
