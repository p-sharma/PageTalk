# PageTalk

Chat with any web page using a local LLM, running entirely in your browser via WebGPU.

## Requirements

- Node.js 18+
- Chrome 114+ (for Side Panel API support)

## Setup

```bash
# Install dependencies
npm install

# Generate placeholder icons (run once after cloning)
npm run icons
```

## Development

```bash
npm run dev
```

Webpack watches `src/` and rebuilds to `dist/` on every change.

## Production build

```bash
npm run build
```

## Loading in Chrome

1. Run `npm run build` (or have `npm run dev` running)
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `dist/` folder
5. Click the PageTalk icon in the toolbar — the side panel opens

After code changes in watch mode, go to `chrome://extensions` and click the reload button on the PageTalk card to pick up the new build.
