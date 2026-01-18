# ReplyQueue Chrome Extension - Implementation Plan

## Overview

Build a Chrome extension that helps content creators identify social media posts relevant to their blog content, surfacing engagement opportunities with AI-powered reply suggestions.

**V1 Scope:** LinkedIn only, with cross-platform architecture for future expansion.

---

## Phase 1: Project Foundation & Setup View

**Goal:** Scaffold the Chrome extension with Vite + CRXJS + Vue 3, implement the required Setup View onboarding flow, and establish the app state management pattern.

### Tasks

1. **Initialize project structure**
   - Create package.json with all dependencies (Vue 3, Vite, CRXJS, Tailwind, TypeScript, rss-parser, Vitest)
   - Configure tsconfig.json for Chrome extension development
   - Configure vite.config.ts with CRXJS plugin and multiple entry points
   - Set up Tailwind CSS with PostCSS

2. **Create manifest.json (Manifest V3)**
   - Declare permissions: storage, sidePanel, activeTab
   - Declare host_permissions for linkedin.com and openrouter.ai
   - Configure service worker, content scripts, and side panel entries
   - Add placeholder icons (16, 48, 128)

3. **Build shared utilities**
   - `src/shared/types.ts` - Core interfaces (ExtensionConfig, Post, MatchedPost, ValidationResult)
   - `src/shared/constants.ts` - RECOMMENDED_MODELS, DEFAULT_MODEL, default config values
   - `src/shared/storage.ts` - Typed chrome.storage wrappers with sync/local fallback
   - `src/shared/validation.ts` - validateApiKeyFormat, validateApiKeyWithServer, validateRssUrlFormat, validateRssFeed
   - `src/shared/messages.ts` - Message passing types for content/background communication

4. **Implement side panel shell**
   - `src/sidepanel/index.html` - HTML entry point
   - `src/sidepanel/main.ts` - Vue app bootstrap
   - `src/sidepanel/App.vue` - Root component with view routing
   - `src/styles/main.css` - Tailwind directives

5. **Build app state management**
   - `src/sidepanel/composables/useAppState.ts` - Tracks current view (setup/main/settings)
   - `src/sidepanel/composables/useConfig.ts` - Settings state and persistence
   - Implement checkSetupStatus() to determine initial view on load

6. **Create Setup View (onboarding)**
   - `src/sidepanel/views/SetupView.vue` - Two-step onboarding UI
   - `src/sidepanel/components/ApiKeyInput.vue` - Reusable input with show/hide toggle
   - `src/sidepanel/composables/useSetup.ts` - Setup flow state and validation logic
   - Step 1: API key input with "Validate Key" button (calls validateApiKeyWithServer)
   - Step 2: RSS feed URL input with "Test Feed" button (calls validateRssFeed)
   - "Complete Setup" button enabled only when both steps valid
   - On complete: save to storage, transition to Main View

7. **Create placeholder views**
   - `src/sidepanel/views/MainView.vue` - Stub with "Setup complete" message
   - `src/sidepanel/views/SettingsView.vue` - Stub with back navigation

8. **Write unit tests**
   - Configure Vitest
   - Test validation functions (API key format, RSS URL format)
   - Test storage utilities
   - Test app state transitions

### Acceptance Criteria

- [ ] Extension loads in Chrome without errors
- [ ] Side panel opens and displays Setup View on first launch
- [ ] API key validation shows appropriate error messages for invalid input
- [ ] API key validation calls OpenRouter API and confirms valid key
- [ ] RSS feed validation fetches URL and confirms valid RSS/Atom feed
- [ ] "Complete Setup" button only enables when both validations pass
- [ ] After setup completion, Main View is shown
- [ ] Settings and API key persist in chrome.storage.sync
- [ ] All unit tests pass

### Dependencies

None (first phase)

---

## Phase 2: Platform Adapter & Content Script

**Goal:** Implement the cross-platform adapter architecture and LinkedIn-specific DOM extraction, with message passing to the background worker.

### Tasks

