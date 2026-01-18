/**
 * Toast notification composable
 * Provides a simple toast/notification system for the side panel
 */

import { ref, readonly } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// Shared state across all components
const toasts = ref<Toast[]>([]);

// Default durations per type
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
  warning: 4000,
};

let toastIdCounter = 0;

function generateId(): string {
  return `toast-${Date.now()}-${++toastIdCounter}`;
}

export function useToast() {
  /**
   * Show a toast notification
   */
  function show(message: string, type: ToastType = 'info', duration?: number): string {
    const id = generateId();
    const toast: Toast = {
      id,
      message,
      type,
      duration: duration ?? DEFAULT_DURATIONS[type],
    };

    toasts.value.push(toast);

    // Auto-dismiss after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, toast.duration);
    }

    return id;
  }

  /**
   * Dismiss a specific toast
   */
  function dismiss(id: string): void {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  /**
   * Dismiss all toasts
   */
  function dismissAll(): void {
    toasts.value = [];
  }

  /**
   * Show a success toast
   */
  function success(message: string, duration?: number): string {
    return show(message, 'success', duration);
  }

  /**
   * Show an error toast
   */
  function error(message: string, duration?: number): string {
    return show(message, 'error', duration);
  }

  /**
   * Show an info toast
   */
  function info(message: string, duration?: number): string {
    return show(message, 'info', duration);
  }

  /**
   * Show a warning toast
   */
  function warning(message: string, duration?: number): string {
    return show(message, 'warning', duration);
  }

  return {
    toasts: readonly(toasts),
    show,
    dismiss,
    dismissAll,
    success,
    error,
    info,
    warning,
  };
}
