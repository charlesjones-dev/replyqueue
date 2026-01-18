/**
 * Network status composable
 * Detects online/offline status and provides network health information
 */

import { ref, readonly, onMounted, onUnmounted } from 'vue'

const isOnline = ref(navigator.onLine)

export function useNetworkStatus() {
  function updateOnlineStatus() {
    isOnline.value = navigator.onLine
  }

  onMounted(() => {
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })

  return {
    isOnline: readonly(isOnline),
  }
}