1. **Define platform adapter interface**
   - `src/platforms/types.ts` - PlatformAdapter interface, FeedSelectors type, Post type
   - `src/platforms/index.ts` - Platform registry and loader (getPlatformForUrl)

2. **Implement LinkedIn adapter**
   - `src/platforms/linkedin/selectors.ts` - DOM selectors for feed posts, author info, engagement metrics
   - `src/platforms/linkedin/adapter.ts` - Full PlatformAdapter implementation
   - extractPost() - Parse DOM element into Post object
   - getPostUrl() - Generate LinkedIn post permalink
   - scrollToPost() - Scroll page to specific post by ID

3. **Create template for future platforms**
   - `src/platforms/_template/adapter.ts` - Documented template
   - `src/platforms/_template/selectors.ts` - Selector structure template

4. **Build content script**
   - `src/content/index.ts` - Entry point, load appropriate adapter based on domain
   - `src/content/dom-observer.ts` - MutationObserver with debouncing (500ms minimum)
   - `src/content/post-extractor.ts` - Uses platform adapter to extract posts
   - Handle various LinkedIn post formats (text, images, articles, reposts)

5. **Implement message passing**
   - Define message types in `src/shared/messages.ts`
   - Content script sends extracted posts to background worker
   - Background worker acknowledges receipt
   - Handle connection lifecycle (port vs one-time messages)

6. **Create background worker shell**
   - `src/background/index.ts` - Service worker entry point
   - Listen for messages from content scripts
   - Store extracted posts in chrome.storage.local
   - Basic deduplication by post ID

7. **Write unit tests**
   - Test platform adapter interface compliance
   - Test post extraction with mock DOM elements
   - Test message serialization/deserialization
   - Test debounce logic

### Acceptance Criteria

- [ ] Content script activates only on linkedin.com
- [ ] Posts are extracted as user scrolls through feed
- [ ] Extraction handles text posts, image posts, article shares, reposts
- [ ] Author name, headline, content, and engagement metrics captured
- [ ] Posts sent to background worker without errors
- [ ] Posts stored in chrome.storage.local with deduplication
- [ ] No duplicate posts in storage when scrolling back up
- [ ] Console logging shows extraction activity (dev mode)
- [ ] Platform adapter architecture is documented and extensible

### Dependencies

- Phase 1 (shared utilities, storage layer)

---

## Phase 3: RSS Integration & Settings Panel

**Goal:** Implement RSS fetching/parsing, build the full Settings View UI, and create the basic keyword matching (non-AI) flow.

### Tasks

1. **Build RSS fetcher**
   - `src/background/rss-fetcher.ts` - Fetch and parse RSS/Atom feeds
   - Handle various RSS formats (RSS 2.0, Atom, RSS 1.0)
   - Extract: title, description, content, URL, tags/categories, publication date
   - Implement caching with configurable TTL (default 60 minutes)
   - Store parsed feed in chrome.storage.local

2. **Implement basic keyword matching**
   - `src/background/matcher.ts` - Platform-agnostic matching logic
   - Extract keywords from RSS content (titles, tags, key phrases)
   - Simple text matching against post content
   - Calculate basic relevance score (0-1)
   - Return matched posts with reason

3. **Build Settings View UI**
   - `src/sidepanel/views/SettingsView.vue` - Full settings panel
   - `src/sidepanel/composables/useSettingsView.ts` - Toggle between main/settings
   - RSS feed URL input with "Test Connection" button
   - API key display (masked) with Edit button
   - Model selector placeholder (will be enhanced in Phase 4)
   - Matching preferences: threshold slider, max posts dropdown, cache TTL
   - Save/Cancel buttons with unsaved changes warning
   - Back arrow navigation

4. **Build writing style examples manager**
   - `src/sidepanel/components/ExampleCommentsList.vue` - Scrollable list with add/delete
   - `src/sidepanel/components/ExampleCommentItem.vue` - Individual example with edit/delete
   - Textarea for adding new examples
   - Persist to storage with sync/local fallback for large lists

