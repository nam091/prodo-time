/* ============================================
   ProdoTime - Main Application Logic
   ============================================ */

(function () {
  'use strict';

  // ============ UTILITIES ============
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const CIRCUMFERENCE = 2 * Math.PI * 90; // ring radius = 90

  function padZero(n, digits = 2) {
    return String(Math.floor(n)).padStart(digits, '0');
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${padZero(min)}:${padZero(sec)}`;
  }

  function formatTimeFull(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (hrs > 0) return `${padZero(hrs)}:${padZero(min)}:${padZero(sec)}`;
    return `${padZero(min)}:${padZero(sec)}`;
  }

  function formatMs(ms) {
    return padZero(Math.floor((ms % 1000) / 10));
  }

  function formatDate(date) {
    const d = new Date(date);
    const day = padZero(d.getDate());
    const month = padZero(d.getMonth() + 1);
    const hours = padZero(d.getHours());
    const minutes = padZero(d.getMinutes());
    return `${day}/${month} ${hours}:${minutes}`;
  }

  // ============ THEME ============
  function initTheme() {
    const saved = localStorage.getItem('prodotime-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    $('#btnTheme').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('prodotime-theme', next);
    });
  }

  // ============ TABS ============
  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        $$('.panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const panelId = 'panel' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
        const panel = $(`#${panelId}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ============ STOPWATCH ============
  const stopwatch = {
    running: false,
    startTime: 0,
    elapsed: 0,
    interval: null,
    laps: [],

    init() {
      $('#swStart').addEventListener('click', () => this.toggle());
      $('#swReset').addEventListener('click', () => this.reset());
      $('#swLap').addEventListener('click', () => this.lap());
    },

    toggle() {
      if (this.running) {
        this.pause();
      } else {
        this.start();
      }
    },

    start() {
      this.running = true;
      this.startTime = performance.now() - this.elapsed;
      this.interval = setInterval(() => this.tick(), 33);
      this.updateButtons();
    },

    pause() {
      this.running = false;
      this.elapsed = performance.now() - this.startTime;
      clearInterval(this.interval);
      this.updateButtons();
    },

    reset() {
      this.running = false;
      this.elapsed = 0;
      this.laps = [];
      clearInterval(this.interval);
      $('#swTime').textContent = '00:00';
      $('#swMs').textContent = '.00';
      $('#swRing').style.strokeDashoffset = CIRCUMFERENCE;
      $('#lapsList').innerHTML = '';
      $('#lapsHeader').style.display = 'none';
      this.updateButtons();
    },

    lap() {
      const lapTime = this.elapsed - (this.laps.length > 0 ? this.laps.reduce((a, b) => a + b, 0) : 0);
      this.laps.push(lapTime);
      this.renderLaps();
    },

    tick() {
      this.elapsed = performance.now() - this.startTime;
      const ms = this.elapsed;
      $('#swTime').textContent = formatTime(ms);
      $('#swMs').textContent = '.' + formatMs(ms);

      // Ring — full rotation every 60 seconds
      const secProgress = (ms % 60000) / 60000;
      const offset = CIRCUMFERENCE - secProgress * CIRCUMFERENCE;
      $('#swRing').style.strokeDashoffset = offset;
    },

    updateButtons() {
      const startBtn = $('#swStart');
      if (this.running) {
        startBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pause`;
        startBtn.classList.add('running');
      } else {
        startBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${this.elapsed > 0 ? 'Resume' : 'Start'}`;
        startBtn.classList.remove('running');
      }
      $('#swReset').disabled = !this.elapsed;
      $('#swLap').disabled = !this.running;
    },

    renderLaps() {
      const list = $('#lapsList');
      const header = $('#lapsHeader');
      if (this.laps.length === 0) {
        list.innerHTML = '';
        header.style.display = 'none';
        return;
      }
      header.style.display = 'grid';
      let total = 0;
      list.innerHTML = '';
      // Show laps in reverse order
      for (let i = this.laps.length - 1; i >= 0; i--) {
        total = this.laps.slice(0, i + 1).reduce((a, b) => a + b, 0);
        const item = document.createElement('div');
        item.className = 'lap-item';
        item.innerHTML = `
          <span class="lap-num">#${i + 1}</span>
          <span>${formatTime(this.laps[i])}.${formatMs(this.laps[i])}</span>
          <span>${formatTime(total)}.${formatMs(total)}</span>`;
        list.appendChild(item);
      }
    },
  };

  // ============ COUNTDOWN ============
  const countdown = {
    running: false,
    totalMs: 0,
    remainMs: 0,
    startTime: 0,
    interval: null,

    init() {
      // Preset buttons
      $$('.preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('.preset-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const secs = parseInt(btn.dataset.seconds);
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = secs % 60;
          $('#cdHours').value = h;
          $('#cdMinutes').value = m;
          $('#cdSeconds').value = s;
        });
      });

      $('#cdStart').addEventListener('click', () => this.toggle());
      $('#cdReset').addEventListener('click', () => this.reset());
    },

    getInputMs() {
      const h = parseInt($('#cdHours').value) || 0;
      const m = parseInt($('#cdMinutes').value) || 0;
      const s = parseInt($('#cdSeconds').value) || 0;
      return (h * 3600 + m * 60 + s) * 1000;
    },

    toggle() {
      if (this.running) {
        this.pause();
      } else {
        this.start();
      }
    },

    start() {
      if (!this.totalMs) {
        this.totalMs = this.getInputMs();
        if (this.totalMs <= 0) return;
        this.remainMs = this.totalMs;
      }

      this.running = true;
      this.startTime = performance.now();
      const startRemain = this.remainMs;

      // Show timer display
      $('#cdSetup').style.display = 'none';
      $('#cdDisplay').style.display = 'flex';
      $('#cdReset').style.display = 'inline-flex';

      this.interval = setInterval(() => {
        const elapsed = performance.now() - this.startTime;
        this.remainMs = Math.max(0, startRemain - elapsed);
        this.render();

        if (this.remainMs <= 0) {
          this.finish();
        }
      }, 50);

      this.updateButton();
    },

    pause() {
      this.running = false;
      clearInterval(this.interval);
      this.updateButton();
    },

    reset() {
      this.running = false;
      this.totalMs = 0;
      this.remainMs = 0;
      clearInterval(this.interval);
      $('#cdSetup').style.display = 'block';
      $('#cdDisplay').style.display = 'none';
      $('#cdReset').style.display = 'none';
      this.updateButton();
    },

    finish() {
      this.running = false;
      clearInterval(this.interval);
      this.remainMs = 0;
      this.render();

      // Save to history
      saveHistory({
        type: 'countdown',
        icon: '⏱️',
        title: 'Countdown Timer',
        detail: `Duration: ${formatTimeFull(this.totalMs)}`,
        value: formatTimeFull(this.totalMs),
      });

      // Flash effect
      const ring = $('.countdown-ring');
      ring.classList.add('finished');
      setTimeout(() => ring.classList.remove('finished'), 2000);

      // Notification
      try {
        chrome.runtime.sendMessage({ type: 'COUNTDOWN_DONE' });
      } catch (e) { /* non-extension context */ }

      this.updateButton();
    },

    render() {
      $('#cdTime').textContent = formatTimeFull(this.remainMs);
      const progress = this.totalMs > 0 ? this.remainMs / this.totalMs : 0;
      const offset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
      $('#cdRing').style.strokeDashoffset = offset;
    },

    updateButton() {
      const btn = $('#cdStart');
      if (this.running) {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pause`;
        btn.classList.add('running');
      } else {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${this.totalMs > 0 && this.remainMs > 0 ? 'Resume' : 'Start'}`;
        btn.classList.remove('running');
      }
    },
  };

  // ============ SPS CALCULATOR ============
  const spsCalc = {
    mode: 'manual',
    timerRunning: false,
    timerElapsed: 0,
    timerStart: 0,
    interval: null,

    init() {
      // Mode toggle
      $('#spsModeManual').addEventListener('click', () => this.setMode('manual'));
      $('#spsModeTimer').addEventListener('click', () => this.setMode('timer'));

      // Manual calc
      $('#spsCalcBtn').addEventListener('click', () => this.calcManual());

      // Timer mode
      $('#spsTimerStart').addEventListener('click', () => this.toggleTimer());
      $('#spsTimerReset').addEventListener('click', () => this.resetTimer());
      $('#spsTimerCalc').addEventListener('click', () => this.calcTimer());

      // Save
      $('#spsSaveBtn').addEventListener('click', () => this.saveResult());
    },

    setMode(mode) {
      this.mode = mode;
      $$('.sps-mode').forEach((b) => b.classList.remove('active'));
      $(mode === 'manual' ? '#spsModeManual' : '#spsModeTimer').classList.add('active');
      $('#spsManual').style.display = mode === 'manual' ? 'block' : 'none';
      $('#spsTimer').style.display = mode === 'timer' ? 'block' : 'none';
      $('#spsResult').style.display = 'none';
    },

    calcManual() {
      const sentences = parseFloat($('#spsSentences').value);
      const seconds = parseFloat($('#spsSeconds').value);
      if (!sentences || !seconds || seconds <= 0) return;
      this.showResult(sentences, seconds);
    },

    toggleTimer() {
      if (this.timerRunning) {
        this.pauseTimer();
      } else {
        this.startTimer();
      }
    },

    startTimer() {
      this.timerRunning = true;
      this.timerStart = performance.now() - this.timerElapsed;
      this.interval = setInterval(() => {
        this.timerElapsed = performance.now() - this.timerStart;
        const secs = this.timerElapsed / 1000;
        const min = Math.floor(secs / 60);
        const sec = Math.floor(secs % 60);
        const ds = Math.floor((secs * 10) % 10);
        $('#spsTimerValue').textContent = `${padZero(min)}:${padZero(sec)}.${ds}`;
      }, 100);
      this.updateTimerButtons();
    },

    pauseTimer() {
      this.timerRunning = false;
      clearInterval(this.interval);
      this.updateTimerButtons();
    },

    resetTimer() {
      this.timerRunning = false;
      this.timerElapsed = 0;
      clearInterval(this.interval);
      $('#spsTimerValue').textContent = '00:00.0';
      $('#spsResult').style.display = 'none';
      this.updateTimerButtons();
    },

    calcTimer() {
      const sentences = parseFloat($('#spsSentencesTimer').value);
      const seconds = this.timerElapsed / 1000;
      if (!sentences || seconds <= 0) return;
      this.showResult(sentences, seconds);
    },

    showResult(sentences, seconds) {
      const sps = sentences / seconds;
      this._lastSentences = sentences;
      this._lastSeconds = seconds;
      this._lastSps = sps;

      $('#spsResultValue').textContent = sps.toFixed(3);
      $('#spsResultDetail').textContent = `${sentences} sentences in ${seconds.toFixed(1)}s`;
      $('#spsResult').style.display = 'block';
    },

    saveResult() {
      if (!this._lastSps) return;
      saveHistory({
        type: 'sps',
        icon: '⚡',
        title: 'SPS Calculation',
        detail: `${this._lastSentences} sentences in ${this._lastSeconds.toFixed(1)}s`,
        value: `${this._lastSps.toFixed(3)} s/s`,
      });
      // Visual feedback
      const btn = $('#spsSaveBtn');
      btn.textContent = '✓ Saved!';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save to History`;
        btn.disabled = false;
      }, 1500);
    },

    updateTimerButtons() {
      const startBtn = $('#spsTimerStart');
      if (this.timerRunning) {
        startBtn.textContent = 'Pause';
        startBtn.classList.add('running');
      } else {
        startBtn.textContent = this.timerElapsed > 0 ? 'Resume' : 'Start Timer';
        startBtn.classList.remove('running');
      }
      $('#spsTimerReset').disabled = !this.timerElapsed;
      $('#spsTimerCalc').disabled = !this.timerElapsed || this.timerRunning;
    },
  };

  // ============ POMODORO ============
  const pomodoro = {
    running: false,
    session: 0, // 0-indexed: 0,2,4,6 = focus; 1,3,5,7 = break
    totalMs: 0,
    remainMs: 0,
    startTime: 0,
    interval: null,

    get config() {
      return {
        focus: (parseInt($('#pomoFocus').value) || 25) * 60 * 1000,
        shortBreak: (parseInt($('#pomoShort').value) || 5) * 60 * 1000,
        longBreak: (parseInt($('#pomoLong').value) || 15) * 60 * 1000,
        sessions: parseInt($('#pomoSessions').value) || 4,
      };
    },

    get isFocus() {
      return this.session % 2 === 0;
    },

    get currentSession() {
      return Math.floor(this.session / 2) + 1;
    },

    init() {
      $('#pomoStart').addEventListener('click', () => this.toggle());
      $('#pomoReset').addEventListener('click', () => this.reset());
      $('#pomoSkip').addEventListener('click', () => this.skip());
      this.setupSession();
    },

    setupSession() {
      const cfg = this.config;
      if (this.isFocus) {
        this.totalMs = cfg.focus;
        $('#pomoLabel').textContent = 'FOCUS';
        $('#pomoRing').classList.remove('break-mode');
      } else {
        // Is it the last break? → long break
        const isLongBreak = this.currentSession >= cfg.sessions;
        this.totalMs = isLongBreak ? cfg.longBreak : cfg.shortBreak;
        $('#pomoLabel').textContent = isLongBreak ? 'LONG BREAK' : 'SHORT BREAK';
        $('#pomoRing').classList.add('break-mode');
      }
      this.remainMs = this.totalMs;
      this.render();
      this.updateDots();
      this.updateButton();
    },

    toggle() {
      this.running ? this.pause() : this.start();
    },

    start() {
      this.running = true;
      this.startTime = performance.now();
      const startRemain = this.remainMs;

      this.interval = setInterval(() => {
        const elapsed = performance.now() - this.startTime;
        this.remainMs = Math.max(0, startRemain - elapsed);
        this.render();

        if (this.remainMs <= 0) {
          this.finishSession();
        }
      }, 100);

      this.updateButton();
    },

    pause() {
      this.running = false;
      clearInterval(this.interval);
      this.updateButton();
    },

    reset() {
      this.running = false;
      this.session = 0;
      clearInterval(this.interval);
      this.setupSession();
    },

    skip() {
      this.running = false;
      clearInterval(this.interval);
      this.nextSession();
    },

    finishSession() {
      this.running = false;
      clearInterval(this.interval);

      if (this.isFocus) {
        saveHistory({
          type: 'pomodoro',
          icon: '🍅',
          title: `Pomodoro Focus #${this.currentSession}`,
          detail: `${Math.round(this.totalMs / 60000)} min focus session`,
          value: formatTimeFull(this.totalMs),
        });
      }

      // Notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'ProdoTime - Pomodoro',
          message: this.isFocus ? 'Focus done! Time for a break 🎉' : 'Break over! Ready to focus? 💪',
          priority: 2,
        });
      } catch (e) { /* non-extension context */ }

      this.nextSession();
    },

    nextSession() {
      const cfg = this.config;
      const maxSessions = cfg.sessions * 2;
      this.session++;
      if (this.session >= maxSessions) {
        this.session = 0;
      }
      this.setupSession();
    },

    render() {
      $('#pomoTime').textContent = formatTimeFull(this.remainMs);
      const progress = this.totalMs > 0 ? this.remainMs / this.totalMs : 0;
      const offset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
      $('#pomoRing').style.strokeDashoffset = offset;
    },

    updateDots() {
      const cfg = this.config;
      const dots = $('#pomoDots');
      dots.innerHTML = '';
      for (let i = 0; i < cfg.sessions; i++) {
        const dot = document.createElement('span');
        dot.className = 'pomo-dot';
        if (i < this.currentSession - 1) dot.classList.add('done');
        if (i === this.currentSession - 1) dot.classList.add('active');
        dots.appendChild(dot);
      }
      $('#pomoSessionLabel').textContent = this.isFocus
        ? `Focus Session ${this.currentSession}/${cfg.sessions}`
        : `Break ${this.currentSession - 1}/${cfg.sessions}`;
    },

    updateButton() {
      const btn = $('#pomoStart');
      if (this.running) {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pause`;
        btn.classList.add('running');
      } else {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start`;
        btn.classList.remove('running');
      }
    },
  };

  // ============ HISTORY ============
  function getHistory() {
    const raw = localStorage.getItem('prodotime-history');
    return raw ? JSON.parse(raw) : [];
  }

  function saveHistory(entry) {
    const history = getHistory();
    history.unshift({
      ...entry,
      timestamp: Date.now(),
    });
    // Keep max 50 entries
    if (history.length > 50) history.length = 50;
    localStorage.setItem('prodotime-history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    const list = $('#historyList');
    const history = getHistory();

    if (history.length === 0) {
      list.innerHTML = `
        <div class="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
            <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
          </svg>
          <p>No sessions recorded yet</p>
          <span>Use the timer or calculator to create entries</span>
        </div>`;
      return;
    }

    list.innerHTML = history
      .map(
        (item) => `
      <div class="history-item">
        <div class="history-icon ${item.type}">${item.icon}</div>
        <div class="history-info">
          <div class="history-title">${item.title}</div>
          <div class="history-detail">${item.detail}</div>
        </div>
        <div>
          <div class="history-time">${item.value}</div>
          <div class="history-date">${formatDate(item.timestamp)}</div>
        </div>
      </div>`
      )
      .join('');
  }

  function initHistory() {
    renderHistory();
    $('#clearHistory').addEventListener('click', () => {
      if (confirm('Clear all history?')) {
        localStorage.removeItem('prodotime-history');
        renderHistory();
      }
    });
  }

  // ============ BOOTSTRAP ============
  function init() {
    initTheme();
    initTabs();
    stopwatch.init();
    countdown.init();
    spsCalc.init();
    pomodoro.init();
    initHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
