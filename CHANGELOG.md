# Changelog

All notable changes to ReplyQueue will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.2] - 2026-02-04

### Fixed

- Updated LinkedIn DOM selectors for February 2026 LinkedIn UI changes (CSS-in-JS with hashed class names)
- Post detection now uses stable `data-view-name` and `data-testid` attributes instead of class names
- Post ID extraction uses `componentkey` attribute instead of deprecated `data-urn`

## [1.1.1] - 2025-01-21

### Added

- Package scripts for Chrome Web Store submission (`scripts/package.ps1` for Windows, `scripts/package.sh` for macOS/Linux)

### Changed

- Disabled minification in production builds to speed up Chrome Web Store review process (unminified code is easier for reviewers to verify)

## [1.1.0] - 2025-01-19

### Added

- Selective AI matching: checkbox selection on queued posts to match only specific posts
- Individual "AI Match" button on each queued post for single-post matching
- Button dynamically changes from "AI Match All" to "AI Match Selected (N)" when posts are selected
- Dark mode support with three-state toggle (system/light/dark) in header, defaults to system preference
- Reset Extension button on setup wizard pages to abandon setup and clear any saved config values
- Reset Extension section in settings to clear all settings and return to setup wizard
- Configurable RSS feed limits: Max RSS Items (default 25) and Max Blog Items in AI Prompts (default 25) in Settings
- RSS Preferences collapsible section for Cache Duration, Max RSS Items, and Max Blog Items in AI Prompts settings

### Changed

- Moved Matching Preferences into collapsible section within AI Model settings
- Removed Jump button from post cards; View button (opens post in new tab) is now the only action
- Reply Suggestions section now collapsed by default; click header with chevron to expand
- Replied and Skipped tabs now hidden when empty, reducing visual clutter
- Filter tabs now display count below the label instead of inline

### Fixed

- Post content now preserves newlines and paragraph breaks instead of collapsing all whitespace into single spaces
- RSS feed validation now properly prompts for host permission during setup and settings, preventing CORS errors on first use
- AI model now correctly selected by default on Settings page after setup wizard (fixed missing vendor prefix in default model ID)
- ModelSelector now auto-selects the first available model if the stored model no longer exists or is filtered out
- Post status tags now display correct labels: "Matched" tab shows "Matched" badge (was "Pending"), "Unmatched" tab shows "Unmatched" badge (was "Queued")
- Side panel now detects posts when opened on already-loaded LinkedIn pages by programmatically injecting the content script if needed (previously required hard-refresh)
- AI Match now waits for both matching and heat check API calls to complete before switching to the Matched tab and clearing the "Analyzing..." state; the processing UI stays visible even when queue becomes empty mid-processing

## [1.0.0] - 2025-01-18

Initial release of ReplyQueue, a Chrome extension that helps content creators find relevant social media posts and generate AI-powered reply suggestions.

### Added

- LinkedIn feed monitoring and post extraction
- RSS feed integration for content matching
- AI-powered semantic matching via OpenRouter API
- Reply suggestion generation with customizable writing style
- Side panel UI with post cards, filtering, and settings

[Unreleased]: https://github.com/charlesjones-dev/replyqueue/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/charlesjones-dev/replyqueue/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/charlesjones-dev/replyqueue/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/charlesjones-dev/replyqueue/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/charlesjones-dev/replyqueue/releases/tag/v1.0.0