5. **Connect Main View to matched posts**
   - `src/sidepanel/composables/usePosts.ts` - Fetch matched posts from storage
   - Display matched posts in Main View (basic card layout)
   - Show relevance score, post preview, author info
   - Status bar showing RSS connection and posts scanned

6. **Build basic post card component**
   - `src/sidepanel/components/PostCard.vue` - Renders any platform's post
   - `src/sidepanel/components/PlatformBadge.vue` - Visual indicator (LinkedIn icon)
   - `src/sidepanel/components/StatusBar.vue` - Connection status

7. **Write unit tests**
   - Test RSS parsing with various feed formats
   - Test keyword extraction
   - Test basic matching algorithm
   - Test settings persistence
   - Test example comments storage fallback

### Acceptance Criteria

- [ ] RSS feed fetched and parsed correctly (RSS 2.0 and Atom)
- [ ] RSS content cached with configurable TTL
- [ ] Settings panel opens/closes within sidebar
- [ ] All settings persist after Save
- [ ] Cancel discards unsaved changes
- [ ] Unsaved changes warning shown when navigating away
- [ ] Writing style examples can be added, edited, deleted
- [ ] Large example lists fall back to local storage
- [ ] Basic keyword matching produces relevance scores
- [ ] Matched posts display in Main View with scores
- [ ] Status bar shows RSS connection status and post count

### Dependencies

- Phase 1 (storage, validation, app state)
- Phase 2 (extracted posts in storage)

---

## Phase 4: AI-Powered Matching & Reply Generation

**Goal:** Integrate OpenRouter API for semantic matching and reply suggestion generation, with dynamic model selection.

### Tasks

1. **Build OpenRouter API client**
   - `src/background/openrouter.ts` - API client for chat completions
   - Implement rate limiting and retry logic with exponential backoff
   - Handle API errors gracefully (401, 403, 429, 500)
   - Support configurable model selection

2. **Implement dynamic model loading**
   - Fetch models from OpenRouter /api/v1/models endpoint
   - Cache model list for 1 hour in chrome.storage.local
   - Validate recommended models exist in API response
   - Calculate blended price and model age
   - Filter models by max price and max age

3. **Build model selector UI**
   - `src/sidepanel/components/ModelSelector.vue` - Full model selection list
   - `src/sidepanel/composables/useModels.ts` - Fetch, filter, cache models
   - Show recommended models first (validated against API)
   - "Show all models" checkbox expands to filtered list
   - Filter input for text search within all models
   - Cost tier indicators ($, $$, $$$)
   - Checkmark on selected model
   - Refresh button to manually reload model list

4. **Implement semantic matching**
   - Update `src/background/matcher.ts` with AI matching mode
   - Build prompt template with blog content summaries
   - Batch posts for efficient API calls
   - Parse JSON response with relevance scores and reasons
   - Cache results by post ID to avoid redundant calls

5. **Implement reply suggestion generation**
   - Extend matching prompt to include reply generation
   - Include user's writing style examples (limit to 10-15 most recent)
   - Generate 2-3 suggestions per matched post
   - Append blog URL to each suggestion
   - Store suggestions with matched post data

6. **Build reply suggestion UI**
   - `src/sidepanel/components/ReplySuggestion.vue` - Individual reply with copy button
   - `src/sidepanel/composables/useClipboard.ts` - Copy to clipboard helper
   - Show first suggestion by default, expandable to see all
   - Copy button with "Copied!" confirmation
   - Regenerate button (calls API for fresh suggestions)

7. **Update Main View for AI features**
   - Show matched blog post title and URL
   - Display match reason
   - Integrate reply suggestions into PostCard
   - Add model selector to header area

8. **Handle fallback scenarios**
   - If API key removed: return to Setup View
   - If selected model unavailable: prompt to select new model
   - If generation fails: show error, offer retry with fallback model
   - If offline: use cached matches, disable regeneration

9. **Write unit tests**
   - Test OpenRouter client error handling
   - Test model filtering and sorting
   - Test blended price calculation
   - Test prompt template generation
   - Test response parsing
   - Test clipboard functionality

