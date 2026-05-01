const { Player } = TextAliveApp;

/*
  ここを対象曲URLに変更。
  マジカルミライコンテスト対象曲のURLを入れる。
*/
const SONG_URL = "https://piapro.jp/t/6W2N/20251215164617";

// TextAlive App Token
const APP_TOKEN = "IWGcvQmDMQHpO49o";

// サビ後半の図形・線エフェクト開始タイミング
const CHORUS_LATE_START_MS = 2000;

const prevLyricEl = document.getElementById("prevLyric");
const mainLyricEl = document.getElementById("mainLyric");
const subLyricEl = document.getElementById("subLyric");
const playButton = document.getElementById("playButton");
const timeEl = document.getElementById("time");
const progressWrapEl = document.getElementById("progressWrap");
const progressBarEl = document.getElementById("progressBar");
const mediaEl = document.getElementById("media");

const chorusFlashEl = document.getElementById("chorusFlash");
const burstParticlesEl = document.getElementById("burstParticles");
const geometricLayerEl = document.getElementById("geometricLayer");
const lineLayerEl = document.getElementById("lineLayer");

const sceneVerse1 = document.getElementById("sceneVerse1");
const sceneVerse2 = document.getElementById("sceneVerse2");
const sceneChorus = document.getElementById("sceneChorus");

let player = null;
let ready = false;

let lastBeatIndex = -1;
let beatTimer = null;

let currentPhraseStart = null;
let previousPhraseText = "";
let currentTypedSource = "";

let isChorusNow = false;
let chorusStartPosition = null;
let isChorusLateNow = false;
let geoSpawnTimer = null;
let lineSpawnTimer = null;

let lastSceneName = "verse1";

const phraseOrderMap = new WeakMap();

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTypedText(text, progress) {
  const chars = Array.from(text || "");
  const clamped = Math.max(0, Math.min(1, progress));
  const adjusted = Math.min(1, clamped / 0.85);
  const count = Math.max(0, Math.ceil(chars.length * adjusted));
  return chars.slice(0, count).join("");
}

function restartAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function updateSubLyric(text) {
  const nextText = text || "";
  if (subLyricEl.textContent === nextText) return;
  subLyricEl.textContent = nextText;
  restartAnimation(subLyricEl, "line-fade");
}

function updatePrevLyric(text) {
  const prevText = text || "";
  if (prevLyricEl.textContent === prevText) return;
  prevLyricEl.textContent = prevText;
  restartAnimation(prevLyricEl, "line-fade");
}

function activateScene(name) {
  if (lastSceneName === name) return;

  sceneVerse1?.classList.remove("active");
  sceneVerse2?.classList.remove("active");
  sceneChorus?.classList.remove("active");

  if (name === "verse1") sceneVerse1?.classList.add("active");
  if (name === "verse2") sceneVerse2?.classList.add("active");
  if (name === "chorus") sceneChorus?.classList.add("active");

  lastSceneName = name;
}

function triggerChorusFlash() {
  if (!chorusFlashEl) return;
  chorusFlashEl.classList.remove("active");
  void chorusFlashEl.offsetWidth;
  chorusFlashEl.classList.add("active");
}

function createBurstParticles() {
  if (!burstParticlesEl) return;

  burstParticlesEl.innerHTML = "";

  const colors = [
    "rgba(255,255,255,0.95)",
    "rgba(129,179,59,0.95)",
    "rgba(76,180,255,0.90)",
    "rgba(255,230,120,0.88)"
  ];

  for (let i = 0; i < 96; i++) {
    const dot = document.createElement("span");
    dot.className = "burst-dot";

    const angle = Math.random() * 360;
    const distance = 180 + Math.random() * 680;
    const size = 3 + Math.random() * 9;
    const duration = 0.8 + Math.random() * 0.75;
    const color = colors[Math.floor(Math.random() * colors.length)];

    dot.style.setProperty("--angle", `${angle}deg`);
    dot.style.setProperty("--distance", `${distance}px`);
    dot.style.setProperty("--size", `${size}px`);
    dot.style.setProperty("--duration", `${duration}s`);
    dot.style.setProperty("--color", color);

    burstParticlesEl.appendChild(dot);
  }
}

