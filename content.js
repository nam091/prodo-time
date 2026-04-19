/* =============================================
   ProdoTime v2.2 — Content Script (Display Only)
   Timer state lives in background.js.
   ============================================= */
(function () {
  'use strict';
  if (document.getElementById('prodotime-root')) return;

  // ============ SVG ICONS ============
  const ICONS = {
    grip: `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>`,
    stopwatch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="M22 6l-3-3"/><line x1="12" y1="1" x2="12" y2="3"/></svg>`,
    timer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M12 14V10"/><circle cx="12" cy="14" r="8"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    tomato: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1"/><rect x="14" y="3" width="5" height="18" rx="1"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    lap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
    skip: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="3" height="16" rx="1"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    chevDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  };

  // ============ UTILITIES ============
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
    return `${pad(m % 60)}:${pad(s % 60)}`;
  };
  const fmtMs = (ms) => pad(Math.floor((ms % 1000) / 10));

  // ============ SETTINGS ============
  const SETTINGS_DEFAULTS = {
    autoShow: true, uiScale: 100, uiOpacity: 100,
    featStopwatch: true, featCountdown: true, featSps: true, featPomodoro: true,
    pomoFocus: 25, pomoShort: 5, pomoLong: 15, pomoSessions: 4,
    soundAlert: true, defaultTab: 'stopwatch',
  };
  let settings = { ...SETTINGS_DEFAULTS };

  // ============ LOCAL UI STATE ============
  let currentTab = 'stopwatch';
  let panelOpen = false;
  let lastState = null; // last snapshot from background

  // ============ SEND MESSAGE TO BACKGROUND ============
  function sendBg(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(resp);
      });
    });
  }

  // ============ BUILD DOM ============
  const root = document.createElement('div');
  root.id = 'prodotime-root';
  root.className = 'pt-visible';

  const savedPos = JSON.parse(localStorage.getItem('pt-pos') || 'null');
  root.style.top = savedPos ? savedPos.top + 'px' : '16px';
  root.style.left = savedPos ? savedPos.left + 'px' : 'calc(50% - 200px)';

  root.innerHTML = `
    <div class="pt-bar" id="ptBar">
      <div class="pt-wing pt-wing-left" id="ptWingLeft">
        <div class="pt-drag" id="ptDrag">${ICONS.grip}</div>
        <div class="pt-divider"></div>
        <button class="pt-tab-btn active" data-tab="stopwatch" title="Stopwatch">${ICONS.stopwatch}</button>
        <button class="pt-tab-btn" data-tab="countdown" title="Countdown">${ICONS.timer}</button>
        <button class="pt-tab-btn" data-tab="sps" title="SPS Calculator">${ICONS.zap}</button>
        <button class="pt-tab-btn" data-tab="pomodoro" title="Pomodoro">${ICONS.tomato}</button>
        <div class="pt-divider"></div>
      </div>

      <div class="pt-time-display" id="ptTimeDisplay">00:00<span class="pt-ms">.00</span></div>

      <button class="pt-ctrl-btn play" id="ptPlay" title="Start">${ICONS.play}</button>
      <button class="pt-ctrl-btn" id="ptReset" title="Reset">${ICONS.reset}</button>
      <button class="pt-ctrl-btn" id="ptExtra" title="Lap" style="display:none">${ICONS.lap}</button>

      <div class="pt-wing pt-wing-right" id="ptWingRight">
        <div class="pt-divider"></div>
        <button class="pt-ctrl-btn" id="ptExpand" title="Expand">${ICONS.chevDown}</button>
        <button class="pt-close" id="ptClose" title="Hide">${ICONS.x}</button>
      </div>
    </div>

    <div class="pt-panel" id="ptPanel">
      <div id="ptPanelContent"></div>
    </div>`;
  document.body.appendChild(root);

  // ============ REFS ============
  const $bar = root.querySelector('#ptBar');
  const $time = root.querySelector('#ptTimeDisplay');
  const $play = root.querySelector('#ptPlay');
  const $reset = root.querySelector('#ptReset');
  const $extra = root.querySelector('#ptExtra');
  const $expand = root.querySelector('#ptExpand');
  const $panel = root.querySelector('#ptPanel');
  const $panelContent = root.querySelector('#ptPanelContent');
  const $close = root.querySelector('#ptClose');

  // ============ TAB SWITCHING ============
  root.querySelectorAll('.pt-tab-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      root.querySelectorAll('.pt-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      const snap = await sendBg({ type: 'PT_SET_TAB', tab: currentTab });
      if (snap) renderSnapshot(snap);
      updatePanel();
    });
  });

  // ============ PLAY/PAUSE ============
  $play.addEventListener('click', async (e) => {
    e.stopPropagation();
    const snap = await sendBg({ type: 'PT_PLAY_PAUSE' });
    if (snap) {
      if (snap.needsInput) {
        panelOpen = true;
        $panel.classList.add('open');
        renderSnapshot(snap);
        updatePanel();
        return;
      }
      renderSnapshot(snap);
    }
  });

  // ============ RESET ============
  $reset.addEventListener('click', async (e) => {
    e.stopPropagation();
    const snap = await sendBg({ type: 'PT_RESET' });
    if (snap) renderSnapshot(snap);
    if (panelOpen) updatePanel();
  });

  // ============ EXTRA (LAP / SKIP) ============
  $extra.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (currentTab === 'stopwatch') {
      const snap = await sendBg({ type: 'PT_LAP' });
      if (snap) { lastState = snap; if (panelOpen) updatePanel(); }
    } else if (currentTab === 'pomodoro') {
      const snap = await sendBg({ type: 'PT_SKIP_POMO' });
      if (snap) renderSnapshot(snap);
      if (panelOpen) updatePanel();
    }
  });

  // ============ EXPAND PANEL ============
  $expand.addEventListener('click', (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    $panel.classList.toggle('open', panelOpen);
    updatePanel();
  });

  document.addEventListener('click', (e) => {
    if (panelOpen && !root.contains(e.target)) {
      panelOpen = false;
      $panel.classList.remove('open');
    }
  });

  // ============ CLOSE ============
  $close.addEventListener('click', (e) => {
    e.stopPropagation();
    root.classList.add('pt-hidden');
    root.classList.remove('pt-visible');
  });

  // ============ DRAG ============
  let isDragging = false, dragOffX = 0, dragOffY = 0;

  $bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    isDragging = true;
    dragOffX = e.clientX - root.offsetLeft;
    dragOffY = e.clientY - root.offsetTop;
    $bar.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffX));
    const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffY));
    root.style.left = x + 'px';
    root.style.top = y + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    $bar.classList.remove('dragging');
    localStorage.setItem('pt-pos', JSON.stringify({ top: root.offsetTop, left: root.offsetLeft }));
  });

  // ============ RENDER SNAPSHOT ============
  function renderSnapshot(snap) {
    lastState = snap;
    currentTab = snap.currentTab;

    // Sync tab buttons
    root.querySelectorAll('.pt-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === currentTab);
    });

    const isRunning = currentTab === 'stopwatch' ? snap.swRunning
      : currentTab === 'countdown' ? snap.cdRunning
      : currentTab === 'sps' ? snap.spsRunning
      : snap.pomoRunning;

    // Time
    let ms = 0;
    if (currentTab === 'stopwatch') ms = snap.swElapsed;
    else if (currentTab === 'countdown') ms = snap.cdRemain;
    else if (currentTab === 'sps') ms = snap.spsElapsed;
    else ms = snap.pomoRemain;
    $time.innerHTML = `${fmtTime(ms)}<span class="pt-ms">.${fmtMs(ms)}</span>`;
    $time.classList.toggle('running', isRunning);

    // Play/Pause
    $play.innerHTML = isRunning ? ICONS.pause : ICONS.play;
    $play.className = `pt-ctrl-btn ${isRunning ? 'pause' : 'play'}`;

    // Extra button
    if (currentTab === 'stopwatch') {
      $extra.style.display = 'flex';
      $extra.innerHTML = ICONS.lap;
      $extra.title = 'Lap';
    } else if (currentTab === 'pomodoro') {
      $extra.style.display = 'flex';
      $extra.innerHTML = ICONS.skip;
      $extra.title = 'Skip';
    } else {
      $extra.style.display = 'none';
    }

    // Compact mode: collapse wings
    const $wl = root.querySelector('#ptWingLeft');
    const $wr = root.querySelector('#ptWingRight');
    $wl.classList.toggle('pt-wing-collapsed', isRunning);
    $wr.classList.toggle('pt-wing-collapsed', isRunning);

    if (isRunning && panelOpen) {
      panelOpen = false;
      $panel.classList.remove('open');
    }
    if (!isRunning) applySettings();
    $reset.style.display = 'flex';
  }

  // ============ POLLING LOOP ============
  let pollTimer = null;
  let logCount = 0;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      const snap = await sendBg({ type: 'PT_GET_STATE' });
      if (snap) {
        if (logCount < 5 || (snap.swRunning && logCount % 20 === 0)) {
          console.log('[PT content] poll:', JSON.stringify({
            swRunning: snap.swRunning, swElapsed: snap.swElapsed,
            currentTab: snap.currentTab,
          }));
        }
        logCount++;
        renderSnapshot(snap);
      }
    }, 50);
  }

  // ============ PANEL CONTENT ============
  function updatePanel() {
    if (!panelOpen || !lastState) return;
    const snap = lastState;

    if (currentTab === 'stopwatch') {
      let lapsHTML = '';
      if (snap.swLaps && snap.swLaps.length) {
        let total = 0;
        lapsHTML = '<div class="pt-laps">';
        for (let i = snap.swLaps.length - 1; i >= 0; i--) {
          total = snap.swLaps.slice(0, i + 1).reduce((a, b) => a + b, 0);
          lapsHTML += `<div class="pt-lap-item"><span>#${i + 1}</span><span>${fmtTime(snap.swLaps[i])}.${fmtMs(snap.swLaps[i])}</span><span>${fmtTime(total)}</span></div>`;
        }
        lapsHTML += '</div>';
      }
      $panelContent.innerHTML = `
        <div class="pt-section-title">Stopwatch Laps</div>
        ${lapsHTML || '<div class="pt-info-text">Press the <b>Lap</b> button while the stopwatch is running to record your splits. Laps will appear here in reverse order.</div>'}`;
    }

    else if (currentTab === 'countdown') {
      const curH = Math.floor((snap.cdTotal / 1000) / 3600);
      const curM = Math.floor(((snap.cdTotal / 1000) % 3600) / 60);
      const curS = Math.floor((snap.cdTotal / 1000) % 60);
      $panelContent.innerHTML = `
        <div class="pt-section-title">Countdown Timer</div>
        <div class="pt-info-text">Choose a quick preset or set a custom duration below. The timer will notify you when it reaches zero.</div>
        <div class="pt-presets">
          <button class="pt-preset" data-sec="30">30s</button>
          <button class="pt-preset" data-sec="60">1m</button>
          <button class="pt-preset" data-sec="180">3m</button>
          <button class="pt-preset" data-sec="300">5m</button>
          <button class="pt-preset" data-sec="600">10m</button>
          <button class="pt-preset" data-sec="900">15m</button>
        </div>
        <div class="pt-input-row">
          <div class="pt-input-group"><input type="number" id="ptCdH" value="${curH}" min="0" max="23"><span class="pt-unit">h</span></div>
          <div class="pt-input-group"><input type="number" id="ptCdM" value="${curM || 5}" min="0" max="59"><span class="pt-unit">m</span></div>
          <div class="pt-input-group"><input type="number" id="ptCdS" value="${curS}" min="0" max="59"><span class="pt-unit">s</span></div>
        </div>
        <button class="pt-action-btn" id="ptCdSet">Set & Start Countdown</button>`;

      $panelContent.querySelectorAll('.pt-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sec = parseInt(btn.dataset.sec);
          $panelContent.querySelectorAll('.pt-preset').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          root.querySelector('#ptCdH').value = Math.floor(sec / 3600);
          root.querySelector('#ptCdM').value = Math.floor((sec % 3600) / 60);
          root.querySelector('#ptCdS').value = sec % 60;
        });
      });

      root.querySelector('#ptCdSet').addEventListener('click', async (e) => {
        e.stopPropagation();
        const h = parseInt(root.querySelector('#ptCdH').value) || 0;
        const m = parseInt(root.querySelector('#ptCdM').value) || 0;
        const s = parseInt(root.querySelector('#ptCdS').value) || 0;
        const totalMs = (h * 3600 + m * 60 + s) * 1000;
        if (totalMs > 0) {
          panelOpen = false;
          $panel.classList.remove('open');
          const snap = await sendBg({ type: 'PT_SET_COUNTDOWN', totalMs });
          if (snap) renderSnapshot(snap);
        }
      });
    }

    else if (currentTab === 'sps') {
      const resultHTML = snap.spsLastResult ? `
        <div class="pt-sps-result">
          <span class="pt-sps-value">${snap.spsLastResult.sps.toFixed(3)}</span>
          <span class="pt-sps-unit">sentences/sec</span>
        </div>
        <div class="pt-sps-detail">${snap.spsLastResult.sentences} sentences in ${snap.spsLastResult.seconds.toFixed(1)}s</div>
      ` : '';

      $panelContent.innerHTML = `
        <div class="pt-section-title">Sentences Per Second</div>
        <div class="pt-info-text">Calculate your reading or typing speed. Use the <b>Start (▶)</b> button on the main bar to measure time automatically, or enter the values manually.</div>
        <div class="pt-input-row" style="margin-bottom:12px">
          <div class="pt-input-group"><input type="number" id="ptSpsCount" placeholder="Sentences" min="0"></div>
          <div class="pt-input-group"><input type="number" id="ptSpsSecs" placeholder="Seconds" min="0" step="0.1" value="${snap.spsElapsed > 0 ? (snap.spsElapsed / 1000).toFixed(1) : ''}"></div>
        </div>
        <button class="pt-action-btn" id="ptSpsCalc">Calculate Speed</button>
        ${resultHTML}`;

      root.querySelector('#ptSpsCalc').addEventListener('click', async (e) => {
        e.stopPropagation();
        const sentences = parseFloat(root.querySelector('#ptSpsCount')?.value);
        let seconds;
        if (snap.spsElapsed > 0) seconds = snap.spsElapsed / 1000;
        else seconds = parseFloat(root.querySelector('#ptSpsSecs')?.value);
        if (!sentences || !seconds || seconds <= 0) return;
        const result = { sentences, seconds, sps: sentences / seconds };
        const s = await sendBg({ type: 'PT_CALC_SPS', result });
        if (s) { lastState = s; updatePanel(); }
      });
    }

    else if (currentTab === 'pomodoro') {
      let dotsHTML = '';
      for (let i = 0; i < snap.pomoSessions; i++) {
        const cls = i < snap.pomoCurrentNum - 1 ? 'done' : i === snap.pomoCurrentNum - 1 ? 'active' : '';
        dotsHTML += `<div class="pt-pomo-dot ${cls}"></div>`;
      }
      $panelContent.innerHTML = `
        <div class="pt-section-title">Pomodoro Timer</div>
        <div class="pt-info-text">Improve your productivity with focus sessions. The bar shows your current progress. You can skip any session with the <b>Skip (⏭)</b> button.</div>
        <div class="pt-pomo-dots">${dotsHTML}</div>
        <div class="pt-pomo-label">${snap.pomoIsFocus ? `<span>Focus</span> ${snap.pomoCurrentNum}/${snap.pomoSessions}` : `<span>Break</span> ${snap.pomoCurrentNum - 1}/${snap.pomoSessions}`}</div>
        <div style="margin-top:20px">
          <div class="pt-section-title">Pomodoro Settings</div>
          <div class="pt-input-row" style="margin-bottom:12px">
            <div class="pt-input-group"><input type="number" id="ptPomoF" value="${snap.pomoFocusMin}" min="1" max="90"><span class="pt-unit">focus</span></div>
            <div class="pt-input-group"><input type="number" id="ptPomoS" value="${snap.pomoShortMin}" min="1" max="30"><span class="pt-unit">short</span></div>
            <div class="pt-input-group"><input type="number" id="ptPomoL" value="${snap.pomoLongMin}" min="1" max="60"><span class="pt-unit">long</span></div>
          </div>
          <button class="pt-action-btn" id="ptPomoApply">Update Settings & Reset</button>
        </div>`;

      root.querySelector('#ptPomoApply')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const snap2 = await sendBg({
          type: 'PT_SET_POMO_SETTINGS',
          focusMin: parseInt(root.querySelector('#ptPomoF').value) || 25,
          shortMin: parseInt(root.querySelector('#ptPomoS').value) || 5,
          longMin: parseInt(root.querySelector('#ptPomoL').value) || 15,
          sessions: snap.pomoSessions,
        });
        if (snap2) renderSnapshot(snap2);
        updatePanel();
      });
    }
  }

  $bar.addEventListener('click', (e) => e.stopPropagation());
  $panel.addEventListener('click', (e) => e.stopPropagation());
  $panel.addEventListener('mousedown', (e) => e.stopPropagation());

  // ============ SETTINGS ============
  function applySettings() {
    const scale = settings.uiScale / 100;
    root.style.transform = scale === 1 ? '' : `scale(${scale})`;
    root.style.transformOrigin = 'top left';
    root.style.opacity = settings.uiOpacity / 100;

    if (!settings.autoShow) {
      root.classList.add('pt-hidden');
      root.classList.remove('pt-visible');
    }

    const featureMap = {
      stopwatch: settings.featStopwatch,
      countdown: settings.featCountdown,
      sps: settings.featSps,
      pomodoro: settings.featPomodoro,
    };
    root.querySelectorAll('.pt-tab-btn').forEach(btn => {
      btn.classList.toggle('pt-feat-hidden', featureMap[btn.dataset.tab] === false);
    });

    if (featureMap[currentTab] === false) {
      const first = Object.keys(featureMap).find(k => featureMap[k] !== false);
      if (first) {
        currentTab = first;
        sendBg({ type: 'PT_SET_TAB', tab: currentTab });
        root.querySelectorAll('.pt-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
      }
    }
  }

  // ============ MESSAGE LISTENERS ============
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PRODOTIME') {
      root.classList.toggle('pt-hidden');
      if (!root.classList.contains('pt-hidden')) root.classList.add('pt-visible');
    }
    if (msg.type === 'PT_SETTINGS_UPDATED') {
      Object.assign(settings, msg.settings);
      applySettings();
    }
    if (msg.type === 'PT_RESET_POSITION') {
      root.style.top = '16px';
      root.style.left = 'calc(50% - 200px)';
      localStorage.removeItem('pt-pos');
    }
  });

  // ============ INIT ============
  chrome.storage.sync.get(SETTINGS_DEFAULTS, (data) => {
    Object.assign(settings, data);
    applySettings();

    // Get initial state from background
    sendBg({ type: 'PT_GET_STATE' }).then((snap) => {
      if (snap) {
        renderSnapshot(snap);
        if (panelOpen) updatePanel();
      }
      // Start smart polling
      startPolling();
    });
  });

})();
