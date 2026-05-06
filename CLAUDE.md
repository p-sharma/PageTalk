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

- `src/background/index.ts` — Service worker. Opens the side panel on toolbar icon click via `chrome.sidePanel.open()`. Proxies `GET_PAGE_CONTENT` messages from the sidepanel to the active tab's content script. Tracks the active tab URL (`activeTabUrl`) and sends `TAB_NAVIGATED` via `chrome.runtime.sendMessage` when the URL changes — triggered by both `chrome.tabs.onUpdated` (same-tab navigation, filtered to `status === 'complete'` + `tab.active`) and `chrome.tabs.onActivated` (tab switching). Deduplicates by URL before sending.

- `src/content/index.ts` — Content script injected into every page (`<all_urls>`). Extracts page content via `src/content/extractor.ts` (Readability-based) and returns it to the background on request.

- `src/sidepanel/index.ts` + `src/sidepanel/index.html` — Side panel UI. Startup branches on WebGPU availability and download state:

  **Startup flow:**
  - No WebGPU (`'gpu' in navigator` is false) → `renderUnsupported()` error screen.
  - `localStorage.getItem('pagetalk_model_downloaded') !== 'true'` (first-time) → `renderWelcome()`: explains the one-time 2–4 GB download, "Download and get started" button → `startDownload()` → `renderProgress()` with live percentage and ETA → on success, sets the flag and shows a 2-second `renderSuccess()` screen before transitioning to chat.
  - Flag is set (returning user) → `renderProgress()` loading bar while the model hydrates from IndexedDB cache → chat. On error, the flag is cleared so the welcome screen reappears next open.

  **ETA calculation (`handleDownloadProgress`):** Starts tracking when the first `InitProgressReport` with `text` containing "fetch" and `progress > 0` arrives. After 5+ seconds with a meaningful progress delta (> 0.005), computes `rate = progressDelta / elapsedSec` and shows `formatTimeRemaining((1 - progress) / rate)`. Falls back to raw `report.text` until enough data is available.

  **Chat interface:** Rendered by `renderChat()` after model load. Input row: textarea + disabled mic button (placeholder) + Send button. "Clear chat" button in `#chat-header`. On first user message, lazily fetches page content via `GET_PAGE_CONTENT` and injects it (truncated to 3000 words) as the system prompt. Subsequent messages reuse cached content. Conversation history is capped to the last 10 turns. `resetChat()` clears `history`, `pageContext`, the messages DOM, and any active TTS; called by the Clear button and the `TAB_NAVIGATED` listener.

  **Streaming and TTS:** While waiting for the first token, the assistant bubble shows three animated bouncing dots (`.thinking-indicator`); on the first token they hide and the text span reveals. Responses stream token-by-token. On completion, the response is spoken via `SpeechSynthesis` (rate 1.1) and a per-bubble speaker/stop button appears for replay or cancellation. TTS is silently skipped if `speechSynthesis` is absent.

**Build output** (`dist/`): each context compiles to a flat self-contained JS file (`background.js`, `content.js`, `sidepanel.js`). `HtmlWebpackPlugin` injects the sidepanel script into `sidepanel.html`; `CopyWebpackPlugin` copies `manifest.json` and `icons/`. No shared runtime chunks (`runtimeChunk: false`, `splitChunks: false`) — required for Chrome extensions.

**Key dependencies:**
- `@mlc-ai/web-llm` — in-browser LLM inference via WebGPU/WASM; ships its own TypeScript types
- `@mozilla/readability` — article extraction from the active page DOM