function triggerChorusBurst() {
  createBurstParticles();

  document.body.classList.remove("chorus-burst");
  void document.body.offsetWidth;
  document.body.classList.add("chorus-burst");

  const dots = document.querySelectorAll(".burst-dot");

  dots.forEach((dot) => {
    dot.classList.remove("active");
    dot.style.animationDelay = `${Math.random() * 0.18}s`;

    requestAnimationFrame(() => {
      dot.classList.add("active");
    });
  });

  setTimeout(() => {
    document.body.classList.remove("chorus-burst");
  }, 1800);
}

/* ================================
   サビ後半の丸・四角・リング
================================ */

function createGeoShape({ burst = false } = {}) {
  if (!geometricLayerEl) return;

  const types = ["geo-circle", "geo-square", "geo-ring", "geo-diamond"];
  const type = types[Math.floor(Math.random() * types.length)];

  const shape = document.createElement("span");
  shape.className = `geo-shape ${type}`;

  const size = burst ? 34 + Math.random() * 90 : 22 + Math.random() * 70;
  const x = burst ? 35 + Math.random() * 30 : 8 + Math.random() * 84;
  const y = burst ? 38 + Math.random() * 30 : 18 + Math.random() * 68;
  const duration = burst ? 1.0 + Math.random() * 0.8 : 2.8 + Math.random() * 2.4;
  const spin = 4 + Math.random() * 8;
  const rot = Math.random() * 360;

  shape.style.setProperty("--x", `${x}%`);
  shape.style.setProperty("--y", `${y}%`);
  shape.style.setProperty("--size", `${size}px`);
  shape.style.setProperty("--duration", `${duration}s`);
  shape.style.setProperty("--spin", `${spin}s`);
  shape.style.setProperty("--rot", `${rot}deg`);

  geometricLayerEl.appendChild(shape);

  setTimeout(() => {
    shape.remove();
  }, duration * 1000 + 300);
}

function spawnGeoWave(count = 10, burst = false) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => createGeoShape({ burst }), i * 45);
  }
}

/* ================================
   サビ後半のウニョウニョ線
================================ */

function makeWigglePath(width, height) {
  const points = [];
  const count = 6 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i++) {
    const x = (width / (count - 1)) * i;
    const y = height * (0.18 + Math.random() * 0.64);
    points.push({ x, y });
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const cx1 = prev.x + (curr.x - prev.x) * 0.35;
    const cy1 = prev.y + (Math.random() * height * 0.4 - height * 0.2);

    const cx2 = prev.x + (curr.x - prev.x) * 0.75;
    const cy2 = curr.y + (Math.random() * height * 0.4 - height * 0.2);

    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
  }

  return d;
}

