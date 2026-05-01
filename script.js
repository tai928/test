const { Player } = TextAliveApp;

/*
  ここを対象曲URLに変更。
  マジカルミライコンテスト対象曲のURLを入れる。
*/
const SONG_URL = "https://www.youtube.com/watch?v=ygY2qObZv24";

// TextAlive App Token
const APP_TOKEN = "IWGcvQmDMQHpO49o";

const prevLyricEl = document.getElementById("prevLyric");
const mainLyricEl = document.getElementById("mainLyric");
const subLyricEl = document.getElementById("subLyric");
const playButton = document.getElementById("playButton");
const timeEl = document.getElementById("time");
const mediaEl = document.getElementById("media");

const chorusFlashEl = document.getElementById("chorusFlash");
const burstParticlesEl = document.getElementById("burstParticles");

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
let lastSceneName = "verse1";

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTypedText(text, progress) {
  const chars = Array.from(text || "");
  const clamped = Math.max(0, Math.min(1, progress));

  // 85%くらいで全文が出て、最後に少し余韻が残る
  const adjusted = Math.min(1, clamped / 0.85);
  const count = Math.max(0, Math.ceil(chars.length * adjusted));

  return chars.slice(0, count).join("");
}

function restartAnimation(el, className) {
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

  sceneVerse1.classList.remove("active");
  sceneVerse2.classList.remove("active");
  sceneChorus.classList.remove("active");

  if (name === "verse1") sceneVerse1.classList.add("active");
  if (name === "verse2") sceneVerse2.classList.add("active");
  if (name === "chorus") sceneChorus.classList.add("active");

  lastSceneName = name;
}

function triggerChorusFlash() {
  chorusFlashEl.classList.remove("active");
  void chorusFlashEl.offsetWidth;
  chorusFlashEl.classList.add("active");
}

function createBurstParticles() {
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

  // 通常パートだけ背景を交互に切り替える
  if (!isChorusNow) {
    const order = phrase._order ?? 0;
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

  activateScene("verse1");
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

      let phrase = player.video.firstPhrase;
      let order = 0;

      while (phrase) {
        phrase._order = order;
        phrase.animate = animatePhrase;
        phrase = phrase.next;
        order += 1;
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

      const beat = player.findBeat(position);

      if (beat && beat.index !== lastBeatIndex) {
        lastBeatIndex = beat.index;
        triggerBeat();
      }

      const chorus = player.findChorus(position);

      if (chorus && !isChorusNow) {
        isChorusNow = true;

        document.body.classList.add("chorus");
        activateScene("chorus");

        triggerChorusFlash();
        triggerChorusBurst();
      } else if (!chorus && isChorusNow) {
        isChorusNow = false;

        document.body.classList.remove("chorus");
        document.body.classList.remove("chorus-burst");

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

setupPlayer();
