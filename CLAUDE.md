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

- `src/background/index.ts` — Service worker. Opens the side panel on toolbar icon click via `chrome.sidePanel.open()`. Proxies `GET_PAGE_CONTENT` messages from the sidepanel to the active tab's content script.
- `src/content/index.ts` — Content script injected into every page (`<all_urls>`). Extracts page content via `src/content/extractor.ts` (Readability-based) and returns it to the background on request.
- `src/sidepanel/index.ts` + `src/sidepanel/index.html` — Side panel UI. On open: checks WebGPU availability, downloads and initializes the local LLM via `CreateMLCEngine` (Phi-3.5-mini-instruct-q4f16_1-MV) with a progress bar. After load, renders a chat interface. On first user message, lazily fetches page content via `GET_PAGE_CONTENT` and injects it (truncated to 3000 words) into the system prompt so the model answers as a casual friend about the current page. Subsequent messages reuse the cached page content. Conversation history is maintained in-memory and capped to the last 10 turns sent to the model. Responses stream token-by-token into the assistant bubble. Once a response completes, it is automatically spoken via the Web Speech API (`SpeechSynthesis`, rate 1.1) and a per-bubble speaker/stop icon button is revealed for replay or cancellation. TTS is silently absent if the browser does not support `speechSynthesis`.

**Build output** (`dist/`): each context compiles to a flat self-contained JS file (`background.js`, `content.js`, `sidepanel.js`). `HtmlWebpackPlugin` injects the sidepanel script into `sidepanel.html`; `CopyWebpackPlugin` copies `manifest.json` and `icons/`. No shared runtime chunks (`runtimeChunk: false`, `splitChunks: false`) — required for Chrome extensions.

**Key dependencies:**
- `@mlc-ai/web-llm` — in-browser LLM inference via WebGPU/WASM; ships its own TypeScript types
- `@mozilla/readability` — article extraction from the active page DOM
