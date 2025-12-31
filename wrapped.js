// wrapped.js
const scenes = Array.from(document.querySelectorAll(".scene"));
let currentScene = scenes.findIndex((s) => s.classList.contains("active"));
if (currentScene < 0) currentScene = 0;

let isTransitioning = false;
let lastInputAt = 0;
let resizeTimer;

const INPUT_THROTTLE_MS = 300;
const RESIZE_DEBOUNCE_MS = 150;

let DURATION = 2000; // moet matchen met --dur
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function setExitDistances(scene) {
  scene.querySelectorAll(".anim").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const distance = rect.bottom + 80; // safety
    el.style.setProperty("--exitY", `-${distance}px`); // negatief = naar boven
  });
}

function clearExitDistances(scene) {
  scene.querySelectorAll(".anim").forEach((el) => {
    el.style.removeProperty("--exitY");
  });
}

function setEnterDistances(prevScene, nextScene) {
  const fallback = window.innerHeight + 80;

  const prevAnim = prevScene
    ? Array.from(prevScene.querySelectorAll(".anim"))
    : [];
  const nextAnim = Array.from(nextScene.querySelectorAll(".anim"));

  nextAnim.forEach((el, i) => {
    const prevEl = prevAnim[i] || prevAnim[0];
    let dist = fallback;

    if (prevEl) {
      const exitY = getComputedStyle(prevEl).getPropertyValue("--exitY").trim(); // bv "-834px"
      const n = parseFloat(exitY.replace("px", ""));
      if (Number.isFinite(n)) dist = Math.abs(n); // ✅ altijd positief
    }

    // ✅ positief = van onder
    el.style.setProperty("--enterY", `${dist}px`);
  });
}

function clearEnterDistances(scene) {
  scene.querySelectorAll(".anim").forEach((el) => {
    el.style.removeProperty("--enterY");
  });
}

function resetSceneCustomProps(scene) {
  clearEnterDistances(scene);
  clearExitDistances(scene);
}

function refreshActiveSceneMetrics() {
  if (isTransitioning) return;

  const activeScene = scenes[currentScene];
  if (!activeScene) return;

  // reset alles zodat we vanaf schone props meten
  scenes.forEach(resetSceneCustomProps);

  setExitDistances(activeScene);

  const total = scenes.length;
  const nextScene = scenes[(currentScene + 1) % total];
  const prevScene = scenes[(currentScene - 1 + total) % total];

  if (nextScene && nextScene !== activeScene) {
    setEnterDistances(activeScene, nextScene);
  }
  if (prevScene && prevScene !== activeScene && prevScene !== nextScene) {
    setEnterDistances(activeScene, prevScene);
  }
}

function shouldHandleInput() {
  if (isTransitioning) return false;

  const now = Date.now();
  if (now - lastInputAt < INPUT_THROTTLE_MS) return false;

  lastInputAt = now;
  return true;
}

function stepScene(delta) {
  if (!shouldHandleInput()) return;
  goToScene(currentScene + delta);
}

function goToScene(nextIndex) {
  if (isTransitioning) return;

  const total = scenes.length;
  const targetIndex = (nextIndex + total) % total;
  if (targetIndex === currentScene) return;

  isTransitioning = true;

  const oldScene = scenes[currentScene];
  const newScene = scenes[targetIndex];

  // 1) exit distances oude scene
  setExitDistances(oldScene);

  // 2) nieuwe scene meteen "entering" activeren
  newScene.classList.add("active", "is-entering");

  // 3) enter distances voor nieuwe scene zetten (NU, terwijl is-entering actief is)
  setEnterDistances(oldScene, newScene);

  // 4) oude scene gaat leaving
  oldScene.classList.add("is-leaving");

  // 5) volgende frame: newScene mag naar 0 (van onder naar boven)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newScene.classList.remove("is-entering");
    });
  });

  // 6) cleanup na animatie
  window.setTimeout(() => {
    oldScene.classList.remove("active", "is-leaving");
    clearExitDistances(oldScene);

    clearEnterDistances(newScene);

    currentScene = targetIndex;
    isTransitioning = false;
  }, DURATION);
}

function applyMotionPreference(e) {
  const reduce = e?.matches ?? motionQuery.matches;
  DURATION = reduce ? 0 : 2000;
  document.documentElement.style.setProperty("--dur", `${DURATION}ms`);
}

applyMotionPreference(motionQuery);
motionQuery.addEventListener("change", applyMotionPreference);

// keyboard
document.addEventListener("keydown", (e) => {
  if (isTransitioning) return;

  if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    stepScene(1);
  }
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    stepScene(-1);
  }
});

// click
const deck = document.getElementById("deck");
function isInteractiveTarget(target) {
  const interactiveTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION", "LABEL"];
  return (
    interactiveTags.includes(target.tagName) ||
    target.closest(".wrapped-panel") ||
    target.closest("[contenteditable='true']")
  );
}

deck?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (isInteractiveTarget(target)) return;
  stepScene(1);
});

// touch
let touchStart = null;

document.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
});

document.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart || e.changedTouches.length === 0) return;

    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStart.x;
    const deltaY = t.clientY - touchStart.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    touchStart = null;

    const TAP_THRESHOLD = 10;
    const SWIPE_THRESHOLD = 30;

    const isTap = absX <= TAP_THRESHOLD && absY <= TAP_THRESHOLD;
    if (isTap) {
      stepScene(1);
      return;
    }

    const isHorizontal = absX > absY && absX > SWIPE_THRESHOLD;
    if (!isHorizontal) return;

    e.preventDefault();
    if (deltaX < 0) {
      stepScene(1);
    } else {
      stepScene(-1);
    }
  },
  { passive: false }
);

// resize (debounced)
window.addEventListener("resize", () => {
  if (resizeTimer) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    refreshActiveSceneMetrics();
  }, RESIZE_DEBOUNCE_MS);
});
