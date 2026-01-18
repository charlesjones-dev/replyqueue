<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppState } from './composables/useAppState';
import SetupView from './views/SetupView.vue';
import MainView from './views/MainView.vue';
import SettingsView from './views/SettingsView.vue';
import LoadingSpinner from './components/LoadingSpinner.vue';
import InsufficientCreditsModal from './components/InsufficientCreditsModal.vue';

const { currentView, checkSetupStatus } = useAppState();
const isInitializing = ref(true);

onMounted(async () => {
  await checkSetupStatus();
  isInitializing.value = false;
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Initial loading state -->
    <div v-if="isInitializing" class="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" label="Loading ReplyQueue..." />
    </div>

    <!-- View transitions -->
    <Transition v-else name="fade" mode="out-in">
      <SetupView v-if="currentView === 'setup'" key="setup" />
      <MainView v-else-if="currentView === 'main'" key="main" />
      <SettingsView v-else-if="currentView === 'settings'" key="settings" />
    </Transition>

    <!-- Global modals -->
    <InsufficientCreditsModal />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
