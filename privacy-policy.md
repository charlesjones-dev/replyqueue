# Privacy Policy for ReplyQueue

**Last Updated:** January 2026

ReplyQueue is a Chrome extension that helps content creators find social media posts relevant to their blog content and generate reply suggestions. This privacy policy explains how we handle your data.

## Summary

- Your data stays on your device
- We do not collect analytics or usage data
- External API calls are made only when you initiate them
- You have full control over your data

---

## Data Collection and Storage

### What We Store Locally

All of the following data is stored locally on your device using Chrome's storage APIs and never leaves your browser unless explicitly noted:

| Data Type | Storage Location | Purpose |
|-----------|------------------|---------|
| OpenRouter API Key | chrome.storage.local | Authenticate with AI service (never synced for security) |
| RSS Feed URL | chrome.storage.sync | Fetch your blog content |
| Selected AI Model | chrome.storage.sync | Configure AI preferences |
| Matching Preferences | chrome.storage.sync | Configure relevance settings (threshold, cache TTL) |
| Model Filter Preferences | chrome.storage.sync | Filter available AI models by criteria |
| Communication Preferences | chrome.storage.sync | Custom instructions for reply tone/style |
| Content Char Limits | chrome.storage.sync | Configure how much content to send to AI |
| RSS Limits | chrome.storage.sync | Max RSS items to fetch and include in AI prompts |
| Theme Preference | chrome.storage.sync | Dark, light, or system theme setting |
| Writing Style Examples | chrome.storage.local | Personalize reply suggestions |
| Extracted Posts | chrome.storage.local | Store posts from social media feeds |
| Matched Posts | chrome.storage.local | Cache matching results with scores |
| Evaluated Post IDs | chrome.storage.local | Track which posts have been analyzed |
| Cached RSS Data | chrome.storage.local | Reduce network requests |
| Cached Model List | chrome.storage.local | OpenRouter model metadata |
| AI Match Cache | chrome.storage.local | Cache AI matching results to avoid re-processing |

### What We Do NOT Collect

- We do not collect any analytics or telemetry
- We do not track your browsing behavior
- We do not collect usage statistics
- We do not use any third-party analytics services
- We do not store any data on external servers owned by us

---

## External Services

ReplyQueue communicates with two external services. These communications only occur when you explicitly trigger them.

### OpenRouter API (openrouter.ai)

**When data is sent:**
- When you validate your API key during setup
- When you fetch the list of available AI models
- When you scan for relevant posts (AI matching)
- When you generate reply suggestions
- When heat check analyzes post tone/sentiment

**What data is sent:**
- Your API key (for authentication)
- Post content from your social media feed (for matching and tone analysis)
- RSS feed content summaries (for matching)
- Your writing style examples (if provided, for reply generation)
- Your communication preferences (if provided, for reply style customization)

**What data is NOT sent:**
- Your personal information
- Your browsing history
- Data from other tabs or websites

**OpenRouter's privacy policy:** [https://openrouter.ai/privacy](https://openrouter.ai/privacy)

### Your RSS Feed URL

**When data is sent:**
- When you test your RSS feed during setup
- Periodically when the extension fetches your blog content (based on your cache TTL setting)

**What data is sent:**
- A standard HTTP GET request to the URL you provide

**What data is received:**
- Your blog's public RSS/Atom feed content

---

## Data Retention

### Local Storage

- Data remains on your device until you explicitly delete it
- Uninstalling the extension removes all stored data
- You can clear cached data at any time via the Settings panel

### External Services

- We do not retain any data from your API calls
- OpenRouter processes requests according to their privacy policy
- Your RSS feed content is publicly available and fetched as-is

---

## Your Rights and Controls

### Access Your Data

All your data is stored locally and can be viewed:
1. Open Chrome DevTools (F12)
2. Go to Application > Storage > Extension Storage
3. View your stored configuration and cached data

### Delete Your Data

**Clear all extension data:**
1. Go to `chrome://extensions/`
2. Find ReplyQueue
3. Click "Remove"

**Clear cached data only:**
1. Open the extension's Settings panel
2. Use the "Clear Cache" button

**Reset extension (clear all settings and data):**
1. Open the extension's Settings panel
2. Scroll to "Reset Extension" section
3. Click "Reset Extension" to clear all data and return to setup wizard

### Export Your Data

Configuration data can be viewed in Chrome's storage inspector. Export functionality may be added in future versions.

---

## Permissions Explained

### Required Permissions

| Permission | Why We Need It |
|------------|----------------|
| `storage` | Store your configuration and cached data locally |
| `sidePanel` | Display the ReplyQueue interface |
| `activeTab` | Read the current tab to extract posts |

### Host Permissions

| Domain | Why We Need It |
|--------|----------------|
| `linkedin.com` | Extract posts from LinkedIn feeds |
| `openrouter.ai` | Make API calls for AI matching and reply generation |

### Optional Host Permissions

ReplyQueue requests permission to access your RSS feed URL when you configure it. This is an optional permission that you grant during setup or when changing your RSS feed URL. The extension will prompt you to allow access to your blog's domain (e.g., `https://yourblog.com/*`) before fetching your RSS feed. Denying this permission prompt will prevent the extension from working.

---

## Children's Privacy

ReplyQueue is not directed at children under 13 years of age. We do not knowingly collect personal information from children.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this document.

For significant changes, we will update the extension's version and changelog.

---

## Contact

If you have questions about this privacy policy or ReplyQueue's data practices:

- Open an issue on GitHub: [https://github.com/charlesjones-dev/replyqueue/issues](https://github.com/charlesjones-dev/replyqueue/issues)
- Email: Available on the developer's GitHub profile

---

## Open Source

ReplyQueue is open source software. You can review the complete source code to verify our privacy practices:

[https://github.com/charlesjones-dev/replyqueue](https://github.com/charlesjones-dev/replyqueue)