### Acceptance Criteria

- [ ] OpenRouter completions API calls succeed with selected model
- [ ] Model list dynamically loaded and cached for 1 hour
- [ ] Recommended models validated against API response
- [ ] Model filters (price, age) work correctly
- [ ] Model selector shows cost tiers and selection state
- [ ] Semantic matching produces higher quality relevance scores than keyword matching
- [ ] Reply suggestions generated with blog URL appended
- [ ] Reply suggestions reflect user's writing style when examples provided
- [ ] Copy-to-clipboard works reliably
- [ ] Regenerate button fetches fresh suggestions
- [ ] Graceful fallbacks when API calls fail
- [ ] Results cached by post ID (no duplicate API calls)

### Dependencies

- Phase 1 (storage, validation)
- Phase 2 (extracted posts)
- Phase 3 (RSS content, settings, basic matcher)

---

## Phase 5: Polish & UX Refinement

**Goal:** Implement "Jump to Post" functionality, add loading states, improve error handling, and optimize performance.

### Tasks

1. **Implement "Jump to Post" functionality**
   - Add scrollToPost() method to LinkedIn adapter
   - PostCard "Jump to Post" button sends message to content script
   - Content script scrolls page to target post
   - Handle case where post is no longer in DOM

2. **Add loading states and transitions**
   - Loading spinner for API calls
   - Skeleton loaders for post cards
   - Smooth transitions between views
   - Progress indicator during setup validation

3. **Improve error handling**
   - User-friendly error messages for all failure modes
   - Retry buttons where appropriate
   - Network offline detection and graceful degradation
   - Clear cache button in settings

4. **Implement refresh functionality**
   - Manual refresh button in Main View footer
   - Re-scan current feed posts
   - Re-fetch RSS if TTL expired
   - Show last updated timestamp

