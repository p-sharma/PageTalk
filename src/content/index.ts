import { extractPageContent } from './extractor';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    try {
      sendResponse({ type: 'PAGE_CONTENT_RESULT', payload: extractPageContent() });
    } catch (err) {
      sendResponse({ type: 'PAGE_CONTENT_ERROR', error: String(err) });
    }
  }
});
