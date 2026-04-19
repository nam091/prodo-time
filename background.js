/* =============================================
   ProdoTime v2.2 — Background Timer Engine
   All timer state lives here, persists across tabs/reloads.
   ============================================= */

const TIMER_STATE_KEY = 'ptTimerState';

const DEFAULT_STATE = {
  currentTab: 'stopwatch',
  // Stopwatch
  swRunning: false, swStartTime: 0, swElapsed: 0, swLaps: [],
  // Countdown
  cdRunning: false, cdStartTime: 0, cdTotal: 0, cdRemainAtStart: 0,
  // SPS
  spsRunning: false, spsStartTime: 0, spsElapsed: 0, spsLastResult: null,
  // Pomodoro
  pomoRunning: false, pomoStartTime: 0, pomoTotal: 25*60*1000, pomoRemainAtStart: 25*60*1000,
  pomoSession: 0, pomoFocusMin: 25, pomoShortMin: 5, pomoLongMin: 15, pomoSessions: 4,
};

let state = { ...DEFAULT_STATE };

// ---- Load state on startup ----
let stateReady = false;
let pendingMessages = [];

chrome.storage.local.get(TIMER_STATE_KEY, (data) => {
  if (data[TIMER_STATE_KEY]) {
    Object.assign(state, data[TIMER_STATE_KEY]);
  }
  stateReady = true;
  // Process any queued messages
  pendingMessages.forEach(({ msg, sender, sendResponse }) => {
    handleMessage(msg, sender, sendResponse);
  });
  pendingMessages = [];
});

function saveState() {
  chrome.storage.local.set({ [TIMER_STATE_KEY]: state });
}

// ---- Computed values ----
function getSwElapsed() {
  if (state.swRunning) return Date.now() - state.swStartTime;
  return state.swElapsed;
}

function getCdRemain() {
  if (state.cdRunning) {
    const r = Math.max(0, state.cdRemainAtStart - (Date.now() - state.cdStartTime));
    if (r <= 0) {
      state.cdRunning = false;
      saveState();
    }
    return r;
  }
  return state.cdRemainAtStart;
}

function getSpsElapsed() {
  if (state.spsRunning) return Date.now() - state.spsStartTime;
  return state.spsElapsed;
}

function getPomoRemain() {
  if (state.pomoRunning) {
    const r = Math.max(0, state.pomoRemainAtStart - (Date.now() - state.pomoStartTime));
    if (r <= 0) {
      state.pomoRunning = false;
      advancePomoSession();
      saveState();
    }
    return r;
  }
  return state.pomoRemainAtStart;
}

function pomoIsFocus() { return state.pomoSession % 2 === 0; }
function pomoCurrentNum() { return Math.floor(state.pomoSession / 2) + 1; }

function advancePomoSession() {
  state.pomoSession++;
  if (state.pomoSession >= state.pomoSessions * 2) state.pomoSession = 0;
  if (state.pomoSession % 2 === 0) {
    state.pomoTotal = state.pomoFocusMin * 60 * 1000;
  } else {
    const isLong = pomoCurrentNum() >= state.pomoSessions;
    state.pomoTotal = (isLong ? state.pomoLongMin : state.pomoShortMin) * 60 * 1000;
  }
  state.pomoRemainAtStart = state.pomoTotal;
}

// ---- Get full snapshot for content scripts ----
function getSnapshot() {
  return {
    currentTab: state.currentTab,
    swRunning: state.swRunning,
    swElapsed: getSwElapsed(),
    swLaps: state.swLaps,
    cdRunning: state.cdRunning,
    cdRemain: getCdRemain(),
    cdTotal: state.cdTotal,
    spsRunning: state.spsRunning,
    spsElapsed: getSpsElapsed(),
    spsLastResult: state.spsLastResult,
    pomoRunning: state.pomoRunning,
    pomoRemain: getPomoRemain(),
    pomoTotal: state.pomoTotal,
    pomoSession: state.pomoSession,
    pomoSessions: state.pomoSessions,
    pomoIsFocus: pomoIsFocus(),
    pomoCurrentNum: pomoCurrentNum(),
    pomoFocusMin: state.pomoFocusMin,
    pomoShortMin: state.pomoShortMin,
    pomoLongMin: state.pomoLongMin,
  };
}

// ---- Message handling ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!stateReady) {
    pendingMessages.push({ msg, sender, sendResponse });
    return true; // keep channel open
  }
  return handleMessage(msg, sender, sendResponse);
});