5. **Performance optimization**
   - Use shallowRef for large post arrays
   - Batch chrome.storage writes
   - Lazy load reply suggestions (don't generate until expanded)
   - Limit stored posts to prevent bloat (configurable max)
   - Virtual scrolling for long post lists if needed

6. **Add notification support (optional)**
   - Enable/disable in settings
   - Notify when high-relevance post found
   - Respect browser notification permissions

7. **Create placeholder icons**
   - Generate simple placeholder icons (16, 48, 128)
   - Add to public/icons/

8. **Write integration tests**
   - Test full flow: setup -> extraction -> matching -> display
   - Test settings changes propagate correctly
   - Test cache clearing and refresh

### Acceptance Criteria

- [ ] "Jump to Post" scrolls LinkedIn page to correct post
- [ ] Loading states shown during all async operations
- [ ] Smooth transitions between views
- [ ] All error states have user-friendly messages and recovery options
- [ ] Refresh button re-scans and updates display
- [ ] Performance acceptable with 100+ extracted posts
- [ ] Clear cache button works correctly
- [ ] Extension icons display correctly in Chrome toolbar

### Dependencies

- Phases 1-4 complete

---

## Phase 6: Distribution Preparation

**Goal:** Prepare the extension for Chrome Web Store submission with documentation, privacy policy, and required assets.

### Tasks

1. **Create comprehensive README.md**
   - Project overview and value proposition
   - Technology stack badges (Vue 3, TypeScript, Tailwind, Chrome MV3)
   - License badge (MIT)
   - Installation instructions (from source and Chrome Web Store)
   - Development setup (clone, install, build, load unpacked)
   - Architecture overview (content script, background worker, side panel, platform adapters)
   - How to add new platform adapters (reference _template directory)
   - Configuration options explained
   - Screenshots/GIFs of key features
   - Privacy and data handling explanation
   - Troubleshooting guide
   - Contributing guidelines (issues, PRs, code style)
   - Roadmap (planned platforms, future features)

2. **Write privacy policy**
   - Required for Chrome Web Store
   - Document all data collection and storage
   - Explain what is sent to external services (OpenRouter, RSS)
   - No analytics or tracking statement
   - Host on accessible URL (GitHub Pages or similar)

3. **Create Chrome Web Store assets**
   - Promotional tile images (440x280, 920x680, 1400x560)
   - Screenshots of key features (1280x800 or 640x400)
   - Short description (up to 132 characters)
   - Detailed description

4. **Production build configuration**
   - Verify production build works correctly
   - Remove console.log statements or gate behind dev flag
   - Ensure no development-only code ships
   - Test in fresh Chrome profile

5. **Create CHANGELOG.md**
   - Document V1 features
   - Set up for future version tracking

6. **Create CONTRIBUTING.md**
   - Development environment setup
   - Code style and linting rules
   - How to submit issues (bug reports, feature requests)
   - Pull request process
   - How to add a new platform adapter (step-by-step)
   - Testing requirements before submitting PRs

7. **Final testing**
   - Full manual test on clean Chrome installation
   - Verify all permissions work correctly
   - Test with real LinkedIn feed
   - Test with real RSS feed
   - Test API key validation and model selection

### Acceptance Criteria

- [ ] README provides clear setup instructions
- [ ] Privacy policy is comprehensive and accurate
- [ ] All Chrome Web Store assets created
- [ ] Production build runs without errors
- [ ] No console.log pollution in production
- [ ] Extension passes Chrome Web Store requirements
- [ ] Changelog documents initial release

### Dependencies

- Phases 1-5 complete

---

## Execution Strategy

### Recommended Approach

**Sequential execution** is recommended for this project due to heavy inter-phase dependencies:

1. Phase 1 establishes the foundation all other phases build upon
2. Phase 2 depends on Phase 1's storage and shared utilities
3. Phase 3 depends on Phase 2's extracted posts
4. Phase 4 depends on Phase 3's RSS content and settings infrastructure
5. Phase 5 polishes the complete feature set
6. Phase 6 is documentation and distribution

### Context Efficiency

Each phase is sized for approximately 30-50k tokens of context, allowing a sub-agent to complete it in a single session. Key considerations:

- Phase 1 is largest (foundation setup) but self-contained
- Phase 4 is most complex (AI integration) but builds on existing patterns
- Phase 5 can be split if needed (Jump to Post, Loading States, Performance as separate tasks)

### Testing Strategy

- Unit tests (Vitest) included in each phase
- Run tests before marking phase complete
- Integration testing in Phase 5 covers full flows

---

## File Reference

```
replyqueue/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── src/
│   ├── platforms/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── linkedin/
│   │   │   ├── adapter.ts
│   │   │   └── selectors.ts
│   │   └── _template/
│   │       ├── adapter.ts
│   │       └── selectors.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── dom-observer.ts
│   │   └── post-extractor.ts
│   ├── background/
│   │   ├── index.ts
│   │   ├── rss-fetcher.ts
│   │   ├── openrouter.ts
│   │   └── matcher.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── views/
│   │   │   ├── SetupView.vue
│   │   │   ├── MainView.vue
│   │   │   └── SettingsView.vue
│   │   ├── components/
│   │   │   ├── PostCard.vue
│   │   │   ├── ReplySuggestion.vue
│   │   │   ├── PlatformBadge.vue
│   │   │   ├── ModelSelector.vue
│   │   │   ├── StatusBar.vue
│   │   │   ├── ApiKeyInput.vue
│   │   │   ├── ExampleCommentsList.vue
│   │   │   └── ExampleCommentItem.vue
│   │   └── composables/
│   │       ├── useConfig.ts
│   │       ├── useAppState.ts
│   │       ├── useSetup.ts
│   │       ├── usePosts.ts
│   │       ├── useClipboard.ts
│   │       ├── useSettingsView.ts
│   │       └── useModels.ts
│   ├── shared/
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── storage.ts
│   │   ├── validation.ts
│   │   └── messages.ts
│   └── styles/
│       └── main.css
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── tests/
│   ├── setup.ts
│   └── ...
├── docs/
│   └── plans/
│       └── replyqueue-chrome-extension.md
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── privacy-policy.md
```
