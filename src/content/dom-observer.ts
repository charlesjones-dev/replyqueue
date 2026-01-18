/**
 * DOM Observer for ReplyQueue extension
 * Watches for new posts appearing in the feed using MutationObserver
 */

const LOG_PREFIX = '[ReplyQueue:DOMObserver]';

/**
 * Callback type for when new elements are detected
 */
export type OnElementsCallback = (elements: Element[]) => void;

/**
 * Configuration options for the DOM observer
 */
export interface DOMObserverOptions {
  /** Selector for elements to observe */
  targetSelector: string;
  /** Minimum time between callbacks (ms) */
  debounceMs: number;
  /** Callback when new elements are detected */
  onElements: OnElementsCallback;
}

/**
 * Creates a debounced MutationObserver that watches for new post elements
 */
export class DOMObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingElements: Set<Element> = new Set();
  private processedElements: WeakSet<Element> = new WeakSet();
  private options: DOMObserverOptions;

  constructor(options: DOMObserverOptions) {
    this.options = {
      ...options,
      debounceMs: Math.max(options.debounceMs, 100), // Minimum 100ms debounce
    };
  }

  /**
   * Start observing the DOM for changes
   */
  start(): void {
    if (this.observer) {
      console.warn(`${LOG_PREFIX} Observer already started`);
      return;
    }

    console.log(`${LOG_PREFIX} Starting DOM observation`);

    // Process any existing elements on the page
    this.processExistingElements();

    // Create the mutation observer
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`${LOG_PREFIX} DOM observer started`);
  }

  /**
   * Stop observing the DOM
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log(`${LOG_PREFIX} DOM observer stopped`);
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.pendingElements.clear();
  }

  /**
   * Force processing of any pending elements
   */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.processPendingElements();
  }

  /**
   * Process elements that already exist on the page
   */
  private processExistingElements(): void {
    const elements = document.querySelectorAll(this.options.targetSelector);
    console.log(`${LOG_PREFIX} Found ${elements.length} existing elements`);

    for (const element of elements) {
      if (!this.processedElements.has(element)) {
        this.pendingElements.add(element);
      }
    }

    if (this.pendingElements.size > 0) {
      this.scheduleProcessing();
    }
  }

  /**
   * Handle mutations from the observer
   */
  private handleMutations(mutations: MutationRecord[]): void {
    let hasNewElements = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Check if the added node matches our selector
            if (element.matches(this.options.targetSelector)) {
              if (!this.processedElements.has(element)) {
                this.pendingElements.add(element);
                hasNewElements = true;
              }
            }

            // Also check descendants
            const descendants = element.querySelectorAll(this.options.targetSelector);
            for (const descendant of descendants) {
              if (!this.processedElements.has(descendant)) {
                this.pendingElements.add(descendant);
                hasNewElements = true;
              }
            }
          }
        }
      }
    }

    if (hasNewElements) {
      this.scheduleProcessing();
    }
  }

  /**
   * Schedule processing with debounce
   */
  private scheduleProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingElements();
    }, this.options.debounceMs);
  }

  /**
   * Process all pending elements
   */
  private processPendingElements(): void {
    if (this.pendingElements.size === 0) {
      return;
    }

    const elements = Array.from(this.pendingElements);
    console.log(`${LOG_PREFIX} Processing ${elements.length} new elements`);

    // Mark all elements as processed
    for (const element of elements) {
      this.processedElements.add(element);
    }

    // Clear pending set
    this.pendingElements.clear();

    // Call the callback with new elements
    try {
      this.options.onElements(elements);
    } catch (error) {
      console.error(`${LOG_PREFIX} Error in onElements callback:`, error);
    }
  }
}

/**
 * Create a scroll listener that triggers on scroll end
 * Useful for detecting when user has scrolled to load more content
 */
export function onScrollEnd(callback: () => void, debounceMs = 150): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const handleScroll = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(callback, debounceMs);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Return cleanup function
  return () => {
    window.removeEventListener('scroll', handleScroll);
    if (timer) {
      clearTimeout(timer);
    }
  };
}
