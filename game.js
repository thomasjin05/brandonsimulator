const startScreen = document.querySelector("#startScreen");
const gameScreen = document.querySelector("#gameScreen");
const startButton = document.querySelector("#startButton");
const plane = document.querySelector("#plane");
const brandonTemplate = document.querySelector("#brandon");
const shadowTemplate = document.querySelector("#shadow");
const handButton = document.querySelector("#handButton");
const targetButton = document.querySelector("#targetButton");
const tomatoButton = document.querySelector("#tomatoButton");
const resetButton = document.querySelector("#resetButton");
const statusText = document.querySelector("#status");
const crosshair = document.querySelector("#crosshair");
const barkPlayer = document.querySelector("#barkPlayer");

const roastLines = [
  "I am not exactly a genius",
  "我是笨狗",
  "汪汪汪汪汪汪",
  "6767676767676767",
  "I like smelly feet and little boys",
  "Epstein is my hero",
  "I support Arsenal, duh uh",
  "I make terrible decisions with confidence",
  "My drip has a software update pending",
  "I failed the vibe check",
  "Today I chose nonsense"
];

const owLines = [
  "大胆",
  "OW!",
  "Tomato damage detected.",
  "That was personal.",
  "I regret standing here."
];

const DANCE_DURATION_MS = 1500;
const KNOCKDOWN_DURATION_MS = 1500;
const MAX_BRANDONS = 128;
const AMBIENT_SPEECH_MIN_MS = 10000;
const AMBIENT_SPEECH_MAX_MS = 15000;
const SPEECH_BUBBLE_DURATION_MS = 6000;
const TAG_OUT_DURATION_MS = 480;
const SOUND_PATHS = {
  bark: "./assets/brandon-bark.mp3",
  fart: "./assets/brandon-fart.mp3"
};

let started = false;
let lastTime = 0;
let audioContext;
let barkEffects;
let ambientSpeechTimer;
let activeTool = "hand";
const brandons = [];
const supportsBassBoost = window.location.protocol !== "file:";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function showCrowdSpeech(lines) {
  const line = pickLine(lines);
  showSpeech(pickLine(brandons), line);
}

function scheduleAmbientSpeech() {
  window.clearTimeout(ambientSpeechTimer);
  ambientSpeechTimer = window.setTimeout(() => {
    if (started && brandons.length) {
      showCrowdSpeech(roastLines);
      playDogBark();
    }
    scheduleAmbientSpeech();
  }, randomBetween(AMBIENT_SPEECH_MIN_MS, AMBIENT_SPEECH_MAX_MS));
}

function showSpeech(actor, text, delay = 0) {
  actor.speech?.remove();
  const speech = document.createElement("span");
  speech.className = "speech-label";
  speech.textContent = text;
  speech.style.setProperty("--speech-tilt", `${randomBetween(-8, 8)}deg`);
  actor.speech = speech;

  window.setTimeout(() => {
    if (actor.speech === speech) actor.element.appendChild(speech);
  }, delay);

  window.setTimeout(() => {
    if (actor.speech === speech) actor.speech = null;
    speech.remove();
  }, delay + SPEECH_BUBBLE_DURATION_MS);
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext ||= new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function getCrowdAudioStrength() {
  return clamp(Math.log2(Math.max(1, brandons.length)), 0, 7);
}

function createCrowdEffects(sound) {
  if (!supportsBassBoost) return null;
  const context = getAudioContext();
  if (!context) return null;

  const source = context.createMediaElementSource(sound);
  const bass = context.createBiquadFilter();
  const gain = context.createGain();
  const compressor = context.createDynamicsCompressor();

  bass.type = "lowshelf";
  bass.frequency.value = 220;
  compressor.threshold.value = -14;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;

  source.connect(bass);
  bass.connect(gain);
  gain.connect(compressor);
  compressor.connect(context.destination);

  return { bass, gain };
}

function updateCrowdEffects(effects) {
  if (!effects) return;
  const strength = getCrowdAudioStrength();
  effects.bass.gain.value = 2 + strength * 2.1;
  effects.gain.gain.value = 1 + strength * 0.18;
}

function playTomatoSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.9, now + 0.015);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  output.connect(context.destination);

  const thump = context.createOscillator();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(145, now);
  thump.frequency.exponentialRampToValueAtTime(46, now + 0.18);
  thump.connect(output);
  thump.start(now);
  thump.stop(now + 0.22);

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.28, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(860, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.28);
  noise.buffer = noiseBuffer;
  noise.connect(filter);
  filter.connect(output);
  noise.start(now + 0.02);
  noise.stop(now + 0.32);
}

function playTagSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const output = context.createGain();
  const zap = context.createOscillator();
  const pop = context.createOscillator();

  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.82, now + 0.012);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  output.connect(context.destination);

  zap.type = "sawtooth";
  zap.frequency.setValueAtTime(760, now);
  zap.frequency.exponentialRampToValueAtTime(180, now + 0.16);
  zap.connect(output);
  zap.start(now);
  zap.stop(now + 0.18);

  pop.type = "triangle";
  pop.frequency.setValueAtTime(118, now + 0.03);
  pop.frequency.exponentialRampToValueAtTime(52, now + 0.2);
  pop.connect(output);
  pop.start(now + 0.03);
  pop.stop(now + 0.22);
}

function playFartSound() {
  const sound = new Audio(SOUND_PATHS.fart);
  const length = randomBetween(1000, 1900);
  const effects = createCrowdEffects(sound);
  updateCrowdEffects(effects);
  sound.volume = 1;
  sound.playbackRate = randomBetween(0.96, 1.04);
  sound.play().catch(() => {});
  window.setTimeout(() => {
    sound.pause();
    sound.currentTime = 0;
  }, length);
}

function playDogBark() {
  const bark = barkPlayer;
  barkEffects ||= createCrowdEffects(bark);
  updateCrowdEffects(barkEffects);
  bark.src = SOUND_PATHS.bark;
  bark.currentTime = 0;
  bark.volume = 1;
  bark.playbackRate = randomBetween(0.98, 1.02);
  bark.play().catch(() => {});
}

function unlockDogBark() {
  barkEffects ||= createCrowdEffects(barkPlayer);
  updateCrowdEffects(barkEffects);
  barkPlayer.src = SOUND_PATHS.bark;
  barkPlayer.volume = 0;
  barkPlayer.play()
    .then(() => {
      barkPlayer.pause();
      barkPlayer.currentTime = 0;
      barkPlayer.volume = 1;
    })
    .catch(() => {
      barkPlayer.volume = 1;
    });
}

function chooseTarget(actor, now) {
  actor.target = {
    x: randomBetween(15, 85),
    y: randomBetween(34, 88)
  };
  actor.nextTargetAt = now + randomBetween(1800, 3600);
}

function createBrandon(x = 50, y = 54, spawning = false) {
  const isFirst = brandons.length === 0;
  const element = isFirst ? brandonTemplate : brandonTemplate.cloneNode(true);
  const shadow = isFirst ? shadowTemplate : shadowTemplate.cloneNode();

  element.classList.remove("dancing", "walking", "fallen", "spawning", "tagged-out");
  shadow.classList.remove("spawning", "tagged-out");

  if (!isFirst) {
    element.removeAttribute("id");
    shadow.removeAttribute("id");
    element.querySelectorAll(".speech-label").forEach((speech) => speech.remove());
    plane.append(shadow, element);
  }

  const actor = {
    element,
    shadow,
    pos: { x, y },
    target: { x, y },
    nextTargetAt: 0,
    moving: false,
    danceEndAt: 0,
    fallEndAt: 0,
    speech: null,
    taggedOut: false
  };

  element.addEventListener("click", () => pressBrandon(actor));
  if (spawning) {
    element.classList.add("spawning");
    shadow.classList.add("spawning");
    window.setTimeout(() => {
      element.classList.remove("spawning");
      shadow.classList.remove("spawning");
    }, 480);
  }

  brandons.push(actor);
  chooseTarget(actor, performance.now());
  setPose(actor);
  return actor;
}

function clearActor(actor) {
  actor.speech?.remove();
  actor.speech = null;
  actor.element.classList.remove("dancing", "walking", "fallen", "spawning", "tagged-out");
  actor.shadow.classList.remove("spawning", "tagged-out");
}

