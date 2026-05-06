chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

let activeTabUrl = '';

function notifyNavigation(url: string): void {
  if (url === activeTabUrl) return;
  activeTabUrl = url;
  chrome.runtime.sendMessage({ type: 'TAB_NAVIGATED', url }).catch(() => {
    // Sidepanel not open — ignore
  });
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active) return;
  notifyNavigation(tab.url ?? '');
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    notifyNavigation(tab.url ?? '');
  } catch {
    // Tab may have been closed
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId === undefined) {
        sendResponse({ type: 'PAGE_CONTENT_ERROR', error: 'No active tab found' });
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            type: 'PAGE_CONTENT_ERROR',
            error: chrome.runtime.lastError.message ?? 'Content script unreachable',
          });
          return;
        }
        sendResponse(response);
      });
    });
    return true; // async: keeps channel open across tabs.query + tabs.sendMessage callbacks
  }
});
