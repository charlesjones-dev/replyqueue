# ReplyQueue

[![Vue 3](https://img.shields.io/badge/Vue-3.4-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Stop scrolling past engagement opportunities.** ReplyQueue watches your LinkedIn feed and surfaces posts that align with your blog content, so you can join conversations that matter.

## Why ReplyQueue?

Content creators spend hours scrolling social feeds hoping to find relevant discussions. ReplyQueue flips that model: connect your RSS feed, browse normally, and let AI surface the posts worth your time.

- **Passive Discovery** - Extracts posts as you scroll, no extra workflow
- **Smart Matching** - Keyword and AI-powered relevance scoring against your content
- **Reply Suggestions** - Generates responses that match your writing style
- **View Post** - One click to open matched posts in a new tab
- **Dark Mode** - System, light, or dark theme with one-click toggle
- **Privacy-First** - No analytics, no tracking, your data stays local
- **Extensible** - Platform adapter pattern makes adding new networks straightforward

## Quick Start

```bash
git clone https://github.com/charlesjones-dev/replyqueue.git
cd replyqueue
pnpm install && pnpm build
```

Then load `dist/` as an unpacked extension in Chrome. See [Installation](#installation) for detailed steps.

---

## Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/charlesjones-dev/replyqueue.git
   cd replyqueue
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the project directory

5. **Pin the extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin ReplyQueue for easy access

---

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 9+
- Chrome browser

### Commands

```bash
# Start development server with hot reload
pnpm dev

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build for production
pnpm build
```

### Loading the Development Build

1. Run `pnpm dev` to start the development server
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the `dist` folder
5. The extension will hot-reload as you make changes

---

## Architecture

ReplyQueue uses a modular architecture designed for cross-platform extensibility.

```
src/
├── platforms/           # Platform adapters (LinkedIn, future: Twitter, etc.)
│   ├── types.ts         # PlatformAdapter interface
│   ├── index.ts         # Platform registry
│   ├── linkedin/        # LinkedIn-specific implementation
│   └── _template/       # Template for adding new platforms
├── content/             # Content script (runs on social media pages)
│   ├── index.ts         # Entry point
│   ├── dom-observer.ts  # MutationObserver for feed changes
│   └── post-extractor.ts# Extracts posts using platform adapters
├── background/          # Service worker
│   ├── index.ts         # Message handling and orchestration
│   ├── rss-fetcher.ts   # RSS feed parsing and caching
│   ├── matcher.ts       # Keyword-based matching
│   └── openrouter.ts    # AI API client for semantic matching
├── sidepanel/           # Side panel UI (Vue 3)
│   ├── App.vue          # Root component
│   ├── views/           # SetupView, MainView, SettingsView
│   ├── components/      # Reusable UI components
│   └── composables/     # Vue composables for state management
└── shared/              # Shared utilities
    ├── types.ts         # TypeScript interfaces
    ├── constants.ts     # Configuration constants
    ├── storage.ts       # Chrome storage wrappers
    ├── validation.ts    # Input validation
    └── messages.ts      # Message passing types
```

### Data Flow

1. **Content Script** extracts posts from LinkedIn feed using the platform adapter
2. **Background Worker** receives posts via message passing and stores them
3. **RSS Fetcher** periodically fetches and parses your blog's RSS feed
4. **Matcher** compares extracted posts against RSS content using keywords and AI
5. **Side Panel** displays matched posts with relevance scores and reply suggestions

---

## Adding a New Platform Adapter

ReplyQueue is designed to support multiple social media platforms. To add a new platform:

1. **Copy the template directory**
   ```bash
   cp -r src/platforms/_template src/platforms/twitter
   ```

2. **Update `selectors.ts`**
   - Define CSS selectors for the platform's DOM structure
   - Include selectors for posts, authors, content, engagement metrics

3. **Implement the adapter in `adapter.ts`**
   - Update class name, `platformId`, and `platformName`
   - Implement `extractPost()` to parse the platform's DOM
   - Implement `getPostUrl()` for generating permalinks
   - Implement `scrollToPost()` for navigation

4. **Register the platform in `src/platforms/index.ts`**
   ```typescript
   import { TwitterAdapter } from './twitter/adapter'

   const adapters: PlatformAdapter[] = [
     new LinkedInAdapter(),
     new TwitterAdapter(),
   ]
   ```

5. **Update `manifest.json`**
   - Add the platform's URL patterns to `host_permissions`
   - Add content script matches

6. **Add tests**
   - Create `tests/platforms/twitter-extraction.test.ts`
   - Test post extraction with mock DOM elements

7. **Update allowed origins for message validation**
   - In `src/background/index.ts`, add the platform's domain to `ALLOWED_CONTENT_SCRIPT_ORIGINS`

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## Configuration Options

### Matching Preferences

| Option | Default | Options | Description |
|--------|---------|---------|-------------|
| Relevance Threshold | 30% | 10-90% | Minimum score for a post to be considered a match |
| Max Posts to Show | 20 | 10, 20, 30, 50, 100 | Maximum number of matched posts to display |
| RSS Cache Duration | 60 min | 15, 30, 60, 120, 240 | How long to cache RSS feed before refreshing |
| Max RSS Items | 25 | 10, 25, 50, 100 | Maximum items to fetch from RSS feed |
| Max Blog Items in AI Prompts | 25 | 10, 25, 50, All | Blog items included when AI evaluates posts |
| Blog Content Sent to AI | 2,500 chars | 1K, 2.5K, 5K, 10K, No limit | Amount of blog content included when matching |
| Social Post Content Sent to AI | 1,000 chars | 500, 1K, 2K, 3K, No limit | Amount of post content included when evaluating |

### AI Settings

| Option | Default | Description |
|--------|---------|-------------|
| Model | anthropic/claude-haiku-4.5 | OpenRouter model for semantic matching and reply generation |
| Writing Style Examples | - | Up to 10 examples of your previous comments to match your tone |
| Communication Preferences | - | Custom writing rules for AI-generated replies (e.g., formatting, tone) |

---

## Privacy & Data Handling

ReplyQueue is built with privacy as a core principle.

**What stays on your device:**
- All extracted post data
- Your configuration and preferences
- Writing style examples
- Cached RSS content

**What is sent externally:**
- **OpenRouter API** - Post content and RSS data for AI matching (only when you trigger a scan)
- **Your RSS Feed URL** - Fetched periodically to get your blog content

**No tracking:**
- No analytics
- No telemetry
- No usage data collection
- No third-party scripts

See [privacy-policy.md](./privacy-policy.md) for the full privacy policy.

---

## Security

ReplyQueue uses multiple layers of security tooling to catch vulnerabilities early.

### Static Analysis

| Tool | Purpose | Command |
|------|---------|---------|
| `eslint-plugin-security` | Detects common security anti-patterns in JS/TS | `pnpm lint` |
| `pnpm audit` | Scans dependencies for known CVEs | `pnpm audit:check` |
| Semgrep | SAST scanning for injection, XSS, and more | CI only (or Docker locally) |

### CI Integration

The `.github/workflows/security.yml` workflow runs Semgrep on every push and PR to `main`, using:
- `auto` - Semgrep's recommended security rules
- `p/javascript` - JavaScript-specific security patterns
- `p/typescript` - TypeScript-specific security patterns

### Running Security Checks Locally

```bash
# ESLint security rules (included in lint)
pnpm lint

# Dependency vulnerability scan
pnpm audit:check

# Semgrep via Docker
docker run --rm -v "$(pwd):/src" semgrep/semgrep semgrep scan --config auto --config p/javascript --config p/typescript /src
```

### Security Practices

- **Origin validation** - Background script validates message origins against allowlist
- **Input sanitization** - All user inputs validated before processing
- **No eval/Function** - Dynamic code execution patterns are blocked by ESLint
- **Secure storage** - API keys stored in `chrome.storage.local`, never exposed to content scripts
- **CSP compliance** - Extension follows Chrome's Content Security Policy requirements

---

## Troubleshooting

### Extension not loading
- Ensure you're loading the `dist` folder, not the project root
- Check for build errors: `pnpm build`
- Look for errors in `chrome://extensions/`

### Posts not being extracted
- Make sure you're on linkedin.com
- Scroll through the feed to trigger extraction
- Check the console for errors (right-click extension icon > "Inspect")

### API key validation failing
- Verify your OpenRouter API key starts with `sk-or-v1-`
- Check that your API key has credits available
- Try the key at [openrouter.ai](https://openrouter.ai)

### RSS feed not loading
- Ensure the URL returns valid RSS/Atom XML
- Try the URL in a browser to verify it's accessible
- Check for CORS issues in the console

### Matches not appearing
- Lower the relevance threshold in settings
- Ensure your RSS feed has recent content
- Try refreshing the feed manually

---

## Roadmap

### Planned Platforms
- [ ] Twitter/X
- [ ] Mastodon
- [ ] Bluesky
- [ ] Reddit

### Future Features
- [ ] Batch reply generation
- [ ] Reply history tracking
- [ ] Multiple RSS feed support
- [ ] Custom matching prompts
- [ ] Export matches to CSV
- [ ] Browser notifications for high-relevance matches

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Setting up the development environment
- Code style and linting
- Submitting issues and pull requests
- Adding new platform adapters

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Acknowledgments

- [OpenRouter](https://openrouter.ai) for AI model access
- [CRXJS](https://crxjs.dev/) for Vite Chrome extension integration
- [Vue.js](https://vuejs.org/) for the reactive UI framework