function handleMessage(msg, sender, sendResponse) {
  switch (msg.type) {
    case 'PT_GET_STATE':
      sendResponse(getSnapshot());
      return true;

    case 'PT_SET_TAB':
      state.currentTab = msg.tab;
      saveState();
      sendResponse(getSnapshot());
      return true;

    case 'PT_PLAY_PAUSE': {
      const tab = state.currentTab;
      if (tab === 'stopwatch') {
        if (state.swRunning) {
          state.swElapsed = Date.now() - state.swStartTime;
          state.swRunning = false;
        } else {
          state.swStartTime = Date.now() - state.swElapsed;
          state.swRunning = true;
        }
      } else if (tab === 'countdown') {
        if (state.cdRunning) {
          state.cdRemainAtStart = Math.max(0, state.cdRemainAtStart - (Date.now() - state.cdStartTime));
          state.cdRunning = false;
        } else {
          if (state.cdRemainAtStart <= 0) {
            sendResponse({ needsInput: true, ...getSnapshot() });
            return true;
          }
          state.cdStartTime = Date.now();
          state.cdRunning = true;
        }
      } else if (tab === 'sps') {
        if (state.spsRunning) {
          state.spsElapsed = Date.now() - state.spsStartTime;
          state.spsRunning = false;
        } else {
          state.spsStartTime = Date.now() - state.spsElapsed;
          state.spsRunning = true;
        }
      } else if (tab === 'pomodoro') {
        if (state.pomoRunning) {
          state.pomoRemainAtStart = Math.max(0, state.pomoRemainAtStart - (Date.now() - state.pomoStartTime));
          state.pomoRunning = false;
        } else {
          state.pomoStartTime = Date.now();
          state.pomoRunning = true;
        }
      }
      saveState();
      sendResponse(getSnapshot());
      return true;
    }

    case 'PT_RESET': {
      const tab = state.currentTab;
      if (tab === 'stopwatch') {
        state.swRunning = false; state.swElapsed = 0; state.swLaps = [];
      } else if (tab === 'countdown') {
        state.cdRunning = false; state.cdRemainAtStart = 0; state.cdTotal = 0;
      } else if (tab === 'sps') {
        state.spsRunning = false; state.spsElapsed = 0; state.spsLastResult = null;
      } else if (tab === 'pomodoro') {
        state.pomoRunning = false; state.pomoSession = 0;
        state.pomoTotal = state.pomoFocusMin * 60 * 1000;
        state.pomoRemainAtStart = state.pomoTotal;
      }
      saveState();
      sendResponse(getSnapshot());
      return true;
    }

    case 'PT_LAP':
      if (state.swRunning) {
        const elapsed = getSwElapsed();
        const prev = state.swLaps.reduce((a, b) => a + b, 0);
        state.swLaps.push(elapsed - prev);
        saveState();
      }
      sendResponse(getSnapshot());
      return true;

    case 'PT_SKIP_POMO':
      state.pomoRunning = false;
      advancePomoSession();
      saveState();
      sendResponse(getSnapshot());
      return true;

    case 'PT_SET_COUNTDOWN':
      state.cdTotal = msg.totalMs;
      state.cdRemainAtStart = msg.totalMs;
      state.cdStartTime = Date.now();
      state.cdRunning = true;
      saveState();
      sendResponse(getSnapshot());
      return true;

    case 'PT_SET_POMO_SETTINGS':
      state.pomoFocusMin = msg.focusMin;
      state.pomoShortMin = msg.shortMin;
      state.pomoLongMin = msg.longMin;
      state.pomoSessions = msg.sessions || state.pomoSessions;
      state.pomoRunning = false; state.pomoSession = 0;
      state.pomoTotal = state.pomoFocusMin * 60 * 1000;
      state.pomoRemainAtStart = state.pomoTotal;
      saveState();
      sendResponse(getSnapshot());
      return true;

    case 'PT_CALC_SPS':
      state.spsLastResult = msg.result;
      saveState();
      sendResponse(getSnapshot());
      return true;

    default:
      return false;
  }
}

function stopAll() {
  if (state.swRunning) { state.swElapsed = Date.now() - state.swStartTime; state.swRunning = false; }
  if (state.cdRunning) { state.cdRemainAtStart = Math.max(0, state.cdRemainAtStart - (Date.now() - state.cdStartTime)); state.cdRunning = false; }
  if (state.spsRunning) { state.spsElapsed = Date.now() - state.spsStartTime; state.spsRunning = false; }
  if (state.pomoRunning) { state.pomoRemainAtStart = Math.max(0, state.pomoRemainAtStart - (Date.now() - state.pomoStartTime)); state.pomoRunning = false; }
  state.swElapsed = 0; state.swLaps = [];
  state.cdRemainAtStart = 0; state.cdTotal = 0;
  state.spsElapsed = 0; state.spsLastResult = null;
  state.pomoSession = 0; state.pomoTotal = state.pomoFocusMin * 60 * 1000; state.pomoRemainAtStart = state.pomoTotal;
}
