// wrapped.js
const scenes = Array.from(document.querySelectorAll(".scene"));
let currentScene = scenes.findIndex((s) => s.classList.contains("active"));
if (currentScene < 0) currentScene = 0;

let isTransitioning = false;

const DURATION = 2000; // moet matchen met --dur

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

// keyboard
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    goToScene(currentScene + 1);
  }
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    goToScene(currentScene - 1);
  }
});

// click
document.addEventListener("click", () => {
  goToScene(currentScene + 1);
});
