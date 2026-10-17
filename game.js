import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
'use strict';
const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const loading = $('loading');
const startScreen = $('start-screen');
const overScreen = $('game-over-screen');
const hud = $('hud');
const hint = $('gesture-hint');
const scoreEl = $('score');
const gemsEl = $('gems');
const bestEl = $('best');
const comboEl = $('combo');
const finalScoreEl = $('final-score');
const finalGemsEl = $('final-gems');
const soundBtn = $('sound-btn');
const pauseBtn = $('pause-btn');
const pauseScreen = $('pause-screen');
const shell = $('game-shell');
let scene, camera, renderer, clock;
let princess, princessParts = {};
let gemItems = [], obstacleItems = [], sceneryItems = [];
let particles = [], effectParticles = [], powerItems = [];
let magnetUntil = 0;
let paused = false, running = false, started = false, gameOver = false, soundOn = true;
let lane = 1, targetLane = 1;
let speed = 17, distance = 0, score = 0, gems = 0, bonusScore = 0;
let best = Number(localStorage.getItem('princessQuestBest') || 0);
let combo = 0, comboTimer = 0;
let jumpY = 0, jumpVelocity = 0, sliding = 0, runTime = 0, spawnTimer = 0.8;
let powerSpawnTimer = 12, shake = 0, audioContext = null;
let pointerStart = null;
let toastTimer = null;
if (bestEl) bestEl.textContent = String(best).padStart(6, '0');
const laneX = [-2.55, 0, 2.55];
const mat = (color, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = {
  road: mat('#4a3d62'),
  roadLine: mat('#e8d4ff', 0.4),
  grass: mat('#2a4d48'),
  bark: mat('#5a3d4a'),
  leaf: mat('#3d6b65'),
  leaf2: mat('#5a7d72'),
  gold: new THREE.MeshStandardMaterial({
    color: '#ffd46d',
    metalness: 0.75,
    roughness: 0.22,
    emissive: '#8c4c13',
    emissiveIntensity: 0.35
  }),
  gem: new THREE.MeshStandardMaterial({
    color: '#68f2f1',
    metalness: 0.45,
    roughness: 0.15,
    emissive: '#1bb8cf',
    emissiveIntensity: 0.85
  }),
  rock: mat('#6c607b'),
  block: mat('#a35a82'),
  arch: mat('#8d6b9f'),
  dress: new THREE.MeshStandardMaterial({
    color: '#e986c7',
    roughness: 0.42,
    metalness: 0.06
  }),
  dressLight: new THREE.MeshStandardMaterial({
    color: '#ffb9e4',
    roughness: 0.38
  }),
  skin: mat('#f4c7a8'),
  hair: mat('#573047'),
  hairLight: mat('#7b405c')
};
// =====================================
// SCENE
// =====================================
function makeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#9a94c4');
  scene.fog = new THREE.FogExp2('#b0a8d0', 0.011);
  camera = new THREE.PerspectiveCamera(
    56,
    innerWidth / innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 5.4, 11.2);
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  canvas.style.touchAction = 'none';
  clock = new THREE.Clock();
  const hemi = new THREE.HemisphereLight(
    '#f8edff',
    '#2d4a4e',
    2.3
  );
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe8c8', 3.4);
  sun.position.set(-8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.PointLight('#ff9fda', 28, 38);
  fill.position.set(6, 4.5, 1);
  scene.add(fill);
  const magicLight = new THREE.PointLight('#88f0ff', 12, 18);
  magicLight.position.set(0, 2.2, 4);
  scene.add(magicLight);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 200),
    materials.grass
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.16, -70);
  ground.receiveShadow = true;
  scene.add(ground);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 200),
    materials.road
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.05, -70);
  road.receiveShadow = true;
  scene.add(road);
  for (const x of [-1.28, 1.28]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 200),
      materials.roadLine
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, -0.02, -70);
    scene.add(line);
  }
  for (const x of [-4.4, 4.4]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 200),
      mat('#c4a8d8')
    );
    edge.position.set(x, 0.02, -70);
    scene.add(edge);
  }
  makePrincess();
  for (let i = 0; i < 28; i++) {
    addScenery(-i * 6.5 - 5);
  }
  for (let i = 0; i < 12; i++) {
    addRoadDecoration(-i * 11 - 10);
  }
  createAmbientParticles();
}
function mesh(
  geo,
  material,
  parent,
  x = 0,
  y = 0,
  z = 0,
  cast = true
) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// =====================================
// PRINCESS CHARACTER
// =====================================
function makePrincess() {
  princess = new THREE.Group();
  princess.position.set(0, 0, 3.2);
  scene.add(princess);
  const {
    skin,
    hair,
    hairLight,
    dress,
    dressLight,
    gold,
    gem
  } = materials;
  const eye = mat('#39253b', 0.25);
  const eyeWhite = mat('#fff9f3');
  const shoe = mat('#f7d7f1', 0.35, 0.12);
  const smileMat = mat('#a64f68');
  const gown = mesh(
    new THREE.ConeGeometry(0.7, 1.38, 24),
    dress,
    princess,
    0,
    0.82,
    0
  );
  gown.rotation.x = Math.PI;
  const bodice = mesh(
    new THREE.SphereGeometry(0.34, 24, 18),
    dressLight,
    princess,
    0,
    1.52,
    0
  );
  bodice.scale.set(0.84, 1.22, 0.72);
  const belt = mesh(
    new THREE.TorusGeometry(0.3, 0.048, 8, 22),
    gold,
    princess,
    0,
    1.38,
    0
  );
  belt.rotation.x = Math.PI / 2;
  mesh(
    new THREE.CylinderGeometry(0.1, 0.11, 0.2, 10),
    skin,
    princess,
    0,
    1.82,
    0
  );
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.15, 0);
  princess.add(headGroup);
  mesh(
    new THREE.SphereGeometry(0.38, 22, 18),
    skin,
    headGroup
  ).scale.set(0.92, 1.1, 0.88);
  mesh(
    new THREE.SphereGeometry(
      0.4, 18, 12,
      0, Math.PI * 2,
      0, Math.PI * 0.58
    ),
    hair,
    headGroup,
    0,
    0.09,
    -0.05
  );
  const hairBack = mesh(
    new THREE.SphereGeometry(0.4, 14, 12),
    hair,
    headGroup,
    0,
    -0.24,
    -0.22
  );
  hairBack.scale.set(1.1, 1.28, 0.72);
  for (const side of [-1, 1]) {
    const lock = mesh(
      new THREE.CapsuleGeometry(0.11, 0.62, 4, 8),
      hairLight,
      headGroup,
      side * 0.32,
      -0.26,
      0.02
    );
    lock.rotation.z = side * -0.14;
  }
  for (const side of [-1, 1]) {
    mesh(
      new THREE.SphereGeometry(0.058, 10, 8),
      eye,
      headGroup,
      side * 0.14,
      -0.01,
      0.32
    );
    mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      eyeWhite,
      headGroup,
      side * 0.14,
      0,
      0.345
    );
  }
  const smile = mesh(
    new THREE.TorusGeometry(0.095, 0.015, 6, 16, Math.PI),
    smileMat,
    headGroup,
    0,
    -0.14,
    0.33
  );
  smile.rotation.z = Math.PI;
  mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 0.1, 8),
    gold,
    headGroup,
    0,
    0.4,
    0
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = mesh(
      new THREE.ConeGeometry(0.078, 0.24, 5),
      gold,
      headGroup,
      Math.cos(a) * 0.23,
      0.55,
      Math.sin(a) * 0.23
    );
    p.rotation.z = Math.cos(a) * -0.26;
    p.rotation.x = Math.sin(a) * 0.26;
  }
  mesh(
    new THREE.OctahedronGeometry(0.075),
    gem,
    headGroup,
    0,
    0.44,
    0.25
  );
  const arms = [];
  for (const side of [-1, 1]) {
    const upper = mesh(
      new THREE.CapsuleGeometry(0.095, 0.45, 4, 8),
      skin,
      princess,
      side * 0.4,
      1.38,
      0
    );
    upper.rotation.z = side * 0.5;
    mesh(
      new THREE.SphereGeometry(0.145, 12, 10),
      dressLight,
      princess,
      side * 0.35,
      1.52,
      0
    ).scale.set(1, 1, 0.9);
    arms.push(upper);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.21, 0.4, 0);
    princess.add(pivot);
    mesh(
      new THREE.CapsuleGeometry(0.1, 0.4, 4, 8),
      skin,
      pivot,
      0,
      -0.16,
      0
    );
    mesh(
      new THREE.SphereGeometry(0.135, 12, 8),
      shoe,
      pivot,
      0,
      -0.37,
      0.11
    ).scale.set(1, 0.55, 1.4);
    legs.push(pivot);
  }
  princessParts = {
    headGroup,
    arms,
    legs,
    gown,
    hairBack
  };
}
// =====================================
// SCENERY
// =====================================
function addScenery(z) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = side * (5.4 + Math.random() * 9);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);
  const h = 2.4 + Math.random() * 2.8;
  mesh(
    new THREE.CylinderGeometry(0.19, 0.3, h * 0.55, 7),
    materials.bark,
    group,
    0,
    h * 0.28,
    0,
    false
  );
  const crown = mesh(
    new THREE.ConeGeometry(1.2 + Math.random() * 0.7, h * 0.68, 8),
    Math.random() < 0.5 ? materials.leaf : materials.leaf2,
    group,
    0,
    h * 0.78,
    0,
    false
  );
  crown.rotation.y = Math.random() * Math.PI;
  if (Math.random() < 0.6) {
    mesh(
      new THREE.SphereGeometry(0.13, 8, 8),
      materials.gem,
      group,
      (Math.random() - 0.5) * 1.3,
      h * 0.92,
      0.25,
      false
    );
  }
  sceneryItems.push(group);
}
function addRoadDecoration(z) {
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set(
      side * (4.8 + Math.random() * 0.6),
      0,
      z + Math.random() * 5
    );
    scene.add(group);
    mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.26, 7),
      mat('#c5a2bd'),
      group,
      0,
      0.13,
      0,
      false
    );
    const top = mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      Math.random() < 0.5 ? materials.gem : materials.gold,
      group,
      0,
      0.3,
      0,
      false
    );
    top.scale.y = 0.65;
    sceneryItems.push(group);
  }
}
// =====================================
// GEMS AND OBSTACLES
// =====================================
function addGem(z, laneIndex) {
  const g = new THREE.Group();
  g.position.set(laneX[laneIndex], 0.95, z);
  scene.add(g);
  const crystal = mesh(
    new THREE.OctahedronGeometry(0.3),
    materials.gem,
    g,
    0,
    0,
    0,
    false
  );
  crystal.scale.set(0.82, 1.28, 0.82);
  const halo = mesh(
    new THREE.TorusGeometry(0.38, 0.02, 6, 24),
    materials.gold,
    g,
    0,
    0,
    0,
    false
  );
  halo.rotation.x = Math.PI / 2;
  gemItems.push({
    group: g,
    phase: Math.random() * 6,
    collected: false
  });
}
function addObstacle(z, laneIndex, type) {
  const g = new THREE.Group();
  g.position.set(laneX[laneIndex], 0, z);
  scene.add(g);
  if (type === 'jump') {
    mesh(
      new THREE.DodecahedronGeometry(0.58),
      materials.rock,
      g,
      0,
      0.5,
      0
    ).scale.set(1, 1.18, 0.82);
    mesh(
      new THREE.SphereGeometry(0.17, 8, 8),
      materials.gold,
      g,
      -0.18,
      0.7,
      0.36
    );
  } else if (type === 'slide') {
    mesh(
      new THREE.BoxGeometry(0.17, 1.6, 0.19),
      materials.arch,
      g,
      -0.7,
      0.8,
      0
    );
    mesh(
      new THREE.BoxGeometry(0.17, 1.6, 0.19),
      materials.arch,
      g,
      0.7,
      0.8,
      0
    );
    mesh(
      new THREE.BoxGeometry(1.58, 0.26, 0.3),
      materials.gold,
      g,
      0,
      1.52,
      0
    );
    mesh(
      new THREE.BoxGeometry(1.4, 0.36, 0.26),
      materials.arch,
      g,
      0,
      1.22,
      0
    );
  } else {
    mesh(
      new THREE.BoxGeometry(1.28, 0.95, 0.68),
      materials.block,
      g,
      0,
      0.48,
      0
    );
    mesh(
      new THREE.BoxGeometry(1.32, 0.13, 0.72),
      materials.gold,
      g,
      0,
      0.96,
      0
    );
    mesh(
      new THREE.BoxGeometry(0.16, 0.68, 0.74),
      materials.gold,
      g,
      0,
      0.48,
      0
    );
  }
  obstacleItems.push({
    group: g,
    type,
    lane: laneIndex,
    checked: false
  });
}
// =====================================
// POWER-UPS
// =====================================
function addMagnet(z, laneIndex) {
  const g = new THREE.Group();
  g.position.set(laneX[laneIndex], 1.2, z);
  scene.add(g);
  const ring = mesh(
    new THREE.TorusGeometry(0.32, 0.09, 10, 22),
    materials.gold,
    g,
    0,
    0,
    0,
    false
  );
  ring.rotation.x = Math.PI / 2;
  mesh(
    new THREE.OctahedronGeometry(0.2),
    materials.gem,
    g,
    0,
    0,
    0,
    false
  );
  powerItems.push({
    group: g,
    type: 'magnet',
    phase: Math.random() * 6,
    collected: false
  });
}
function spawnPattern(difficulty = 0) {
  const z = -78;
  const r = Math.random();
  // Higher difficulty = more blocks and tighter patterns
  const hardChance = 0.55 + difficulty * 0.35;

  if (r < hardChance) {
    const laneIndex = Math.floor(Math.random() * 3);
    const type = Math.random() < (0.45 + difficulty * 0.2) ? 'jump' : 'slide';
    addObstacle(z, laneIndex, type);
    // Sometimes add a second obstacle nearby at higher difficulty
    if (difficulty > 0.4 && Math.random() < 0.35) {
      const otherLane = (laneIndex + 1) % 3;
      addObstacle(z - 8, otherLane, Math.random() < 0.5 ? 'block' : 'jump');
    }
    const other =
      (laneIndex + 1 + Math.floor(Math.random() * 2)) % 3;
    const gemCount = 4 + Math.floor(difficulty * 2);
    for (let i = 0; i < gemCount; i++) {
      addGem(z - 2.5 - i * 2.0, other);
    }
  } else if (r < 0.88) {
    const safe = Math.floor(Math.random() * 3);
    for (let i = 0; i < 3; i++) {
      if (i !== safe) addObstacle(z, i, 'block');
    }
    // At high difficulty, sometimes block the safe lane further ahead
    if (difficulty > 0.55 && Math.random() < 0.4) {
      addObstacle(z - 12, safe, 'jump');
    }
    for (let i = 0; i < 5; i++) {
      addGem(z - 1.8 - i * 1.8, safe);
    }
  } else {
    const laneIndex = Math.floor(Math.random() * 3);
    for (let i = 0; i < 7; i++) {
      addGem(z - i * 1.8, laneIndex);
    }
  }
}
// =====================================
// CLEANUP
// =====================================
function disposeGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.dispose();
    }
    // Materials are shared. Do not dispose them here.
  });
  scene.remove(group);
}
// =====================================
// PARTICLES
// =====================================
function burst(position, color = '#68f2f1') {
  for (let i = 0; i < 10; i++) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1
    });
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      material
    );
    dot.position.copy(position);
    scene.add(dot);
    effectParticles.push({
      mesh: dot,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2.8,
        (Math.random() - 0.5) * 2
      ),
      life: 0.48,
      maxLife: 0.48
    });
  }
}
function updateEffectParticles(dt) {
  for (let i = effectParticles.length - 1; i >= 0; i--) {
    const p = effectParticles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.velocity.y -= 5 * dt;
    p.mesh.material.opacity = Math.max(
      0,
      p.life / p.maxLife
    );
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      effectParticles.splice(i, 1);
    }
  }
}
function createAmbientParticles() {
  const geo = new THREE.BufferGeometry();
  const count = 50; // reduced for better performance
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 4 + 0.5;
    positions[i * 3 + 2] = -Math.random() * 90 - 5;
  }
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  );
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffe4a0,
    size: 0.08,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const points = new THREE.Points(geo, particleMaterial);
  scene.add(points);
  particles.push(points);
}
// =====================================
// CONTROLS
// =====================================
function setLane(dir) {
  targetLane = THREE.MathUtils.clamp(targetLane + dir, 0, 2);
}
function jump() {
  if (
    !running ||
    jumpY > 0.05 ||
    jumpVelocity > 0 ||
    sliding > 0
  ) {
    return;
  }
  jumpVelocity = 8.8;
  playTone(560, 0.07, 'sine');
}
function slide() {
  if (!running) return;
  // Fast-fall: if already in the air, slam down quickly
  if (jumpY > 0.15) {
    jumpVelocity = Math.min(jumpVelocity, -18);
    playTone(280, 0.06, 'triangle');
    return;
  }
  if (jumpY > 0.1) return;
  sliding = 0.75;
  playTone(380, 0.08, 'triangle');
}
function moveGesture(dx, dy) {
  if (
    !running ||
    Math.max(Math.abs(dx), Math.abs(dy)) < 28
  ) {
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    setLane(dx > 0 ? 1 : -1);
  } else if (dy < 0) {
    jump();
  } else {
    slide();
  }
}
canvas.addEventListener('pointerdown', (e) => {
  if (!running) return;
  pointerStart = {
    x: e.clientX,
    y: e.clientY,
    id: e.pointerId
  };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) { }
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerStart || e.pointerId !== pointerStart.id) {
    return;
  }
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  pointerStart = null;
  moveGesture(dx, dy);
});
function cancelGesture(e) {
  if (pointerStart && e.pointerId === pointerStart.id) {
    pointerStart = null;
  }
}
canvas.addEventListener('pointercancel', cancelGesture);
canvas.addEventListener('lostpointercapture', cancelGesture);
window.addEventListener('keydown', (e) => {
  if (!started && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.key === 'Escape' && started && !gameOver) {
    e.preventDefault();
    togglePause();
    return;
  }
  if (!running) return;
  const keys = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    ' ', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'
  ];
  if (keys.includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    setLane(-1);
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    setLane(1);
  }
  if (
    e.key === 'ArrowUp' ||
    e.key === 'w' ||
    e.key === 'W' ||
    e.key === ' '
  ) {
    jump();
  }
  if (
    e.key === 'ArrowDown' ||
    e.key === 's' ||
    e.key === 'S'
  ) {
    slide();
  }
});
// =====================================
// PAUSE
// =====================================
function togglePause(force) {
  if (!started || gameOver) return;
  paused = typeof force === 'boolean' ? force : !paused;
  running = !paused;
  if (pauseScreen) pauseScreen.hidden = !paused;
  if (pauseBtn) pauseBtn.hidden = paused;
  if (shell) {
    shell.classList.toggle('is-paused', paused);
  }
  pointerStart = null;
  if (!paused && clock) {
    clock.getDelta();
  }
}
if (pauseBtn) {
  // listener moved to bindButtons for consistency
}
const resumeBtn = $('resume-btn');
if (resumeBtn) {
  // listener moved to bindButtons for consistency
}
// =====================================
// START AND RESET
// =====================================
function startGame() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  resetWorld();
  started = true;
  running = true;
  paused = false;
  gameOver = false;
  if (startScreen) {
    startScreen.hidden = true;
    startScreen.style.display = 'none';
  }
  if (overScreen) {
    overScreen.hidden = true;
    overScreen.style.display = 'none';
  }
  if (pauseScreen) {
    pauseScreen.hidden = true;
    pauseScreen.style.display = 'none';
  }
  if (pauseBtn) pauseBtn.hidden = false;
  if (hud) hud.hidden = false;
  if (hint) hint.hidden = false;
  if (shell) shell.classList.remove('is-paused');
  if (clock) clock.getDelta();
  showToast('Your adventure begins! ✨');
}
function resetWorld() {
  for (const item of [
    ...gemItems,
    ...obstacleItems,
    ...powerItems
  ]) {
    disposeGroup(item.group);
  }
  gemItems = [];
  obstacleItems = [];
  powerItems = [];
  for (const p of effectParticles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  effectParticles = [];
  distance = 0;
  score = 0;
  gems = 0;
  bonusScore = 0;
  combo = 0;
  comboTimer = 0;
  speed = 17;
  lane = 1;
  targetLane = 1;
  jumpY = 0;
  jumpVelocity = 0;
  sliding = 0;
  runTime = 0;
  spawnTimer = 0.7;
  powerSpawnTimer = 12;
  magnetUntil = 0;
  shake = 0;
  pointerStart = null;
  princess.position.set(0, 0, 3.2);
  princess.scale.set(1, 1, 1);
  princess.rotation.set(0, 0, 0);
  princessParts.legs.forEach((leg) => {
    leg.rotation.set(0, 0, 0);
  });
  princessParts.arms.forEach((arm, i) => {
    arm.rotation.z = i === 0 ? -0.52 : 0.52;
  });
  princessParts.headGroup.rotation.set(0, 0, 0);
  princessParts.hairBack.rotation.set(0, 0, 0);
  scoreEl.textContent = '000000';
  gemsEl.textContent = '0';
  if (comboEl) comboEl.textContent = '';
}
// =====================================
// GAME OVER
// =====================================
function endGame() {
  if (!running || gameOver) return;
  running = false;
  paused = false;
  gameOver = true;
  shake = 0.35;
  if (hud) hud.hidden = true;
  if (hint) hint.hidden = true;
  if (pauseBtn) pauseBtn.hidden = true;
  if (pauseScreen) {
    pauseScreen.hidden = true;
    pauseScreen.style.display = 'none';
  }
  if (finalScoreEl) finalScoreEl.textContent = score.toLocaleString();
  if (finalGemsEl) finalGemsEl.textContent = String(gems);
  if (score > best) {
    best = score;
    try {
      localStorage.setItem('princessQuestBest', String(best));
    } catch (_) { }
    if (bestEl) bestEl.textContent = String(best).padStart(6, '0');
    showToast('New High Score! 👑');
  }
  if (overScreen) {
    overScreen.hidden = false;
    overScreen.style.display = 'flex';
    overScreen.style.zIndex = '50';
    overScreen.style.opacity = '1';
    overScreen.style.visibility = 'visible';
  }
  playTone(160, 0.4, 'triangle');
}
// =====================================
// TOAST AND SOUND
// =====================================
function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1600);
}
function playTone(freq, duration = 0.08, type = 'sine') {
  if (!soundOn) return;
  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration);
  } catch (_) { }
}
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '♫' : '♪';
    soundBtn.style.opacity = soundOn ? '1' : '0.55';
    if (soundOn) {
      playTone(680, 0.1);
    }
  });
}
// =====================================
// COLLECT ITEMS
// =====================================
function collectGem(item, index) {
  item.collected = true;
  gems++;
  combo++;
  comboTimer = 2.4;
  const mult = Math.min(5, 1 + Math.floor(combo / 4));
  bonusScore += 20 * mult;
  score = Math.floor(distance * 4.2) + gems * 28 + bonusScore;
  scoreEl.textContent = String(score).padStart(6, '0');
  gemsEl.textContent = String(gems);
  if (comboEl) {
    comboEl.textContent = combo >= 4 ? `x${mult} COMBO` : '';
  }
  burst(item.group.position, '#68f2f1');
  playTone(
    740 + Math.min(combo, 12) * 18,
    0.09,
    'sine'
  );
  disposeGroup(item.group);
  gemItems.splice(index, 1);
}
function collectPower(item, index) {
  item.collected = true;
  magnetUntil = runTime + 8;
  showToast('Magic Magnet Active! ✨');
  burst(item.group.position, '#ffd46d');
  playTone(880, 0.16, 'sine');
  disposeGroup(item.group);
  powerItems.splice(index, 1);
}
// =====================================
// GAME UPDATE
// =====================================
function update(dt) {
  if (!paused) {
    updateEffectParticles(dt);
  }
  if (!running) {
    if (princess && !gameOver && !paused) {
      princess.position.y =
        Math.sin(performance.now() * 0.0014) * 0.045;
      princess.rotation.y =
        Math.sin(performance.now() * 0.0007) * 0.05;
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.2);
    }
    if (camera && princess) {
      const sx = (Math.random() - 0.5) * shake * 0.55;
      const sy = (Math.random() - 0.5) * shake * 0.4;
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        princess.position.x * 0.24 + sx,
        3,
        dt
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        5.25 + sy,
        3,
        dt
      );
      camera.lookAt(
        princess.position.x * 0.12,
        1.45,
        -3.2
      );
    }
    return;
  }
  runTime += dt;
  distance += speed * dt;
  // Progressive difficulty: speed increases faster the further you go
  const difficulty = Math.min(1, distance / 1800);
  speed = Math.min(42, 16 + distance * 0.009 + difficulty * 8);
  score = Math.floor(distance * 4.5) + gems * 30 + bonusScore;
  scoreEl.textContent = String(score).padStart(6, '0');
  gemsEl.textContent = String(gems);
  // Combo timer
  if (combo > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      combo = 0;
      if (comboEl) {
        comboEl.textContent = '';
      }
    }
  }
  // Lane movement
  const targetX = laneX[targetLane];
  princess.position.x = THREE.MathUtils.damp(
    princess.position.x,
    targetX,
    14,
    dt
  );
  if (Math.abs(princess.position.x - targetX) < 0.035) {
    lane = targetLane;
  }
  // Jump physics
  if (jumpY > 0 || jumpVelocity > 0) {
    jumpVelocity -= 20 * dt;
    jumpY += jumpVelocity * dt;
    if (jumpY <= 0) {
      jumpY = 0;
      jumpVelocity = 0;
    }
  }
  if (sliding > 0) {
    sliding = Math.max(0, sliding - dt);
  }
  princess.position.y = jumpY;
  princess.scale.y = sliding > 0 ? 0.58 : 1;
  princess.position.z = 3.2;
  // Running animation
  const cycle = Math.sin(runTime * 14);
  princessParts.legs.forEach((leg, i) => {
    leg.rotation.x = sliding > 0
      ? 0.15
      : cycle * (i === 0 ? 1 : -1) * 0.78;
  });
  princessParts.arms.forEach((arm, i) => {
    arm.rotation.z =
      (i === 0 ? -0.52 : 0.52) +
      cycle * (i === 0 ? -0.22 : 0.22);
  });
  princessParts.headGroup.rotation.z =
    Math.sin(runTime * 7) * 0.03;
  princessParts.hairBack.rotation.x =
    Math.sin(runTime * 9) * 0.08;
  princess.rotation.z = THREE.MathUtils.damp(
    princess.rotation.z,
    (targetLane - lane) * -0.04,
    8,
    dt
  );
  // Camera follow
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    princess.position.x * 0.24,
    2.2,
    dt
  );
  camera.position.y =
    5.25 + Math.sin(runTime * 12) * 0.03 + jumpY * 0.15;
  camera.lookAt(
    princess.position.x * 0.12,
    1.45,
    -3.2
  );
  // Spawn obstacles and gems (more frequent as difficulty rises)
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnPattern(difficulty);
    spawnTimer =
      Math.max(0.42, 1.15 - difficulty * 0.55 - (speed - 16) * 0.015) +
      Math.random() * 0.22;
  }
  // Spawn power-ups
  powerSpawnTimer -= dt;
  if (powerSpawnTimer <= 0) {
    addMagnet(-78, Math.floor(Math.random() * 3));
    powerSpawnTimer = 18 + Math.random() * 12;
  }
  // Gems
  for (let i = gemItems.length - 1; i >= 0; i--) {
    const item = gemItems[i];
    item.group.position.z += speed * dt;
    item.group.rotation.y += dt * 1.9;
    item.group.position.y =
      0.95 + Math.sin(runTime * 4.2 + item.phase) * 0.14;
    // Magnet effect
    if (runTime < magnetUntil && item.group.position.z > -12) {
      item.group.position.x = THREE.MathUtils.damp(
        item.group.position.x,
        princess.position.x,
        2.8,
        dt
      );
    }
    // Collection
    if (
      item.group.position.z > 2.0 &&
      Math.abs(item.group.position.x - princess.position.x) < 1.0 &&
      Math.abs(item.group.position.z - princess.position.z) < 1.45
    ) {
      collectGem(item, i);
      continue;
    }
    if (item.group.position.z > 9) {
      disposeGroup(item.group);
      gemItems.splice(i, 1);
    }
  }
  // Power-ups
  for (let i = powerItems.length - 1; i >= 0; i--) {
    const item = powerItems[i];
    item.group.position.z += speed * dt;
    item.group.rotation.y += dt * 1.8;
    item.group.position.y =
      1.2 + Math.sin(runTime * 4 + item.phase) * 0.16;
    if (
      item.group.position.z > 2 &&
      Math.abs(item.group.position.x - princess.position.x) < 1.05 &&
      Math.abs(item.group.position.z - princess.position.z) < 1.5
    ) {
      collectPower(item, i);
      continue;
    }
    if (item.group.position.z > 9) {
      disposeGroup(item.group);
      powerItems.splice(i, 1);
    }
  }
  // Obstacles and collisions
  for (let i = obstacleItems.length - 1; i >= 0; i--) {
    const o = obstacleItems[i];
    o.group.position.z += speed * dt;
    const closeEnough =
      Math.abs(o.group.position.z - princess.position.z) < 1.5;
    if (!o.checked && closeEnough) {
      const sameLane =
        Math.abs(o.group.position.x - princess.position.x) < 1.05;
      const jumping =
        jumpY > (o.type === 'jump' ? 0.85 : 0.42);
      const slidingNow = sliding > 0.08;
      let hit = sameLane;
      if (o.type === 'jump' && jumping) {
        hit = false;
      }
      if (o.type === 'slide' && slidingNow) {
        hit = false;
      }
      if (hit) {
        o.checked = true;
        playTone(120, 0.28, 'sawtooth');
        endGame();
        return;
      }
    }
    // Do not check an obstacle again after it passes.
    if (o.group.position.z >= princess.position.z + 1.5) {
      o.checked = true;
    }
    if (o.group.position.z > 10) {
      disposeGroup(o.group);
      obstacleItems.splice(i, 1);
    }
  }
  // Recycle scenery
  for (const item of sceneryItems) {
    item.position.z += speed * dt;
    if (item.position.z > 16) {
      item.position.z = -125 - Math.random() * 40;
      if (Math.abs(item.position.x) < 5) {
        item.position.x =
          (Math.random() < 0.5 ? -1 : 1) *
          (5.5 + Math.random() * 9);
      }
    }
  }
  // Ambient particles
  for (const p of particles) {
    const pos = p.geometry.attributes.position.array;
    for (let i = 2; i < pos.length; i += 3) {
      pos[i] += speed * dt * 0.35;
      if (pos[i] > 12) {
        pos[i] = -100 - Math.random() * 30;
      }
    }
    p.geometry.attributes.position.needsUpdate = true;
  }
}
// =====================================
// ANIMATION LOOP
// =====================================
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.035);
  update(dt);
  renderer.render(scene, camera);
}
// =====================================
// BUTTONS (robust attachment)
// =====================================
function bindButtons() {
  const startBtn = $('start-btn');
  const restartBtn = $('restart-btn');
  const resumeBtn = $('resume-btn');
  const pauseBtn = $('pause-btn');

  if (startBtn) {
    startBtn.onclick = null;
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startGame();
    });
  }
  if (restartBtn) {
    restartBtn.onclick = null;
    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startGame();
    });
  }
  if (resumeBtn) {
    resumeBtn.onclick = null;
    resumeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePause(false);
    });
  }
  if (pauseBtn) {
    pauseBtn.onclick = null;
    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePause(true);
    });
  }
}

bindButtons();
// =====================================
// RESIZE
// =====================================
window.addEventListener('resize', () => {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.setSize(innerWidth, innerHeight);
});
// =====================================
// INITIALIZATION
// =====================================
try {
  makeScene();
  camera.lookAt(0, 1.35, -3);
  animate();
  setTimeout(() => {
    if (loading) {
      loading.classList.add('done');
    }
  }, 700);
} catch (err) {
  console.error('Princess Quest failed to initialize:', err);
  if (loading) {
    loading.innerHTML =
      '<span>Failed to load the 3D world. Check your internet connection and reload.</span>';
  }
}
