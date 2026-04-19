// ProdoTime Background Service Worker
// Popup handles icon click, so no onClicked listener needed.

// Forward messages between popup and content scripts if needed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PT_TOGGLE_FROM_POPUP') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PRODOTIME' }).catch(() => {});
      }
    });
  }
});
