import { ref, computed, watch, readonly } from 'vue';
import type { ThemePreference } from '@shared/types';
import { DEFAULT_THEME_PREFERENCE } from '@shared/constants';
import { getConfig, updateConfig } from '@shared/storage';

const themePreference = ref<ThemePreference>(DEFAULT_THEME_PREFERENCE);
const systemPrefersDark = ref(false);

/**
 * The resolved theme based on preference and system settings
 */
const resolvedTheme = computed<'light' | 'dark'>(() => {
  if (themePreference.value === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light';
  }
  return themePreference.value;
});

/**
 * Apply the current theme to the document
 */
function applyTheme(): void {
  const theme = resolvedTheme.value;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Listen for system theme preference changes
 */
function setupSystemThemeListener(): void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark.value = mediaQuery.matches;

  mediaQuery.addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches;
  });
}

export function useTheme() {
  /**
   * Initialize theme from storage and apply it
   * Should be called once on app mount
   */
  async function initializeTheme(): Promise<void> {
    setupSystemThemeListener();

    try {
      const config = await getConfig();
      themePreference.value = config.themePreference ?? DEFAULT_THEME_PREFERENCE;
    } catch (e) {
      console.error('[useTheme] Failed to load theme preference:', e);
      themePreference.value = DEFAULT_THEME_PREFERENCE;
    }

    applyTheme();
  }

  /**
   * Set the theme preference and persist to storage
   */
  async function setTheme(preference: ThemePreference): Promise<void> {
    themePreference.value = preference;
    try {
      await updateConfig({ themePreference: preference });
    } catch (e) {
      console.error('[useTheme] Failed to save theme preference:', e);
    }
  }

  /**
   * Cycle through theme preferences: system → light → dark → system
   */
  async function toggleTheme(): Promise<void> {
    const cycle: ThemePreference[] = ['system', 'light', 'dark'];
    const currentIndex = cycle.indexOf(themePreference.value);
    const nextIndex = (currentIndex + 1) % cycle.length;
    await setTheme(cycle[nextIndex]);
  }

  // Watch for changes and apply theme
  watch(resolvedTheme, () => {
    applyTheme();
  });

  return {
    themePreference: readonly(themePreference),
    resolvedTheme,
    initializeTheme,
    setTheme,
    toggleTheme,
  };
}
