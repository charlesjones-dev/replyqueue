# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReplyQueue is a Chrome extension (Manifest V3) that helps content creators identify social media posts relevant to their blog content and provides AI-powered reply suggestions. It extracts posts from LinkedIn feeds, matches them against RSS feed content using keyword and AI-based semantic matching, and generates contextual replies.

## Commands

```bash
pnpm dev          # Start dev server with hot reload
pnpm build        # Production build (runs vue-tsc first)
pnpm test         # Run all tests once
pnpm test:watch   # Run tests in watch mode
```

**Loading the extension in Chrome:**
1. Run `pnpm build`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist/` directory

## Architecture

### Chrome Extension Layers

Three isolated contexts communicate via message passing:

1. **Content Script** (`src/content/`) - Runs on LinkedIn pages, extracts posts from DOM using MutationObserver
2. **Background Service Worker** (`src/background/`) - Orchestrates RSS fetching, matching logic, and AI API calls
3. **Side Panel UI** (`src/sidepanel/`) - Vue 3 app displaying matched posts and reply suggestions

### Platform Adapter Pattern

`src/platforms/` implements a cross-platform adapter architecture for adding new social platforms:

- `types.ts` - `PlatformAdapter` interface defining extraction contract
- `index.ts` - Registry mapping URLs to platform adapters
- `linkedin/` - LinkedIn-specific DOM extraction with CSS selectors
- `_template/` - Boilerplate for new platforms

Each adapter implements: `extractPost()`, `getPostUrl()`, `scrollToPost()`, `isFeedPage()`

### Message Passing

`src/shared/messages.ts` defines typed messages for cross-context communication:

- Content → Background: `POSTS_EXTRACTED`, `CONTENT_SCRIPT_READY`
- Side Panel ↔ Background: `FETCH_RSS`, `AI_MATCH_POSTS`, `GENERATE_SUGGESTIONS`
- Background → Content: `SCROLL_TO_POST`, `EXTRACT_POSTS`

### Vue 3 Composables

`src/sidepanel/composables/` extracts business logic into reusable composables:

- `useConfig.ts` - Extension configuration persistence
- `usePosts.ts` - Matched posts state with filtering
- `useModels.ts` - OpenRouter model selection
- `useSetup.ts` - Onboarding flow logic

### Storage Strategy

- **chrome.storage.sync** - Small config synced across devices (config, cachedModels)
- **chrome.storage.local** - Larger local data (extractedPosts, matchedPostsWithScore, cachedRssFeed)

## Testing

Tests in `tests/` mirror `src/` structure. Chrome APIs are mocked in `tests/setup.ts`.

```bash
pnpm test                           # Run all tests
pnpm test:watch                     # Watch mode
pnpm vitest tests/background/       # Run specific directory
pnpm vitest -t "keyword matching"   # Run tests matching pattern
```

## Code Conventions

**TypeScript:**
- Strict mode enabled
- Prefer `interface` over `type` for objects
- Explicit return types on exported functions
- Use `unknown` not `any`

**Vue:**
- Composition API with `<script setup>`
- Extract logic to composables
- Single-purpose components

**Naming:**
- Files: kebab-case (`post-card.vue`)
- Components: PascalCase (`PostCard`)
- Composables: `use` prefix (`useConfig`)
- Constants: SCREAMING_SNAKE_CASE

**Formatting:**
- 2 spaces, single quotes, no semicolons
- Trailing commas in multiline

## Path Aliases

```typescript
import { something } from '@/path'       // → src/path
import { shared } from '@shared/types'   // → src/shared/types
```

## Key Files

- `manifest.json` - Chrome extension manifest
- `src/shared/constants.ts` - Default config values (thresholds, limits)
- `src/shared/types.ts` - Core TypeScript interfaces
- `src/background/matcher.ts` - Keyword + AI matching logic
- `src/background/openrouter.ts` - AI API client

## Workflow

After implementing any plan, always run preflight checks:

```bash
pnpm build        # Type check + build
pnpm lint:fix     # Auto-fix lint issues
pnpm format       # Auto-fix formatting
pnpm test         # Run tests
```

Fix any errors before considering the implementation complete.
