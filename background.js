// Background: toggle overlay visibility on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PRODOTIME' });
});
