# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # webpack watch mode (development, with source maps)
npm run build        # production build to dist/
npm run icons        # regenerate placeholder icons in icons/
```

After any build, reload the extension in Chrome at `chrome://extensions` by clicking the reload button on the PageTalk card.

## Architecture

**Manifest V3** Chrome extension with three execution contexts compiled independently by Webpack:

- `src/background/index.ts` — Service worker. Currently opens the side panel on toolbar icon click via `chrome.sidePanel.open()`. Long-term home for LLM session management using `@mlc-ai/web-llm`.
- `src/content/index.ts` — Content script injected into every page (`<all_urls>`). Intended for page content extraction using `@mozilla/readability`, forwarding results to the side panel via `chrome.storage`.
- `src/sidepanel/index.ts` + `src/sidepanel/index.html` — Side panel UI. Rendered when the extension icon is clicked.

**Build output** (`dist/`): each context compiles to a flat self-contained JS file (`background.js`, `content.js`, `sidepanel.js`). `HtmlWebpackPlugin` injects the sidepanel script into `sidepanel.html`; `CopyWebpackPlugin` copies `manifest.json` and `icons/`. No shared runtime chunks (`runtimeChunk: false`, `splitChunks: false`) — required for Chrome extensions.

**Key dependencies:**
- `@mlc-ai/web-llm` — in-browser LLM inference via WebGPU/WASM; ships its own TypeScript types
- `@mozilla/readability` — article extraction from the active page DOM
