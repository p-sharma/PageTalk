# PageTalk

Chat with any web page using an LLM that runs entirely in your browser on WebGPU. The page text and your chat stay on your machine.

## Workflow

Idea → Claude → Notion PRD → Claude → Jira Tickets → Claude Code → Working code

## Requirements

- Node.js 20.9+
- Chrome 114+ (for the Side Panel API)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Webpack watches `src/` and rebuilds into `dist/` whenever you save.

## Production build

```bash
npm run build
```

## Loading in Chrome

1. Run `npm run build` (or keep `npm run dev` running)
2. Open `chrome://extensions`
3. Turn on Developer mode (toggle in the top right)
4. Click Load unpacked and pick the `dist/` folder
5. Click the PageTalk icon in the toolbar to open the side panel

Chrome doesn't pick up new builds on its own. After a rebuild, go to `chrome://extensions` and hit the reload button on the PageTalk card.

## Future improvements

### What the app can't do yet

There's no voice input. The mic button is there but disabled, so you have to type your questions, even though answers get read aloud.

The model only sees the first 1000 words of a page. Ask about something near the bottom of a long article and it may not know the answer, or worse, guess. Nothing in the UI tells you the page was cut off.

Some pages can't be read at all: `chrome://` pages, the Chrome Web Store, and any tab that was already open before you installed or reloaded the extension (those tabs have no content script until you refresh them).

Memory is short. Only the last 5 turns go to the model, so it forgets the start of a long conversation.

You need WebGPU and a one-time 2 to 4 GB model download. Phi-3.5-mini is small, and its answers are noticeably weaker than what you'd get from a hosted model. That's the price of running locally.

### Known issues in the code

When the page fetch fails and nothing is cached yet (usually the first message), `handleSend` quietly switches to a generic system prompt with no page content. The model then answers as if it had read the page when it hasn't. The UI should say the page couldn't be read.

The history window can start with an assistant message. `history` always ends with the latest user message, so its length is odd, and once a conversation passes 5 turns `history.slice(-(MAX_HISTORY_TURNS * 2))` begins on an assistant reply. Nobody has checked yet whether WebLLM's Phi-3.5 chat template rejects this or lets it through. It needs a test, and the slice should be adjusted so the window always starts with a user message.
