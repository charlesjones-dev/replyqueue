# Contributing to ReplyQueue

Thank you for your interest in contributing to ReplyQueue! This document provides guidelines for contributing to the project.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Code Style](#code-style)
- [Submitting Issues](#submitting-issues)
- [Pull Request Process](#pull-request-process)
- [Adding a New Platform Adapter](#adding-a-new-platform-adapter)
- [Testing Requirements](#testing-requirements)

---

## Development Environment Setup

### Prerequisites

- Node.js 18 or higher
- pnpm 9 or higher
- Chrome browser (for testing the extension)
- Git

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/replyqueue.git
   cd replyqueue
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start the development server**
   ```bash
   pnpm dev
   ```

4. **Load the extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

5. **Run tests**
   ```bash
   pnpm test
   ```

### Project Structure

```
replyqueue/
├── src/
│   ├── platforms/      # Platform adapters (LinkedIn, etc.)
│   ├── content/        # Content script (runs on social media)
│   ├── background/     # Service worker
│   ├── sidepanel/      # Vue 3 side panel UI
│   └── shared/         # Shared utilities and types
├── tests/              # Test files (mirrors src/ structure)
├── public/             # Static assets
└── docs/               # Documentation
```

---

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for exported functions
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
export function extractPost(element: Element): ExtractedPost | null {
  // ...
}

// Avoid
export function extractPost(element: any) {
  // ...
}
```

### Vue Components

- Use Composition API with `<script setup>`
- Use TypeScript in components
- Keep components focused and single-purpose
- Extract reusable logic into composables

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `post-card.vue`, `rss-fetcher.ts` |
| Components | PascalCase | `PostCard.vue`, `StatusBar.vue` |
| Composables | camelCase with `use` prefix | `useConfig.ts`, `usePosts.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_POSTS`, `API_BASE_URL` |
| Functions | camelCase | `extractPost()`, `validateKey()` |
| Interfaces | PascalCase | `ExtractedPost`, `PlatformAdapter` |

### Formatting

The project uses default Vite/TypeScript formatting. Key points:
- 2 spaces for indentation
- Single quotes for strings
- No semicolons (unless required)
- Trailing commas in multiline

---

## Submitting Issues

### Bug Reports

When reporting a bug, please include:

1. **Description** - Clear description of the issue
2. **Steps to reproduce** - Numbered steps to recreate the bug
3. **Expected behavior** - What should happen
4. **Actual behavior** - What actually happens
5. **Environment**
   - Chrome version
   - Operating system
   - Extension version
6. **Console errors** - Any errors from DevTools console
7. **Screenshots** - If applicable

**Template:**
```markdown
## Bug Description
[Clear description]

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Chrome: [version]
- OS: [operating system]
- Extension: [version]

## Console Errors
```
[paste errors here]
```

## Screenshots
[if applicable]
```

### Feature Requests

For feature requests, please include:

1. **Problem statement** - What problem does this solve?
2. **Proposed solution** - How should it work?
3. **Alternatives considered** - Other approaches you thought of
4. **Additional context** - Mockups, examples, etc.

---

## Pull Request Process

### Before You Start

1. Check existing issues and PRs to avoid duplicates
2. For significant changes, open an issue first to discuss
3. Fork the repository and create a feature branch

### Branch Naming

Use descriptive branch names:
- `feature/twitter-adapter` - New features
- `fix/rss-parsing-error` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/storage-layer` - Code refactoring

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Run tests**
   ```bash
   pnpm test
   ```

4. **Build the extension**
   ```bash
   pnpm build
   ```

5. **Test manually**
   - Load the extension in Chrome
   - Test your changes in a real scenario

### Submitting the PR

1. Push your branch to your fork
2. Open a Pull Request against `main`
3. Fill out the PR template
4. Link any related issues

**PR Template:**
```markdown
## Description
[What does this PR do?]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console.log in production code
```

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, your PR will be merged

---

## Adding a New Platform Adapter

Adding support for a new social media platform involves several steps.

### Step 1: Create the Adapter Directory

```bash
cp -r src/platforms/_template src/platforms/twitter
```

### Step 2: Update Selectors (`selectors.ts`)

Define CSS selectors for the platform's DOM:

```typescript
export const platformSelectors: FeedSelectors = {
  postItem: '[data-testid="tweet"]',
  postContent: '[data-testid="tweetText"]',
  authorName: '[data-testid="User-Name"] span',
  authorHeadline: '[data-testid="UserName"] + div',
  authorProfileLink: '[data-testid="User-Name"] a',
  postTimestamp: 'time',
  reactionCount: '[data-testid="like"] span',
  commentCount: '[data-testid="reply"] span',
  repostCount: '[data-testid="retweet"] span',
}
```

### Step 3: Implement the Adapter (`adapter.ts`)

Update the class with platform-specific logic:

```typescript
export class TwitterAdapter implements PlatformAdapter {
  readonly platformId = 'twitter'
  readonly platformName = 'Twitter'
  readonly selectors: FeedSelectors = platformSelectors

  isFeedPage(url: string): boolean {
    return /twitter\.com\/(home|[^/]+\/status)/.test(url)
  }

  extractPost(element: Element): ExtractedPost | null {
    // Platform-specific extraction logic
  }

  getPostUrl(postId: string): string {
    return `https://twitter.com/i/status/${postId}`
  }

  scrollToPost(postId: string): boolean {
    // Scroll implementation
  }
}
```

### Step 4: Register the Platform

In `src/platforms/index.ts`:

```typescript
import { TwitterAdapter } from './twitter/adapter'

const adapters: PlatformAdapter[] = [
  new LinkedInAdapter(),
  new TwitterAdapter(), // Add your adapter
]
```

### Step 5: Update Manifest

In `manifest.json`, add:

```json
{
  "host_permissions": [
    "https://twitter.com/*",
    "https://x.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://twitter.com/*", "https://x.com/*"],
      "js": ["src/content/index.ts"]
    }
  ]
}
```

### Step 6: Add Tests

Create `tests/platforms/twitter-extraction.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { TwitterAdapter } from '../../src/platforms/twitter/adapter'

describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter

  beforeEach(() => {
    adapter = new TwitterAdapter()
  })

  it('should have correct platform ID', () => {
    expect(adapter.platformId).toBe('twitter')
  })

  it('should identify feed pages', () => {
    expect(adapter.isFeedPage('https://twitter.com/home')).toBe(true)
    expect(adapter.isFeedPage('https://twitter.com/settings')).toBe(false)
  })

  // Add more tests for extraction logic
})
```

### Step 7: Update Message Origin Validation

In `src/background/index.ts`, add the platform's domain to the `ALLOWED_CONTENT_SCRIPT_ORIGINS` regex:

```typescript
const ALLOWED_CONTENT_SCRIPT_ORIGINS = /^https:\/\/(www\.)?(linkedin\.com|twitter\.com|x\.com)\//;
```

This security measure ensures the background script only accepts messages from authorized platform domains.

---

## Testing Requirements

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test tests/shared/validation.test.ts
```

### Test Structure

Tests mirror the source structure:

```
tests/
├── shared/           # Tests for shared utilities
├── platforms/        # Platform adapter tests
├── content/          # Content script tests
├── background/       # Background worker tests
├── sidepanel/        # Composable tests
└── integration/      # End-to-end flow tests
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  })

  it('should do something specific', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

### Mocking Chrome APIs

The test setup (`tests/setup.ts`) provides mocks for Chrome APIs:

```typescript
// Chrome storage is automatically mocked
await chrome.storage.sync.set({ key: 'value' })
const result = await chrome.storage.sync.get('key')
```

### What to Test

- **Unit tests**: Individual functions and composables
- **Integration tests**: Full workflow scenarios
- **Edge cases**: Error handling, empty states, invalid input

### PR Requirements

Before submitting a PR:

1. All existing tests must pass
2. New functionality must have tests
3. Test coverage should not decrease significantly

---

## Questions?

If you have questions about contributing:

1. Check existing issues and discussions
2. Open a new issue with the "question" label
3. Reach out via the contact info in README

Thank you for contributing to ReplyQueue!
