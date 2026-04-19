/* =============================================
   ProdoTime Popup — Settings Controller
   ============================================= */

const DEFAULTS = {
  autoShow: true,
  uiScale: 100,
  uiOpacity: 100,
  featStopwatch: true,
  featCountdown: true,
  featSps: true,
  featPomodoro: true,
  pomoFocus: 25,
  pomoShort: 5,
  pomoLong: 15,
  pomoSessions: 4,
  soundAlert: true,
  defaultTab: 'stopwatch',
};

const $ = (id) => document.getElementById(id);

// ---- Load Settings ----
async function loadSettings() {
  const data = await chrome.storage.sync.get(DEFAULTS);

  $('autoShow').checked = data.autoShow;
  $('uiScale').value = data.uiScale;
  $('scaleValue').textContent = data.uiScale + '%';
  $('uiOpacity').value = data.uiOpacity;
  $('opacityValue').textContent = data.uiOpacity + '%';

  $('featStopwatch').checked = data.featStopwatch;
  $('featCountdown').checked = data.featCountdown;
  $('featSps').checked = data.featSps;
  $('featPomodoro').checked = data.featPomodoro;

  $('pomoFocus').value = data.pomoFocus;
  $('pomoShort').value = data.pomoShort;
  $('pomoLong').value = data.pomoLong;
  $('pomoSessions').value = data.pomoSessions;
  $('soundAlert').checked = data.soundAlert;
  $('defaultTab').value = data.defaultTab;
}

// ---- Save Settings (auto-save on change) ----
function save(key, value) {
  chrome.storage.sync.set({ [key]: value }, () => {
    showStatus('Settings saved');
    // Notify all content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'PT_SETTINGS_UPDATED',
          settings: { [key]: value },
        }).catch(() => {});
      });
    });
  });
}

function showStatus(msg) {
  const el = $('saveStatus');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 1500);
}

// ---- Event Listeners ----
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Toggle: Auto Show
  $('autoShow').addEventListener('change', (e) => {
    save('autoShow', e.target.checked);
  });

  // Range: UI Scale
  $('uiScale').addEventListener('input', (e) => {
    $('scaleValue').textContent = e.target.value + '%';
  });
  $('uiScale').addEventListener('change', (e) => {
    save('uiScale', parseInt(e.target.value));
  });

  // Range: Opacity
  $('uiOpacity').addEventListener('input', (e) => {
    $('opacityValue').textContent = e.target.value + '%';
  });
  $('uiOpacity').addEventListener('change', (e) => {
    save('uiOpacity', parseInt(e.target.value));
  });

  // Feature toggles
  ['featStopwatch', 'featCountdown', 'featSps', 'featPomodoro'].forEach((id) => {
    $(id).addEventListener('change', (e) => {
      save(id, e.target.checked);
    });
  });

  // Pomodoro defaults
  $('pomoFocus').addEventListener('change', (e) => {
    save('pomoFocus', Math.max(1, parseInt(e.target.value) || 25));
  });
  $('pomoShort').addEventListener('change', (e) => {
    save('pomoShort', Math.max(1, parseInt(e.target.value) || 5));
  });
  $('pomoLong').addEventListener('change', (e) => {
    save('pomoLong', Math.max(1, parseInt(e.target.value) || 15));
  });
  $('pomoSessions').addEventListener('change', (e) => {
    save('pomoSessions', Math.max(1, parseInt(e.target.value) || 4));
  });

  // Toggle: Sound Alert
  $('soundAlert').addEventListener('change', (e) => {
    save('soundAlert', e.target.checked);
  });

  // Select: Default Tab
  $('defaultTab').addEventListener('change', (e) => {
    save('defaultTab', e.target.value);
  });

  // Action: Toggle Overlay
  $('btnToggle').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PRODOTIME' }).catch(() => {});
      }
    });
  });

  // Action: Reset Position
  $('btnResetPos').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PT_RESET_POSITION' }).catch(() => {});
      }
    });
    showStatus('Position reset');
  });

  // Action: Reset All Settings
  $('btnResetAll').addEventListener('click', () => {
    if (confirm('Reset all settings to default?')) {
      chrome.storage.sync.set(DEFAULTS, () => {
        loadSettings();
        showStatus('All settings reset');
        // Notify content scripts
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'PT_SETTINGS_UPDATED',
              settings: DEFAULTS,
            }).catch(() => {});
          });
        });
      });
    }
  });
});
