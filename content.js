/* =============================================
   ProdoTime v2 — Content Script (Overlay Bar)
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
  const DEFAULTS = {
    autoShow: true, uiScale: 100, uiOpacity: 100,
    pomoFocus: 25, pomoShort: 5, pomoLong: 15, pomoSessions: 4,
    soundAlert: true, defaultTab: 'stopwatch',
  };
  let settings = { ...DEFAULTS };

  // ============ STATE ============
  let currentTab = 'stopwatch';
  let panelOpen = false;

  // Stopwatch
  const sw = { running: false, start: 0, elapsed: 0, interval: null, laps: [] };
  // Countdown
  const cd = { running: false, start: 0, total: 0, remain: 0, interval: null };
  // SPS
  const sps = { timerRunning: false, start: 0, elapsed: 0, interval: null, lastResult: null };
  // Pomodoro
  const pomo = {
    running: false, start: 0, total: 25 * 60 * 1000, remain: 25 * 60 * 1000,
    interval: null, session: 0, focusMin: 25, shortMin: 5, longMin: 15, sessions: 4,
    get isFocus() { return this.session % 2 === 0; },
    get currentNum() { return Math.floor(this.session / 2) + 1; },
  };

  // ============ BUILD DOM ============
  const root = document.createElement('div');
  root.id = 'prodotime-root';
  root.className = 'pt-visible';

  // Saved position
  const savedPos = JSON.parse(localStorage.getItem('pt-pos') || 'null');
  root.style.top = savedPos ? savedPos.top + 'px' : '16px';
  root.style.left = savedPos ? savedPos.left + 'px' : 'calc(50% - 200px)';

  root.innerHTML = buildHTML();
  document.body.appendChild(root);

  function buildHTML() {
    return `
    <div class="pt-bar" id="ptBar">
      <div class="pt-drag" id="ptDrag">${ICONS.grip}</div>
      <div class="pt-divider"></div>

      <button class="pt-tab-btn active" data-tab="stopwatch" title="Stopwatch">${ICONS.stopwatch}</button>
      <button class="pt-tab-btn" data-tab="countdown" title="Countdown">${ICONS.timer}</button>
      <button class="pt-tab-btn" data-tab="sps" title="SPS Calculator">${ICONS.zap}</button>
      <button class="pt-tab-btn" data-tab="pomodoro" title="Pomodoro">${ICONS.tomato}</button>

      <div class="pt-divider"></div>

      <div class="pt-time-display" id="ptTimeDisplay">00:00<span class="pt-ms">.00</span></div>

      <div class="pt-divider"></div>

      <button class="pt-ctrl-btn play" id="ptPlay" title="Start">${ICONS.play}</button>
      <button class="pt-ctrl-btn" id="ptReset" title="Reset">${ICONS.reset}</button>
      <button class="pt-ctrl-btn" id="ptExtra" title="Lap" style="display:none">${ICONS.lap}</button>

      <div class="pt-divider"></div>

      <button class="pt-ctrl-btn" id="ptExpand" title="Expand">${ICONS.chevDown}</button>
      <button class="pt-close" id="ptClose" title="Hide">${ICONS.x}</button>
    </div>

    <!-- Expandable Panel -->
    <div class="pt-panel" id="ptPanel">
      <div id="ptPanelContent"></div>
    </div>`;
  }

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

  // ============ TABS ============
  root.querySelectorAll('.pt-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      root.querySelectorAll('.pt-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      stopAll();
      updateDisplay();
      updatePanel();
    });
  });

  function stopAll() {
    // Stop any running timers when switching tabs
    if (sw.running) { sw.running = false; clearInterval(sw.interval); }
    if (cd.running) { cd.running = false; clearInterval(cd.interval); }
    if (sps.timerRunning) { sps.timerRunning = false; clearInterval(sps.interval); }
    if (pomo.running) { pomo.running = false; clearInterval(pomo.interval); }
    sw.elapsed = 0; sw.laps = [];
    cd.remain = 0; cd.total = 0;
    sps.elapsed = 0; sps.lastResult = null;
    pomo.session = 0; pomo.remain = pomo.focusMin * 60 * 1000; pomo.total = pomo.remain;
  }

  // ============ PLAY / PAUSE ============
  $play.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTab === 'stopwatch') toggleStopwatch();
    else if (currentTab === 'countdown') toggleCountdown();
    else if (currentTab === 'sps') toggleSpsTimer();
    else if (currentTab === 'pomodoro') togglePomodoro();
  });

  $reset.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTab === 'stopwatch') resetStopwatch();
    else if (currentTab === 'countdown') resetCountdown();
    else if (currentTab === 'sps') resetSpsTimer();
    else if (currentTab === 'pomodoro') resetPomodoro();
  });

  $extra.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTab === 'stopwatch') lapStopwatch();
    else if (currentTab === 'pomodoro') skipPomodoro();
  });

  // ============ EXPAND PANEL ============
  $expand.addEventListener('click', (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    $panel.classList.toggle('open', panelOpen);
    updatePanel();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (panelOpen && !root.contains(e.target)) {
      panelOpen = false;
      $panel.classList.remove('open');
    }
  });

  // ============ CLOSE / TOGGLE ============
  $close.addEventListener('click', (e) => {
    e.stopPropagation();
    root.classList.add('pt-hidden');
    root.classList.remove('pt-visible');
  });



  // ============ DRAG ============
  let isDragging = false, dragOffX = 0, dragOffY = 0;

  $bar.addEventListener('mousedown', (e) => {
    // Don't drag if clicking buttons
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
    localStorage.setItem('pt-pos', JSON.stringify({
      top: root.offsetTop,
      left: root.offsetLeft,
    }));
  });

  // ============ STOPWATCH ============
  function toggleStopwatch() {
    if (sw.running) {
      sw.running = false;
      sw.elapsed = performance.now() - sw.start;
      clearInterval(sw.interval);
    } else {
      sw.running = true;
      sw.start = performance.now() - sw.elapsed;
      sw.interval = setInterval(tickStopwatch, 33);
    }
    updateDisplay();
  }

  function tickStopwatch() {
    sw.elapsed = performance.now() - sw.start;
    renderTime(sw.elapsed, sw.running);
  }

  function resetStopwatch() {
    sw.running = false; clearInterval(sw.interval);
    sw.elapsed = 0; sw.laps = [];
    updateDisplay();
    if (panelOpen) updatePanel();
  }

  function lapStopwatch() {
    if (!sw.running) return;
    const prev = sw.laps.reduce((a, b) => a + b, 0);
    sw.laps.push(sw.elapsed - prev);
    if (panelOpen) updatePanel();
  }

  // ============ COUNTDOWN ============
  function toggleCountdown() {
    if (cd.running) {
      cd.running = false;
      clearInterval(cd.interval);
    } else {
      if (cd.remain <= 0) {
        // Get from panel inputs
        cd.total = getCountdownInputMs();
        if (cd.total <= 0) { panelOpen = true; $panel.classList.add('open'); updatePanel(); return; }
        cd.remain = cd.total;
      }
      cd.running = true;
      cd.start = performance.now();
      const startRemain = cd.remain;
      cd.interval = setInterval(() => {
        cd.remain = Math.max(0, startRemain - (performance.now() - cd.start));
        renderTime(cd.remain, cd.running);
        if (cd.remain <= 0) {
          cd.running = false; clearInterval(cd.interval);
          updateDisplay();
        }
      }, 50);
    }
    updateDisplay();
  }

  function resetCountdown() {
    cd.running = false; clearInterval(cd.interval);
    cd.remain = 0; cd.total = 0;
    updateDisplay();
  }

  function getCountdownInputMs() {
    const h = parseInt(root.querySelector('#ptCdH')?.value) || 0;
    const m = parseInt(root.querySelector('#ptCdM')?.value) || 0;
    const s = parseInt(root.querySelector('#ptCdS')?.value) || 0;
    return (h * 3600 + m * 60 + s) * 1000;
  }

  // ============ SPS TIMER ============
  function toggleSpsTimer() {
    if (sps.timerRunning) {
      sps.timerRunning = false; clearInterval(sps.interval);
      sps.elapsed = performance.now() - sps.start;
    } else {
      sps.timerRunning = true;
      sps.start = performance.now() - sps.elapsed;
      sps.interval = setInterval(() => {
        sps.elapsed = performance.now() - sps.start;
        renderTime(sps.elapsed, true);
      }, 100);
    }
    updateDisplay();
    if (panelOpen) updatePanel();
  }

  function resetSpsTimer() {
    sps.timerRunning = false; clearInterval(sps.interval);
    sps.elapsed = 0; sps.lastResult = null;
    updateDisplay();
    if (panelOpen) updatePanel();
  }

  function calcSps() {
    const sentences = parseFloat(root.querySelector('#ptSpsCount')?.value);
    let seconds;
    if (sps.elapsed > 0) {
      seconds = sps.elapsed / 1000;
    } else {
      seconds = parseFloat(root.querySelector('#ptSpsSecs')?.value);
    }
    if (!sentences || !seconds || seconds <= 0) return;
    sps.lastResult = { sentences, seconds, sps: sentences / seconds };
    updatePanel();
  }

  // ============ POMODORO ============
  function togglePomodoro() {
    if (pomo.running) {
      pomo.running = false; clearInterval(pomo.interval);
    } else {
      pomo.running = true;
      pomo.start = performance.now();
      const startRemain = pomo.remain;
      pomo.interval = setInterval(() => {
        pomo.remain = Math.max(0, startRemain - (performance.now() - pomo.start));
        renderTime(pomo.remain, true);
        if (pomo.remain <= 0) {
          pomo.running = false; clearInterval(pomo.interval);
          nextPomoSession();
          updateDisplay();
          if (panelOpen) updatePanel();
        }
      }, 100);
    }
    updateDisplay();
  }

  function resetPomodoro() {
    pomo.running = false; clearInterval(pomo.interval);
    pomo.session = 0;
    pomo.total = pomo.focusMin * 60 * 1000;
    pomo.remain = pomo.total;
    updateDisplay();
    if (panelOpen) updatePanel();
  }

  function skipPomodoro() {
    pomo.running = false; clearInterval(pomo.interval);
    nextPomoSession();
    updateDisplay();
    if (panelOpen) updatePanel();
  }

  function nextPomoSession() {
    pomo.session++;
    if (pomo.session >= pomo.sessions * 2) pomo.session = 0;
    if (pomo.isFocus) {
      pomo.total = pomo.focusMin * 60 * 1000;
    } else {
      const isLong = pomo.currentNum >= pomo.sessions;
      pomo.total = (isLong ? pomo.longMin : pomo.shortMin) * 60 * 1000;
    }
    pomo.remain = pomo.total;
  }

  // ============ RENDER ============
  function renderTime(ms, running) {
    $time.innerHTML = `${fmtTime(ms)}<span class="pt-ms">.${fmtMs(ms)}</span>`;
    $time.classList.toggle('running', !!running);
  }

  function updateDisplay() {
    const isRunning = currentTab === 'stopwatch' ? sw.running
      : currentTab === 'countdown' ? cd.running
      : currentTab === 'sps' ? sps.timerRunning
      : pomo.running;

    // Play/Pause button
    $play.innerHTML = isRunning ? ICONS.pause : ICONS.play;
    $play.className = `pt-ctrl-btn ${isRunning ? 'pause' : 'play'}`;
    $play.title = isRunning ? 'Pause' : 'Start';

    // Extra button
    if (currentTab === 'stopwatch') {
      $extra.style.display = sw.running ? 'flex' : 'none';
      $extra.innerHTML = ICONS.lap;
      $extra.title = 'Lap';
    } else if (currentTab === 'pomodoro') {
      $extra.style.display = 'flex';
      $extra.innerHTML = ICONS.skip;
      $extra.title = 'Skip';
    } else {
      $extra.style.display = 'none';
    }

    // Time display
    if (!isRunning) {
      let ms = 0;
      if (currentTab === 'stopwatch') ms = sw.elapsed;
      else if (currentTab === 'countdown') ms = cd.remain;
      else if (currentTab === 'sps') ms = sps.elapsed;
      else ms = pomo.remain;
      renderTime(ms, false);
    }
  }

  function updatePanel() {
    if (!panelOpen) return;

    if (currentTab === 'stopwatch') {
      let lapsHTML = '';
      if (sw.laps.length) {
        let total = 0;
        lapsHTML = '<div class="pt-laps">';
        for (let i = sw.laps.length - 1; i >= 0; i--) {
          total = sw.laps.slice(0, i + 1).reduce((a, b) => a + b, 0);
          lapsHTML += `<div class="pt-lap-item"><span>#${i + 1}</span><span>${fmtTime(sw.laps[i])}.${fmtMs(sw.laps[i])}</span><span>${fmtTime(total)}</span></div>`;
        }
        lapsHTML += '</div>';
      }
      $panelContent.innerHTML = `
        <div class="pt-section-title">Stopwatch Laps</div>
        ${lapsHTML || '<div class="pt-info-text">Press the <b>Lap</b> button while the stopwatch is running to record your splits. Laps will appear here in reverse order.</div>'}`;
    }

    else if (currentTab === 'countdown') {
      const curH = Math.floor((cd.total / 1000) / 3600);
      const curM = Math.floor(((cd.total / 1000) % 3600) / 60);
      const curS = Math.floor((cd.total / 1000) % 60);
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

      // Preset clicks
      $panelContent.querySelectorAll('.pt-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sec = parseInt(btn.dataset.sec);
          $panelContent.querySelectorAll('.pt-preset').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = sec % 60;
          root.querySelector('#ptCdH').value = h;
          root.querySelector('#ptCdM').value = m;
          root.querySelector('#ptCdS').value = s;
        });
      });

      root.querySelector('#ptCdSet').addEventListener('click', (e) => {
        e.stopPropagation();
        cd.total = getCountdownInputMs();
        cd.remain = cd.total;
        if (cd.total > 0) {
          panelOpen = false;
          $panel.classList.remove('open');
          toggleCountdown();
        }
      });
    }

    else if (currentTab === 'sps') {
      const resultHTML = sps.lastResult ? `
        <div class="pt-sps-result">
          <span class="pt-sps-value">${sps.lastResult.sps.toFixed(3)}</span>
          <span class="pt-sps-unit">sentences/sec</span>
        </div>
        <div class="pt-sps-detail">${sps.lastResult.sentences} sentences in ${sps.lastResult.seconds.toFixed(1)}s</div>
      ` : '';

      $panelContent.innerHTML = `
        <div class="pt-section-title">Sentences Per Second</div>
        <div class="pt-info-text">Calculate your reading or typing speed. Use the <b>Start (▶)</b> button on the main bar to measure time automatically, or enter the values manually.</div>
        <div class="pt-input-row" style="margin-bottom:12px">
          <div class="pt-input-group"><input type="number" id="ptSpsCount" placeholder="Sentences" min="0"></div>
          <div class="pt-input-group"><input type="number" id="ptSpsSecs" placeholder="Seconds" min="0" step="0.1" value="${sps.elapsed > 0 ? (sps.elapsed / 1000).toFixed(1) : ''}"></div>
        </div>
        <button class="pt-action-btn" id="ptSpsCalc">Calculate Speed</button>
        ${resultHTML}`;

      root.querySelector('#ptSpsCalc').addEventListener('click', (e) => {
        e.stopPropagation();
        calcSps();
      });
    }

    else if (currentTab === 'pomodoro') {
      let dotsHTML = '';
      for (let i = 0; i < pomo.sessions; i++) {
        const cls = i < pomo.currentNum - 1 ? 'done' : i === pomo.currentNum - 1 ? 'active' : '';
        dotsHTML += `<div class="pt-pomo-dot ${cls}"></div>`;
      }
      $panelContent.innerHTML = `
        <div class="pt-section-title">Pomodoro Timer</div>
        <div class="pt-info-text">Improve your productivity with focus sessions. The bar shows your current progress. You can skip any session with the <b>Skip (⏭)</b> button.</div>
        <div class="pt-pomo-dots">${dotsHTML}</div>
        <div class="pt-pomo-label">${pomo.isFocus ? `<span>Focus</span> ${pomo.currentNum}/${pomo.sessions}` : `<span>Break</span> ${pomo.currentNum - 1}/${pomo.sessions}`}</div>
        <div style="margin-top:20px">
          <div class="pt-section-title">Pomodoro Settings</div>
          <div class="pt-input-row" style="margin-bottom:12px">
            <div class="pt-input-group"><input type="number" id="ptPomoF" value="${pomo.focusMin}" min="1" max="90"><span class="pt-unit">focus</span></div>
            <div class="pt-input-group"><input type="number" id="ptPomoS" value="${pomo.shortMin}" min="1" max="30"><span class="pt-unit">short</span></div>
            <div class="pt-input-group"><input type="number" id="ptPomoL" value="${pomo.longMin}" min="1" max="60"><span class="pt-unit">long</span></div>
          </div>
          <button class="pt-action-btn" id="ptPomoApply">Update Settings & Reset</button>
        </div>`;

      root.querySelector('#ptPomoApply')?.addEventListener('click', (e) => {
        e.stopPropagation();
        pomo.focusMin = parseInt(root.querySelector('#ptPomoF').value) || 25;
        pomo.shortMin = parseInt(root.querySelector('#ptPomoS').value) || 5;
        pomo.longMin = parseInt(root.querySelector('#ptPomoL').value) || 15;
        resetPomodoro();
      });
    }
  }

  // Prevent bar clicks from bubbling
  $bar.addEventListener('click', (e) => e.stopPropagation());
  $panel.addEventListener('click', (e) => e.stopPropagation());
  $panel.addEventListener('mousedown', (e) => e.stopPropagation());

  // ============ SETTINGS LISTENERS ============
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PRODOTIME') {
      root.classList.toggle('pt-hidden');
      if (!root.classList.contains('pt-hidden')) {
        root.classList.add('pt-visible');
      }
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

  function applySettings() {
    // Scale
    const scale = settings.uiScale / 100;
    root.style.transform = scale === 1 ? '' : `scale(${scale})`;
    root.style.transformOrigin = 'top left';

    // Opacity
    root.style.opacity = settings.uiOpacity / 100;

    // Auto Show
    if (!settings.autoShow) {
      root.classList.add('pt-hidden');
      root.classList.remove('pt-visible');
    }

    // Pomodoro defaults (only if not running)
    if (!pomo.running) {
      pomo.focusMin = settings.pomoFocus;
      pomo.shortMin = settings.pomoShort;
      pomo.longMin = settings.pomoLong;
      pomo.sessions = settings.pomoSessions;
    }
  }

  // ============ INIT ============
  chrome.storage.sync.get(DEFAULTS, (data) => {
    Object.assign(settings, data);
    currentTab = settings.defaultTab || 'stopwatch';

    // Set active tab button
    root.querySelectorAll('.pt-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === currentTab);
    });

    // Apply pomodoro defaults
    pomo.focusMin = settings.pomoFocus;
    pomo.shortMin = settings.pomoShort;
    pomo.longMin = settings.pomoLong;
    pomo.sessions = settings.pomoSessions;
    pomo.total = pomo.focusMin * 60 * 1000;
    pomo.remain = pomo.total;

    applySettings();
    updateDisplay();
  });

})();