function setPose(actor) {
  const dx = actor.target.x - actor.pos.x;
  const facing = dx < 0 ? -1 : 1;
  const scale = 0.72 + actor.pos.y / 170;

  actor.element.style.left = `${actor.pos.x}%`;
  actor.element.style.top = `${actor.pos.y}%`;
  actor.element.style.setProperty("--facing", facing);
  actor.element.style.scale = scale;
  actor.element.style.zIndex = String(Math.round(actor.pos.y) + 4);

  actor.shadow.style.left = `${actor.pos.x}%`;
  actor.shadow.style.top = `${actor.pos.y + 1}%`;
  actor.shadow.style.scale = 0.7 + actor.pos.y / 140;
  actor.shadow.style.zIndex = String(Math.round(actor.pos.y));
}

function endDance(actor, now) {
  actor.danceEndAt = 0;
  actor.element.classList.remove("dancing");
  chooseTarget(actor, now);
}

function standUp(actor, now) {
  actor.fallEndAt = 0;
  actor.element.classList.remove("fallen");
  chooseTarget(actor, now);
}

function tick(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(40, now - lastTime) / 1000;
  lastTime = now;

  brandons.forEach((actor) => {
    if (actor.taggedOut) return;
    if (actor.danceEndAt && now >= actor.danceEndAt) endDance(actor, now);
    if (actor.fallEndAt && now >= actor.fallEndAt) standUp(actor, now);

    if (started && !actor.danceEndAt && !actor.fallEndAt) {
      if (now > actor.nextTargetAt) chooseTarget(actor, now);
      const dx = actor.target.x - actor.pos.x;
      const dy = actor.target.y - actor.pos.y;
      const distance = Math.hypot(dx, dy);
      const speed = 18 + brandons.length / 7;

      if (distance > 0.4) {
        actor.pos.x += (dx / distance) * speed * dt;
        actor.pos.y += (dy / distance) * speed * dt;
        actor.moving = true;
      } else {
        actor.moving = false;
        if (now > actor.nextTargetAt - 1200) chooseTarget(actor, now);
      }
    } else {
      actor.moving = false;
    }

    actor.element.classList.toggle("walking", actor.moving && !actor.danceEndAt && !actor.fallEndAt);
    setPose(actor);
  });

  requestAnimationFrame(tick);
}

function startGame() {
  started = true;
  unlockDogBark();
  startScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  if (!brandons.length) createBrandon();
  setTool("hand");
  scheduleAmbientSpeech();
  statusText.textContent = "tap a Brandon to multiply the crowd";
}

function pressBrandon(actor) {
  if (!started || actor.fallEndAt) return;
  if (activeTool === "target") {
    tagBrandon(actor);
    return;
  }
  multiplyBrandons();
  danceAll();
  playFartSound();
}

function setTool(tool) {
  activeTool = tool;
  const targeting = tool === "target";
  handButton.classList.toggle("is-selected", !targeting);
  targetButton.classList.toggle("is-selected", targeting);
  gameScreen.classList.toggle("target-mode", targeting);
  crosshair.classList.toggle("is-hidden", !targeting);
  if (!started) return;
  statusText.textContent = targeting
    ? "target a Brandon to tag one out"
    : "tap a Brandon to multiply the crowd";
}

function moveCrosshair(event) {
  if (activeTool !== "target") return;
  crosshair.style.setProperty("--crosshair-x", `${event.clientX}px`);
  crosshair.style.setProperty("--crosshair-y", `${event.clientY}px`);
}

function tagBrandon(actor) {
  if (actor.taggedOut) return;
  playTagSound();

  if (brandons.length === 1) {
    actor.danceEndAt = 0;
    actor.fallEndAt = performance.now() + KNOCKDOWN_DURATION_MS;
    actor.element.classList.remove("dancing", "walking");
    actor.element.classList.add("fallen");
    statusText.textContent = "the last Brandon stays";
    return;
  }

  actor.taggedOut = true;
  actor.speech?.remove();
  actor.element.classList.remove("dancing", "walking", "fallen");
  actor.element.classList.add("tagged-out");
  actor.shadow.classList.add("tagged-out");

  const index = brandons.indexOf(actor);
  if (index >= 0) brandons.splice(index, 1);
  statusText.textContent = `${brandons.length} Brandons`;

  window.setTimeout(() => {
    actor.element.remove();
    actor.shadow.remove();
  }, TAG_OUT_DURATION_MS);
}