function createWiggleLine({ burst = false } = {}) {
  if (!lineLayerEl) return;

  const colors = [
    "rgba(255,255,255,0.95)",
    "rgba(129,179,59,0.95)",
    "rgba(76,180,255,0.92)",
    "rgba(255,230,120,0.90)"
  ];

  const width = burst ? 220 + Math.random() * 240 : 140 + Math.random() * 220;
  const height = burst ? 80 + Math.random() * 120 : 60 + Math.random() * 90;
  const x = burst ? 30 + Math.random() * 40 : 8 + Math.random() * 84;
  const y = burst ? 28 + Math.random() * 42 : 12 + Math.random() * 70;
  const duration = burst ? 1.4 + Math.random() * 0.8 : 2.3 + Math.random() * 1.8;
  const drawDuration = 0.35 + Math.random() * 0.35;
  const stroke = 1.6 + Math.random() * 1.8;
  const rot = -20 + Math.random() * 40;
  const color = colors[Math.floor(Math.random() * colors.length)];

  const wrap = document.createElement("div");
  wrap.className = "wiggle-line";

  wrap.style.setProperty("--x", `${x}%`);
  wrap.style.setProperty("--y", `${y}%`);
  wrap.style.setProperty("--w", `${width}px`);
  wrap.style.setProperty("--h", `${height}px`);
  wrap.style.setProperty("--rot", `${rot}deg`);
  wrap.style.setProperty("--duration", `${duration}s`);
  wrap.style.setProperty("--draw-duration", `${drawDuration}s`);
  wrap.style.setProperty("--line-color", color);
  wrap.style.setProperty("--stroke", `${stroke}px`);

  const path = makeWigglePath(width, height);

  wrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}"></path>
    </svg>
  `;

  lineLayerEl.appendChild(wrap);

  setTimeout(() => {
    wrap.remove();
  }, duration * 1000 + 400);
}

function spawnWiggleWave(count = 4, burst = false) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => createWiggleLine({ burst }), i * 60);
  }
}

function startChorusLateEffects() {
  if (isChorusLateNow) return;

  isChorusLateNow = true;
  document.body.classList.add("chorus-late");

  spawnGeoWave(24, true);
  spawnWiggleWave(8, true);

  clearInterval(geoSpawnTimer);
  geoSpawnTimer = setInterval(() => {
    spawnGeoWave(5, false);
  }, 650);

  clearInterval(lineSpawnTimer);
  lineSpawnTimer = setInterval(() => {
    spawnWiggleWave(3, false);
  }, 820);
}

function stopChorusLateEffects() {
  isChorusLateNow = false;
  chorusStartPosition = null;

  document.body.classList.remove("chorus-late");

  clearInterval(geoSpawnTimer);
  geoSpawnTimer = null;

  clearInterval(lineSpawnTimer);
  lineSpawnTimer = null;

  if (geometricLayerEl) geometricLayerEl.innerHTML = "";
  if (lineLayerEl) lineLayerEl.innerHTML = "";
}

/* ================================
   再生バー
================================ */

function updateProgress(position) {
  const duration = player?.video?.duration || 0;

  if (!duration || duration <= 0) {
    progressBarEl.style.width = "0%";
    return;
  }

  const progress = Math.max(0, Math.min(1, position / duration));
  progressBarEl.style.width = `${progress * 100}%`;
}

function seekFromProgress(event) {
  if (!player || !ready) return;

  const duration = player?.video?.duration || 0;
  if (!duration || duration <= 0) return;

  const rect = progressWrapEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, x / rect.width));
  const target = duration * ratio;

  player.requestMediaSeek(target);
  updateProgress(target);
  timeEl.textContent = formatTime(target);
}

/* ================================
   歌詞
================================ */

function onNewPhrase(phrase) {
  updatePrevLyric(previousPhraseText);

  currentTypedSource = phrase.text || "";
  mainLyricEl.textContent = "";
  restartAnimation(mainLyricEl, "line-in");

  if (phrase.next) {
    updateSubLyric(phrase.next.text);
  } else {
    updateSubLyric("");
  }

  previousPhraseText = currentTypedSource;

  if (!isChorusNow) {
    const order = phraseOrderMap.get(phrase) || 0;
    activateScene(order % 2 === 0 ? "verse1" : "verse2");
  }
}

function animatePhrase(now, phrase) {
  if (!phrase.contains(now)) return;

  const start = phrase.startTime ?? now;
  const end = phrase.endTime ?? (start + 1000);
  const duration = Math.max(1, end - start);
  const progress = (now - start) / duration;

  if (currentPhraseStart !== start) {
    currentPhraseStart = start;
    onNewPhrase(phrase);
  }

  mainLyricEl.textContent = getTypedText(currentTypedSource, progress);
}

/* 歌詞がPhraseで取れない曲用の最低限フォールバック */
function animateWordFallback(now, word) {
  if (!word.contains(now)) return;

  const text = word.text || "";
  if (!text) return;

  mainLyricEl.textContent = text;
}

function triggerBeat() {
  document.body.classList.add("beat");

  clearTimeout(beatTimer);
  beatTimer = setTimeout(() => {
    document.body.classList.remove("beat");
  }, 115);
}

function resetView() {
  playButton.textContent = "Play";
  timeEl.textContent = "0.0s";
  progressBarEl.style.width = "0%";

  prevLyricEl.textContent = "";
  mainLyricEl.textContent = ready ? "Press Play" : "Loading...";
  subLyricEl.textContent = ready ? "lyrics will be typed here" : "";

  currentPhraseStart = null;
  previousPhraseText = "";
  currentTypedSource = "";
  lastBeatIndex = -1;
  isChorusNow = false;

  document.body.classList.remove("beat");
  document.body.classList.remove("chorus");
  document.body.classList.remove("chorus-burst");

  stopChorusLateEffects();
  activateScene("verse1");
}

function setupPhraseAnimations() {
  let phrase = player.video.firstPhrase;
  let order = 0;

  if (phrase) {
    while (phrase) {
      phraseOrderMap.set(phrase, order);
      phrase.animate = animatePhrase;
      phrase = phrase.next;
      order += 1;
    }

    return true;
  }

  return false;
}

function setupWordFallbackAnimations() {
  let word = player.video.firstWord;

  if (!word) return false;

  while (word) {
    word.animate = animateWordFallback;
    word = word.next;
  }

  return true;
}

function setupPlayer() {
  player = new Player({
    app: {
      token: APP_TOKEN,
    },
    mediaElement: mediaEl,
    mediaBannerPosition: "bottom",
  });

  player.addListener({
    onAppReady(app) {
      if (!app.songUrl) {
        player.createFromSongUrl(SONG_URL);
      }
    },

    onVideoReady() {
      ready = true;
      playButton.disabled = false;

      const hasPhrase = setupPhraseAnimations();

      if (!hasPhrase) {
        const hasWord = setupWordFallbackAnimations();

        if (!hasWord) {
          mainLyricEl.textContent = "歌詞データが取得できませんでした";
          subLyricEl.textContent = "曲URLまたはTextAlive対応状況を確認してください";
          return;
        }
      }

      mainLyricEl.textContent = "Press Play";
      subLyricEl.textContent = "lyrics will be typed here";
      activateScene("verse1");
    },

    onPlay() {
      playButton.textContent = "Pause";
    },

    onPause() {
      playButton.textContent = "Play";
    },

    onStop() {
      resetView();
    },

    onTimeUpdate(position) {
      timeEl.textContent = formatTime(position);
      updateProgress(position);

      const beat = player.findBeat(position);

      if (beat && beat.index !== lastBeatIndex) {
        lastBeatIndex = beat.index;
        triggerBeat();

        if (isChorusLateNow) {
          spawnGeoWave(3, true);
          spawnWiggleWave(2, true);
        }
      }

      const chorus = player.findChorus(position);

      if (chorus && !isChorusNow) {
        isChorusNow = true;
        chorusStartPosition = position;

        document.body.classList.add("chorus");
        activateScene("chorus");

        triggerChorusFlash();
        triggerChorusBurst();
      } else if (chorus && isChorusNow) {
        const chorusElapsed = position - chorusStartPosition;

        if (chorusElapsed > CHORUS_LATE_START_MS) {
          startChorusLateEffects();
        }
      } else if (!chorus && isChorusNow) {
        isChorusNow = false;

        document.body.classList.remove("chorus");
        document.body.classList.remove("chorus-burst");

        stopChorusLateEffects();
        activateScene("verse1");
      }
    },
  });
}

playButton.disabled = true;

playButton.addEventListener("click", () => {
  if (!player || !ready) return;

  if (player.isPlaying) {
    player.requestPause();
  } else {
    player.requestPlay();
  }
});

progressWrapEl.addEventListener("click", seekFromProgress);

setupPlayer();
