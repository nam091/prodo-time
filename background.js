// Background service worker for ProdoTime
// Handles alarms and notifications

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer') {
    chrome.notifications.create('pomodoroNotification', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'ProdoTime',
      message: 'Pomodoro session completed! Time for a break 🎉',
      priority: 2
    });
  }
  if (alarm.name === 'countdownTimer') {
    chrome.notifications.create('countdownNotification', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'ProdoTime',
      message: 'Countdown finished! ⏰',
      priority: 2
    });
  }
});

// Keep service worker alive for timer state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(['timerState'], (result) => {
      sendResponse(result.timerState || null);
    });
    return true;
  }
  if (message.type === 'SAVE_STATE') {
    chrome.storage.local.set({ timerState: message.state });
    sendResponse({ ok: true });
    return true;
  }
});