function multiplyBrandons() {
  const originals = brandons.slice();
  originals.forEach((actor) => {
    if (brandons.length >= MAX_BRANDONS) return;
    createBrandon(
      clamp(actor.pos.x + randomBetween(-8, 8), 13, 87),
      clamp(actor.pos.y + randomBetween(-8, 8), 33, 89),
      true
    );
  });

  statusText.textContent = brandons.length >= MAX_BRANDONS
    ? `${MAX_BRANDONS} Brandons is enough Brandon for one plane`
    : `${brandons.length} Brandons`;
}

function resetBrandons() {
  if (!started) return;

  const [first, ...extras] = brandons;
  extras.forEach((actor) => {
    clearActor(actor);
    actor.element.remove();
    actor.shadow.remove();
  });
  brandons.length = first ? 1 : 0;

  if (!first) {
    createBrandon();
  } else {
    clearActor(first);
    first.pos = { x: 50, y: 54 };
    first.target = { x: 50, y: 54 };
    first.danceEndAt = 0;
    first.fallEndAt = 0;
    first.moving = false;
    chooseTarget(first, performance.now());
    setPose(first);
  }

  statusText.textContent = "1 Brandon";
}

function danceAll() {
  const now = performance.now();
  brandons.forEach((actor) => {
    if (actor.fallEndAt) return;
    actor.danceEndAt = now + DANCE_DURATION_MS;
    actor.element.classList.remove("walking");
    actor.element.classList.add("dancing");
  });
}

function throwTomato() {
  if (!started || !brandons.length) return;
  let reacted = false;

  brandons.slice().forEach((actor, index) => {
    window.setTimeout(() => {
      launchTomato(actor, () => {
        if (!reacted) {
          reacted = true;
          knockDownAll();
        }
      });
    }, Math.min(index * 42, 420));
  });
}

function launchTomato(actor, onFirstImpact) {
  const tomato = document.createElement("span");
  tomato.className = "flying-tomato";
  document.body.appendChild(tomato);

  const buttonBox = tomatoButton.getBoundingClientRect();
  const brandonBox = actor.element.getBoundingClientRect();
  const startX = buttonBox.left + buttonBox.width / 2;
  const startY = buttonBox.top + buttonBox.height / 2;
  const endX = brandonBox.left + brandonBox.width * 0.54;
  const endY = brandonBox.top + brandonBox.height * 0.34;

  const flight = tomato.animate(
    [
      { transform: `translate(${startX}px, ${startY}px) scale(0.75) rotate(0deg)` },
      { transform: `translate(${(startX + endX) / 2}px, ${Math.min(startY, endY) - 130}px) scale(1.05) rotate(360deg)` },
      { transform: `translate(${endX}px, ${endY}px) scale(1) rotate(720deg)` }
    ],
    { duration: 620, easing: "cubic-bezier(.18,.78,.28,1)", fill: "forwards" }
  );

  flight.onfinish = () => {
    tomato.remove();
    playTomatoSound();
    splat(endX, endY);
    onFirstImpact();
  };
}

function splat(x, y) {
  const mark = document.createElement("span");
  mark.className = "splat";
  mark.style.left = `${x}px`;
  mark.style.top = `${y}px`;
  document.body.appendChild(mark);
  window.setTimeout(() => mark.remove(), 750);
}

function knockDownAll() {
  const now = performance.now();
  brandons.forEach((actor) => {
    actor.danceEndAt = 0;
    actor.fallEndAt = now + KNOCKDOWN_DURATION_MS;
    actor.element.classList.remove("dancing", "walking");
    actor.element.classList.add("fallen");
  });
  showCrowdSpeech(owLines);
}

startButton.addEventListener("click", startGame);
handButton.addEventListener("click", () => setTool("hand"));
targetButton.addEventListener("click", () => setTool("target"));
tomatoButton.addEventListener("click", throwTomato);
resetButton.addEventListener("click", resetBrandons);
gameScreen.addEventListener("pointermove", moveCrosshair);
requestAnimationFrame(tick);
