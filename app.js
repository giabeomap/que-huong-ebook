/**
 * Quê Hương – E-Book Reader (Audio-Reactive Edition)
 * Realistic page-flipping book, synced page audio cards, rhythm-driven gradients,
 * ambient background music with smart ducking, and auto-flip / auto-audio modes.
 */
(function () {
  'use strict';

  const PAGE_ASPECT = 4419 / 6250; // ~0.70704 (A4 portrait ratio)
  const PORTRAIT_BREAKPOINT = 768;

  const BGM_VOLUME_NORMAL = 0.16;
  const BGM_VOLUME_DUCKED = 0.03;
  const BGM_VOLUME_MUTED = 0;

  const SPREAD_META = [
    {
      index: 0,
      label: 'Trang bìa · Quê Hương',
      targetPage: 0,
      autoDelayMs: 4500,
    },
    {
      index: 1,
      label: 'Trang 1–2 · Lời ngỏ & Mục lục',
      targetPage: 1,
      autoDelayMs: 9000,
      audio: {
        src: 'assets/audio/loi-ngo.mp3',
        title: 'Lời ngỏ · Trang 1–2',
        isVoice: true,
      },
    },
    {
      index: 2,
      label: 'Trang 3–4 · Quê hương bình yên',
      targetPage: 3,
      autoDelayMs: 8000,
    },
    {
      index: 3,
      label: 'Trang 5–6 · Ký ức tuổi thơ',
      targetPage: 5,
      autoDelayMs: 16000,
      audio: {
        src: 'assets/audio/nhac-nen-trang-5-6.mp3',
        title: 'Nhạc nền · Trang 5–6',
        isVoice: false,
        startTime: 15,
        autoFlipAtTime: 31,
        fadeInMs: 2200,
        fadeOutMs: 2200,
      },
    },
    {
      index: 4,
      label: 'Trang 7–8 · Hẹn với miền quê cũ',
      targetPage: 7,
      autoDelayMs: 9000,
      audio: {
        src: 'assets/audio/tho-hen-que-cu.mp3',
        title: 'Thơ: Hẹn với miền quê cũ · Trang 7–8',
        isVoice: true,
      },
    },
    {
      index: 5,
      label: 'Trang 9–10 · Sự lắng đọng nơi con tim',
      targetPage: 9,
      autoDelayMs: 9000,
      audio: {
        src: 'assets/audio/cam-nhan-con-tim.mp3',
        title: 'Cảm nhận: Sự lắng đọng nơi con tim · Trang 9–10',
        isVoice: true,
      },
    },
    {
      index: 6,
      label: 'Bìa sau · Quê Hương',
      targetPage: 11,
      autoDelayMs: 0,
    },
  ];

  const PORTRAIT_LABELS = [
    'Trang bìa · Quê Hương',
    'Trang 1 · Lời ngỏ',
    'Trang 2 · Mục lục',
    'Trang 3 · Những góc nhỏ quê hương',
    'Trang 4 · Quê hương bình yên',
    'Trang 5 · Ngõ nhỏ quê nhà',
    'Trang 6 · Quê hương tuổi thơ',
    'Trang 7 · Hẹn với miền quê cũ',
    'Trang 8 · Bài thơ: Hẹn với miền quê cũ',
    'Trang 9 · Sự lắng đọng nơi...',
    'Trang 10 · Con tim',
    'Bìa sau · Quê Hương',
  ];

  // DOM References
  const body = document.body;
  const bookStage = document.getElementById('book-stage');
  const bookWrapper = document.getElementById('book-wrapper');
  const bookViewport = document.getElementById('book-viewport');
  const bookPanLayer = document.getElementById('book-pan-layer');
  const flipbookEl = document.getElementById('flipbook');
  const spreadLabelEl = document.getElementById('spread-label');
  const gestureHintEl = document.getElementById('gesture-hint');

  const bgLayers = Array.from(document.querySelectorAll('.bg-layer'));
  const spreadDots = Array.from(document.querySelectorAll('.spread-dot'));

  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const navPrevSide = document.getElementById('nav-prev-side');
  const navNextSide = document.getElementById('nav-next-side');
  const btnAutoAudio = document.getElementById('btn-auto-audio');
  const btnAutoFlip = document.getElementById('btn-auto-flip');
  const btnBgm = document.getElementById('btn-bgm');
  const btnSound = document.getElementById('btn-sound');
  const btnZoom = document.getElementById('btn-zoom');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnDownloadSource = document.getElementById('btn-download-source');

  if (btnDownloadSource && window.location.hostname.endsWith('github.io')) {
    btnDownloadSource.href =
      'https://github.com/giabeomap/que-huong-ebook/releases/download/v1.0.0/file-nguon.zip';
  }

  // Audio elements & card UI
  const audioBgm = document.getElementById('audio-bgm');
  const audioPage = document.getElementById('audio-page');
  const audioCard = document.getElementById('page-audio-card');
  const audioCardPlay = document.getElementById('audio-card-play');
  const audioCardTitle = document.getElementById('audio-card-title');
  const audioCardTime = document.getElementById('audio-card-time');
  const audioCardSeek = document.getElementById('audio-card-seek');

  // Preserve clean page templates so resize rebuilds never inherit StPageFlip inline styles
  const pageTemplates = Array.from(flipbookEl.children).map((node) => node.cloneNode(true));

  let pageFlip = null;
  let currentPage = 0;
  let currentOrientation = 'landscape';
  let soundEnabled = true;
  let bgmEnabled = true;
  let bgmStarted = false;
  let autoAudioEnabled = false;
  let autoFlipEnabled = false;
  let hintDismissed = false;

  // Web Audio API (Flip SFX + Page Audio Analyser)
  let audioCtx = null;
  let pageAnalyser = null;
  let pageSourceNode = null;
  let analyserData = null;
  let reactiveRafId = null;
  let smoothLow = 0;
  let smoothMid = 0;
  let smoothHigh = 0;
  let beatPhase = 0;
  let activeSpreadAudio = null; // spreadIndex of loaded audio-page track
  let autoFlipTimer = null;
  let bgmFadeRaf = null;
  let pageFadeRaf = null;
  let pendingStartTime = 0;
  let isFadingOutForAutoFlip = false;
  let hasAutoFlippedFromAudio = false;

  // Zoom & Pan state
  let isZoomed = false;
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;

  /* ------------------------------------------------------------------------
     Web Audio Setup & Page Flip SFX
     ------------------------------------------------------------------------ */
  function ensureAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      return audioCtx.resume().then(() => audioCtx).catch(() => audioCtx);
    }
    return Promise.resolve(audioCtx);
  }

  function ensurePageAnalyser() {
    if (pageAnalyser) return pageAnalyser;
    // Never hijack <audio> into Web Audio on file:// where CORS can mute playback
    if (window.location.protocol === 'file:') return null;

    ensureAudioContext().then((ctx) => {
      if (!ctx || ctx.state !== 'running' || pageAnalyser || pageSourceNode) return;
      try {
        pageSourceNode = ctx.createMediaElementSource(audioPage);
        pageAnalyser = ctx.createAnalyser();
        pageAnalyser.fftSize = 256;
        pageAnalyser.smoothingTimeConstant = 0.78;
        pageSourceNode.connect(pageAnalyser);
        pageAnalyser.connect(ctx.destination);
        analyserData = new Uint8Array(pageAnalyser.frequencyBinCount);
      } catch (_) {
        pageAnalyser = null;
      }
    });
    return pageAnalyser;
  }

  function playPageFlipSound() {
    if (!soundEnabled) return;
    ensureAudioContext().then((ctx) => {
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const duration = 0.28;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.04 * white) / 1.04;
        const t = i / bufferSize;
        const env = Math.sin(Math.PI * t) * Math.pow(1 - t * 0.35, 1.3);
        data[i] = (white * 0.45 + lastOut * 2.2) * env;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.1, now);
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(2100, now + 0.11);
      filter.frequency.exponentialRampToValueAtTime(920, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    });
  }

  /* ------------------------------------------------------------------------
     Global Ambient Background Music (with smart ducking)
     ------------------------------------------------------------------------ */
  audioBgm.volume = BGM_VOLUME_NORMAL;

  function fadeBgmTo(targetVol) {
    if (bgmFadeRaf) cancelAnimationFrame(bgmFadeRaf);
    const step = () => {
      const diff = targetVol - audioBgm.volume;
      if (Math.abs(diff) < 0.004) {
        audioBgm.volume = Math.max(0, Math.min(1, targetVol));
        bgmFadeRaf = null;
        return;
      }
      audioBgm.volume = Math.max(0, Math.min(1, audioBgm.volume + diff * 0.12));
      bgmFadeRaf = requestAnimationFrame(step);
    };
    bgmFadeRaf = requestAnimationFrame(step);
  }

  function syncBgmDucking() {
    if (!bgmEnabled) {
      fadeBgmTo(BGM_VOLUME_MUTED);
      return;
    }
    const isPageAudioPlaying = !audioPage.paused && !audioPage.ended && audioPage.currentSrc;
    if (!isPageAudioPlaying) {
      fadeBgmTo(BGM_VOLUME_NORMAL);
      return;
    }
    const meta = SPREAD_META[activeSpreadAudio];
    if (meta && meta.audio && !meta.audio.isVoice) {
      // Spread 3 has its own background music -> silence global BGM cleanly
      fadeBgmTo(BGM_VOLUME_MUTED);
    } else {
      // Voice narration -> duck global BGM gently
      fadeBgmTo(BGM_VOLUME_DUCKED);
    }
  }

  let bgmStarting = false;
  function startBgmIfNeeded() {
    if (!bgmEnabled || bgmStarted || bgmStarting) return;
    bgmStarting = true;
    audioBgm.volume = BGM_VOLUME_NORMAL;
    audioBgm
      .play()
      .then(() => {
        bgmStarted = true;
        bgmStarting = false;
        syncBgmDucking();
      })
      .catch(() => {
        bgmStarted = false;
        bgmStarting = false;
      });
  }

  /* ------------------------------------------------------------------------
     Audio-Reactive Gradient Rhythm Loop (Only for non-BGM page audio!)
     ------------------------------------------------------------------------ */
  function setBeatVars(low, mid, high, x, y) {
    body.style.setProperty('--beat-low', low.toFixed(3));
    body.style.setProperty('--beat-mid', mid.toFixed(3));
    body.style.setProperty('--beat-high', high.toFixed(3));
    body.style.setProperty('--beat-x', `${x.toFixed(1)}px`);
    body.style.setProperty('--beat-y', `${y.toFixed(1)}px`);
  }

  function startReactiveLoop() {
    if (reactiveRafId) return;
    body.classList.add('is-audio-reactive');

    const tick = () => {
      if (audioPage.paused || audioPage.ended) {
        // Decay smoothly back to rest
        smoothLow *= 0.84;
        smoothMid *= 0.84;
        smoothHigh *= 0.84;
        if (smoothLow < 0.005 && smoothMid < 0.005) {
          smoothLow = 0;
          smoothMid = 0;
          smoothHigh = 0;
          setBeatVars(0, 0, 0, 0, 0);
          body.classList.remove('is-audio-reactive');
          reactiveRafId = null;
          return;
        }
      } else {
        let low = 0;
        let mid = 0;
        let high = 0;

        if (pageAnalyser && analyserData) {
          pageAnalyser.getByteFrequencyData(analyserData);
          // Bass / voice fundamental (bins 1..6)
          for (let i = 1; i <= 6; i++) low += analyserData[i];
          low = low / (6 * 255);
          // Vocal & melody mid (bins 7..28)
          for (let i = 7; i <= 28; i++) mid += analyserData[i];
          mid = mid / (22 * 255);
          // Air & high shimmer (bins 29..64)
          for (let i = 29; i <= 64; i++) high += analyserData[i];
          high = high / (36 * 255);

          // Boost dynamic range for natural speech/music responsiveness
          low = Math.min(1, Math.pow(low * 1.45, 0.88));
          mid = Math.min(1, Math.pow(mid * 1.65, 0.9));
          high = Math.min(1, Math.pow(high * 2.1, 0.92));
        } else {
          // Graceful fallback rhythm if Web Audio analyser isn't active (e.g. file://)
          const t = performance.now() * 0.004;
          low = 0.35 + 0.25 * Math.sin(t * 1.7);
          mid = 0.32 + 0.24 * Math.sin(t * 2.3 + 1.1);
          high = 0.25 + 0.2 * Math.cos(t * 3.1);
        }

        smoothLow += (low - smoothLow) * 0.28;
        smoothMid += (mid - smoothMid) * 0.26;
        smoothHigh += (high - smoothHigh) * 0.24;
      }

      beatPhase += 0.025 + smoothLow * 0.065;
      const offsetX = Math.sin(beatPhase) * (18 + smoothLow * 42);
      const offsetY = Math.cos(beatPhase * 0.78) * (14 + smoothMid * 34);
      setBeatVars(smoothLow, smoothMid, smoothHigh, offsetX, offsetY);

      reactiveRafId = requestAnimationFrame(tick);
    };

    reactiveRafId = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     Page-Specific Audio Controls & In-Page Tag Sync
     ------------------------------------------------------------------------ */
  function cancelPageFade() {
    if (pageFadeRaf) {
      cancelAnimationFrame(pageFadeRaf);
      pageFadeRaf = null;
    }
  }

  function fadePageAudioVolume(fromVol, toVol, durationMs, onDone) {
    cancelPageFade();
    const startVal = Math.max(0, Math.min(1, fromVol));
    const endVal = Math.max(0, Math.min(1, toVol));
    const dur = Math.max(50, durationMs);
    const startTs = performance.now();
    audioPage.volume = startVal;

    const step = (now) => {
      const progress = Math.min(1, (now - startTs) / dur);
      // Smooth ease-in-out curve
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      audioPage.volume = Math.max(0, Math.min(1, startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        pageFadeRaf = requestAnimationFrame(step);
      } else {
        audioPage.volume = endVal;
        pageFadeRaf = null;
        if (typeof onDone === 'function') onDone();
      }
    };

    pageFadeRaf = requestAnimationFrame(step);
  }

  function resetSpreadAudioFlags() {
    cancelPageFade();
    isFadingOutForAutoFlip = false;
    hasAutoFlippedFromAudio = false;
  }

  function loadSpreadAudioSource(spreadIndex, meta) {
    resetSpreadAudioFlags();
    activeSpreadAudio = spreadIndex;
    const startAt = meta.audio.startTime || 0;
    pendingStartTime = startAt;
    audioPage.volume = meta.audio.fadeInMs ? 0 : 1;
    audioPage.src = meta.audio.src;
    audioCardTitle.textContent = meta.audio.title;
    audioCardSeek.value = 0;
    audioCardTime.textContent = `${formatTime(startAt)} / 00:00`;
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateAudioTagsVisualState() {
    const isPlaying = !audioPage.paused && !audioPage.ended && Boolean(audioPage.currentSrc);
    const tags = document.querySelectorAll('.page-audio-tag');
    tags.forEach((tag) => {
      const spreadIdx = Number(tag.dataset.audioSpread);
      const active = isPlaying && spreadIdx === activeSpreadAudio;
      tag.classList.toggle('is-playing', active);
    });
    audioCard.classList.toggle('is-playing', isPlaying);
    syncBgmDucking();
  }

  function syncAudioCardForSpread(spreadIndex) {
    const meta = SPREAD_META[spreadIndex];
    if (!meta || !meta.audio) {
      audioCard.hidden = true;
      resetSpreadAudioFlags();
      if (!audioPage.paused) {
        audioPage.pause();
      }
      audioPage.volume = 1;
      activeSpreadAudio = null;
      updateAudioTagsVisualState();
      return;
    }

    audioCard.hidden = false;
    audioCardTitle.textContent = meta.audio.title;

    if (activeSpreadAudio !== spreadIndex) {
      if (!audioPage.paused) audioPage.pause();
      loadSpreadAudioSource(spreadIndex, meta);
    }

    updateAudioTagsVisualState();
  }

  function playSpreadAudio(spreadIndex) {
    const meta = SPREAD_META[spreadIndex];
    if (!meta || !meta.audio) return;

    ensureAudioContext();
    ensurePageAnalyser();
    startBgmIfNeeded();

    if (activeSpreadAudio !== spreadIndex) {
      if (!audioPage.paused) audioPage.pause();
      loadSpreadAudioSource(spreadIndex, meta);
      audioCard.hidden = false;
    }

    const startAt = meta.audio.startTime || 0;
    if (audioPage.ended || (startAt > 0 && audioPage.currentTime < startAt)) {
      if (audioPage.readyState >= 1) {
        audioPage.currentTime = startAt;
        pendingStartTime = 0;
      } else {
        pendingStartTime = startAt;
      }
    }

    resetSpreadAudioFlags();
    const fadeInMs = meta.audio.fadeInMs || 0;
    if (fadeInMs > 0) {
      audioPage.volume = 0;
    } else {
      audioPage.volume = 1;
    }

    audioPage
      .play()
      .then(() => {
        if (pendingStartTime > 0 && audioPage.readyState >= 1) {
          audioPage.currentTime = pendingStartTime;
          pendingStartTime = 0;
        }
        if (fadeInMs > 0) {
          fadePageAudioVolume(0, 1, fadeInMs);
        }
        startReactiveLoop();
        updateAudioTagsVisualState();
      })
      .catch(() => {});
  }

  function toggleSpreadAudio(spreadIndex) {
    const targetSpread =
      typeof spreadIndex === 'number' ? spreadIndex : pageToSpreadIndex(currentPage);
    const meta = SPREAD_META[targetSpread];
    if (!meta || !meta.audio) return;

    if (activeSpreadAudio === targetSpread && !audioPage.paused && !audioPage.ended) {
      cancelPageFade();
      audioPage.pause();
      updateAudioTagsVisualState();
      scheduleAutoFlipIfEnabled();
    } else {
      playSpreadAudio(targetSpread);
    }
  }

  // Event delegation for in-page audio tags (works across resize rebuilds too!)
  bookWrapper.addEventListener('click', (e) => {
    const tag = e.target.closest('.page-audio-tag');
    if (!tag) return;
    e.preventDefault();
    e.stopPropagation();
    const spreadIdx = Number(tag.dataset.audioSpread);
    toggleSpreadAudio(spreadIdx);
  });

  audioCardPlay.addEventListener('click', () => {
    toggleSpreadAudio(pageToSpreadIndex(currentPage));
  });

  audioCardSeek.addEventListener('input', () => {
    if (!Number.isFinite(audioPage.duration) || audioPage.duration <= 0) return;
    const targetTime = (Number(audioCardSeek.value) / 100) * audioPage.duration;
    pendingStartTime = 0;
    isFadingOutForAutoFlip = false;
    hasAutoFlippedFromAudio = false;
    audioPage.currentTime = targetTime;
  });

  audioPage.addEventListener('loadedmetadata', () => {
    if (pendingStartTime > 0) {
      audioPage.currentTime = Math.min(pendingStartTime, audioPage.duration || pendingStartTime);
      pendingStartTime = 0;
    }
    const dur = audioPage.duration || 0;
    const cur = audioPage.currentTime || 0;
    if (dur > 0) {
      audioCardSeek.value = ((cur / dur) * 100).toFixed(2);
    }
    audioCardTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  });

  audioPage.addEventListener('timeupdate', () => {
    const dur = audioPage.duration || 0;
    const cur = audioPage.currentTime || 0;
    if (dur > 0) {
      audioCardSeek.value = ((cur / dur) * 100).toFixed(2);
    }
    audioCardTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;

    // Timed fade-out & auto-flip for Spread 3 (e.g. flip at 31s with fade-out)
    const spreadIdx = pageToSpreadIndex(currentPage);
    const meta = SPREAD_META[spreadIdx];
    if (
      autoFlipEnabled &&
      activeSpreadAudio === spreadIdx &&
      !audioPage.paused &&
      meta &&
      meta.audio &&
      typeof meta.audio.autoFlipAtTime === 'number'
    ) {
      const flipAt = meta.audio.autoFlipAtTime;
      const fadeOutSec = (meta.audio.fadeOutMs || 2200) / 1000;
      if (!isFadingOutForAutoFlip && cur >= flipAt - fadeOutSec && cur < flipAt) {
        isFadingOutForAutoFlip = true;
        fadePageAudioVolume(audioPage.volume, 0, Math.max(300, (flipAt - cur) * 1000));
      }
      if (!hasAutoFlippedFromAudio && cur >= flipAt) {
        hasAutoFlippedFromAudio = true;
        cancelPageFade();
        audioPage.volume = 0;
        goNext();
      }
    }
  });

  audioPage.addEventListener('play', () => {
    startReactiveLoop();
    updateAudioTagsVisualState();
    clearAutoFlipTimer();
    const spreadIdx = pageToSpreadIndex(currentPage);
    const meta = SPREAD_META[spreadIdx];
    if (autoFlipEnabled && meta && meta.audio) {
      if (!meta.audio.isVoice && typeof meta.audio.autoFlipAtTime !== 'number') {
        scheduleAutoFlipIfEnabled();
      }
    }
  });

  audioPage.addEventListener('pause', () => {
    updateAudioTagsVisualState();
  });

  audioPage.addEventListener('ended', () => {
    updateAudioTagsVisualState();
    if (autoFlipEnabled) {
      clearAutoFlipTimer();
      autoFlipTimer = setTimeout(() => {
        if (autoFlipEnabled && pageToSpreadIndex(currentPage) < SPREAD_META.length - 1) {
          goNext();
        }
      }, 1500);
    }
  });

  /* ------------------------------------------------------------------------
     Auto-Flip Mode Scheduling
     ------------------------------------------------------------------------ */
  function clearAutoFlipTimer() {
    if (autoFlipTimer) {
      clearTimeout(autoFlipTimer);
      autoFlipTimer = null;
    }
  }

  function scheduleAutoFlipIfEnabled() {
    clearAutoFlipTimer();
    if (!autoFlipEnabled) return;

    const spreadIdx = pageToSpreadIndex(currentPage);
    if (spreadIdx >= SPREAD_META.length - 1) {
      setAutoFlip(false);
      return;
    }

    const meta = SPREAD_META[spreadIdx];
    const isThisSpreadPlaying =
      meta &&
      meta.audio &&
      !audioPage.paused &&
      !audioPage.ended &&
      activeSpreadAudio === spreadIdx;

    if (isThisSpreadPlaying && meta.audio.isVoice) {
      // Wait for audioPage 'ended' handler
      return;
    }

    if (isThisSpreadPlaying && typeof meta.audio.autoFlipAtTime === 'number') {
      const flipAt = meta.audio.autoFlipAtTime;
      if (audioPage.currentTime >= flipAt && !hasAutoFlippedFromAudio) {
        hasAutoFlippedFromAudio = true;
        isFadingOutForAutoFlip = true;
        fadePageAudioVolume(audioPage.volume, 0, 500, () => {
          if (autoFlipEnabled) goNext();
        });
      }
      // Otherwise timeupdate drives the fade-out and flip at flipAt (31s)
      return;
    }

    const delay = (meta && meta.autoDelayMs) || 8000;
    autoFlipTimer = setTimeout(() => {
      if (autoFlipEnabled) {
        goNext();
      }
    }, delay);
  }

  function setAutoFlip(enabled) {
    autoFlipEnabled = enabled;
    btnAutoFlip.classList.toggle('is-active', autoFlipEnabled);
    btnAutoFlip.setAttribute('aria-pressed', autoFlipEnabled ? 'true' : 'false');
    if (autoFlipEnabled) {
      scheduleAutoFlipIfEnabled();
    } else {
      clearAutoFlipTimer();
    }
  }

  function setAutoAudio(enabled) {
    autoAudioEnabled = enabled;
    btnAutoAudio.classList.toggle('is-active', autoAudioEnabled);
    btnAutoAudio.setAttribute('aria-pressed', autoAudioEnabled ? 'true' : 'false');

    if (autoAudioEnabled) {
      const spreadIdx = pageToSpreadIndex(currentPage);
      const meta = SPREAD_META[spreadIdx];
      if (meta && meta.audio && audioPage.paused) {
        playSpreadAudio(spreadIdx);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Spread Mapping & Dynamic Ambient Background
     ------------------------------------------------------------------------ */
  function pageToSpreadIndex(pageIndex) {
    if (pageIndex <= 0) return 0;
    if (pageIndex <= 2) return 1;
    if (pageIndex <= 4) return 2;
    if (pageIndex <= 6) return 3;
    if (pageIndex <= 8) return 4;
    if (pageIndex <= 10) return 5;
    return 6;
  }

  function updateBookUI(pageIndex, orientation, isFlipEvent) {
    currentPage = pageIndex;
    currentOrientation = orientation || currentOrientation;

    const spreadIndex = pageToSpreadIndex(pageIndex);
    const totalPages = pageTemplates.length;

    body.setAttribute('data-spread', String(spreadIndex));
    body.setAttribute('data-orientation', currentOrientation);

    bgLayers.forEach((layer, idx) => {
      layer.classList.toggle('is-active', idx === spreadIndex);
    });

    if (currentOrientation === 'portrait') {
      spreadLabelEl.textContent = PORTRAIT_LABELS[pageIndex] || SPREAD_META[spreadIndex].label;
    } else {
      spreadLabelEl.textContent = SPREAD_META[spreadIndex].label;
    }

    spreadDots.forEach((dot, idx) => {
      const active = idx === spreadIndex;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const atStart = pageIndex <= 0;
    const atEnd = pageIndex >= totalPages - 1;

    btnPrev.disabled = atStart;
    navPrevSide.disabled = atStart;
    btnNext.disabled = atEnd;
    navNextSide.disabled = atEnd;

    if (pageIndex > 0 && !hintDismissed) {
      dismissHint();
    }

    syncAudioCardForSpread(spreadIndex);

    if (isFlipEvent) {
      const meta = SPREAD_META[spreadIndex];
      if (autoAudioEnabled && meta && meta.audio) {
        playSpreadAudio(spreadIndex);
      }
      if (autoFlipEnabled) {
        scheduleAutoFlipIfEnabled();
      }
    }
  }

  function dismissHint() {
    hintDismissed = true;
    gestureHintEl.classList.add('is-hidden');
  }

  /* ------------------------------------------------------------------------
     Book Sizing & StPageFlip Initialization
     ------------------------------------------------------------------------ */
  function computeBookGeometry() {
    const stageWidth = Math.max(280, bookStage.clientWidth);
    const stageHeight = Math.max(220, bookStage.clientHeight);
    const isPortraitViewport = window.innerWidth < PORTRAIT_BREAKPOINT;

    if (isPortraitViewport) {
      let pageWidth = Math.min(stageWidth, 540);
      let pageHeight = pageWidth / PAGE_ASPECT;

      if (pageHeight > stageHeight) {
        pageHeight = stageHeight;
        pageWidth = pageHeight * PAGE_ASPECT;
      }

      return {
        mode: 'portrait',
        pageWidth: Math.round(pageWidth),
        pageHeight: Math.round(pageHeight),
        wrapperWidth: Math.round(pageWidth),
        wrapperHeight: Math.round(pageHeight),
      };
    }

    const spreadAspect = PAGE_ASPECT * 2;
    let spreadWidth = Math.min(stageWidth, 1400);
    let spreadHeight = spreadWidth / spreadAspect;

    if (spreadHeight > stageHeight) {
      spreadHeight = stageHeight;
      spreadWidth = spreadHeight * spreadAspect;
    }

    const pageWidth = Math.round(spreadWidth / 2);
    const pageHeight = Math.round(spreadHeight);

    return {
      mode: 'landscape',
      pageWidth,
      pageHeight,
      wrapperWidth: pageWidth * 2,
      wrapperHeight: pageHeight,
    };
  }

  function mountFlipBook(startPageIndex) {
    if (pageFlip) {
      try {
        pageFlip.destroy();
      } catch (_) {}
      pageFlip = null;
    }

    const existing = document.getElementById('flipbook');
    if (existing) existing.remove();

    const freshBook = document.createElement('div');
    freshBook.id = 'flipbook';
    freshBook.className = 'flipbook';
    pageTemplates.forEach((tpl) => {
      freshBook.appendChild(tpl.cloneNode(true));
    });

    bookWrapper.appendChild(freshBook);

    const geom = computeBookGeometry();
    bookWrapper.style.width = `${geom.wrapperWidth}px`;
    bookWrapper.style.height = `${geom.wrapperHeight}px`;

    const PageFlipCtor = window.St && window.St.PageFlip;
    if (!PageFlipCtor) {
      console.error('St.PageFlip library failed to load.');
      return;
    }

    pageFlip = new PageFlipCtor(freshBook, {
      width: geom.pageWidth,
      height: geom.pageHeight,
      size: 'fixed',
      startPage: startPageIndex,
      drawShadow: true,
      maxShadowOpacity: 0.52,
      flippingTime: 900,
      usePortrait: geom.mode === 'portrait',
      startZIndex: 2,
      autoSize: false,
      showCover: true,
      mobileScrollSupport: false,
      swipeDistance: 28,
      clickEventForward: true,
      useMouseEvents: true,
      showPageCorners: true,
      disableFlipByClick: false,
    });

    pageFlip.loadFromHTML(freshBook.querySelectorAll('.page'));

    pageFlip.on('init', (e) => {
      const idx = typeof e.data?.page === 'number' ? e.data.page : startPageIndex;
      const mode = e.data?.mode || geom.mode;
      updateBookUI(idx, mode, false);
    });

    pageFlip.on('flip', (e) => {
      const idx = typeof e.data === 'number' ? e.data : pageFlip.getCurrentPageIndex();
      const mode = pageFlip.getOrientation ? pageFlip.getOrientation() : geom.mode;
      updateBookUI(idx, mode, true);
    });

    pageFlip.on('changeOrientation', (e) => {
      const mode = e.data || geom.mode;
      updateBookUI(pageFlip.getCurrentPageIndex(), mode, false);
    });

    pageFlip.on('changeState', (e) => {
      if (e.data === 'flipping') {
        startBgmIfNeeded();
        playPageFlipSound();
      }
    });

    updateBookUI(startPageIndex, geom.mode, false);
  }

  /* ------------------------------------------------------------------------
     Navigation Actions
     ------------------------------------------------------------------------ */
  function goNext() {
    if (!pageFlip || isZoomed) return;
    if (pageFlip.getState && pageFlip.getState() === 'flipping') return;
    startBgmIfNeeded();
    pageFlip.flipNext('top');
  }

  function goPrev() {
    if (!pageFlip || isZoomed) return;
    if (pageFlip.getState && pageFlip.getState() === 'flipping') return;
    startBgmIfNeeded();
    pageFlip.flipPrev('top');
  }

  function goToSpread(spreadIdx) {
    if (!pageFlip || isZoomed) return;
    const meta = SPREAD_META[spreadIdx];
    if (!meta) return;

    const currentSpread = pageToSpreadIndex(currentPage);
    if (currentOrientation === 'landscape' && currentSpread === spreadIdx) return;

    if (pageFlip.getState && pageFlip.getState() === 'flipping') return;
    startBgmIfNeeded();
    pageFlip.flip(meta.targetPage, 'top');
  }

  /* ------------------------------------------------------------------------
     Zoom & Pan Controls
     ------------------------------------------------------------------------ */
  function applyPanTransform() {
    bookPanLayer.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`;
  }

  function setZoom(enabled, customScale) {
    isZoomed = enabled;
    body.classList.toggle('is-zoomed', isZoomed);
    btnZoom.setAttribute('aria-pressed', isZoomed ? 'true' : 'false');

    const fb = document.getElementById('flipbook');
    if (fb) {
      fb.style.pointerEvents = isZoomed ? 'none' : '';
    }

    if (isZoomed) {
      zoomScale = customScale || 1.72;
      panX = 0;
      panY = 0;
    } else {
      zoomScale = 1;
      panX = 0;
      panY = 0;
    }

    applyPanTransform();
  }

  bookViewport.addEventListener('pointerdown', (e) => {
    if (!isZoomed) return;
    isPanning = true;
    body.classList.add('is-panning');
    panStartX = e.clientX;
    panStartY = e.clientY;
    panOriginX = panX;
    panOriginY = panY;
    bookViewport.setPointerCapture(e.pointerId);
  });

  bookViewport.addEventListener('pointermove', (e) => {
    if (!isZoomed || !isPanning) return;
    panX = panOriginX + (e.clientX - panStartX);
    panY = panOriginY + (e.clientY - panStartY);
    applyPanTransform();
  });

  function stopPanning(e) {
    if (!isPanning) return;
    isPanning = false;
    body.classList.remove('is-panning');
    if (e && typeof e.pointerId === 'number') {
      try {
        bookViewport.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  bookViewport.addEventListener('pointerup', stopPanning);
  bookViewport.addEventListener('pointercancel', stopPanning);

  bookViewport.addEventListener(
    'wheel',
    (e) => {
      if (!isZoomed) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.14 : -0.14;
      zoomScale = Math.min(2.8, Math.max(1.2, zoomScale + delta));
      applyPanTransform();
    },
    { passive: false }
  );

  /* ------------------------------------------------------------------------
     Event Bindings
     ------------------------------------------------------------------------ */
  btnPrev.addEventListener('click', goPrev);
  navPrevSide.addEventListener('click', goPrev);
  btnNext.addEventListener('click', goNext);
  navNextSide.addEventListener('click', goNext);

  spreadDots.forEach((dot, idx) => {
    dot.addEventListener('click', () => goToSpread(idx));
  });

  btnAutoAudio.addEventListener('click', () => {
    setAutoAudio(!autoAudioEnabled);
  });

  btnAutoFlip.addEventListener('click', () => {
    setAutoFlip(!autoFlipEnabled);
  });

  btnBgm.addEventListener('click', () => {
    bgmEnabled = !bgmEnabled;
    btnBgm.classList.toggle('is-active', bgmEnabled);
    btnBgm.setAttribute('aria-pressed', bgmEnabled ? 'true' : 'false');
    if (bgmEnabled) {
      startBgmIfNeeded();
      syncBgmDucking();
    } else {
      fadeBgmTo(BGM_VOLUME_MUTED);
    }
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.classList.toggle('is-active', soundEnabled);
    btnSound.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    if (soundEnabled) ensureAudioContext();
  });

  btnZoom.addEventListener('click', () => {
    setZoom(!isZoomed);
  });

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const isFs = Boolean(document.fullscreenElement);
    btnFullscreen.classList.toggle('is-active', isFs);
    btnFullscreen.setAttribute('aria-pressed', isFs ? 'true' : 'false');
  });

  document.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        goNext();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        goPrev();
        break;
      case ' ':
        if (SPREAD_META[pageToSpreadIndex(currentPage)]?.audio) {
          e.preventDefault();
          toggleSpreadAudio(pageToSpreadIndex(currentPage));
        }
        break;
      case 'Home':
        e.preventDefault();
        goToSpread(0);
        break;
      case 'End':
        e.preventDefault();
        goToSpread(SPREAD_META.length - 1);
        break;
      case 'z':
      case 'Z':
        e.preventDefault();
        setZoom(!isZoomed);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        btnFullscreen.click();
        break;
      case 'Escape':
        if (isZoomed) {
          setZoom(false);
        }
        break;
    }
  });

  // Start ambient BGM gently & unlock Web Audio on first user gesture
  function unlockMediaOnGesture() {
    if (soundEnabled || autoAudioEnabled) ensureAudioContext();
    startBgmIfNeeded();
    if (bgmStarted) {
      window.removeEventListener('pointerdown', unlockMediaOnGesture);
      window.removeEventListener('keydown', unlockMediaOnGesture);
    }
  }
  window.addEventListener('pointerdown', unlockMediaOnGesture);
  window.addEventListener('keydown', unlockMediaOnGesture);

  setTimeout(() => {
    if (!hintDismissed) dismissHint();
  }, 8000);

  let resizeTimer = null;
  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;

  window.addEventListener('resize', () => {
    if (
      Math.abs(window.innerWidth - lastWidth) < 4 &&
      Math.abs(window.innerHeight - lastHeight) < 4
    ) {
      return;
    }
    lastWidth = window.innerWidth;
    lastHeight = window.innerHeight;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isZoomed) setZoom(false);
      mountFlipBook(currentPage);
    }, 180);
  });

  mountFlipBook(0);
})();
