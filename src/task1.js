import * as THREE from 'three';

// ===== СТАН КЕРУВАННЯ =====
let rotating = true;
let rotSpeed = 0.015;
let useTexture = false;
let useWireframe = false;

// ===== СЦЕНА =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// ===== ОСВІТЛЕННЯ =====
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(1, 2, 3);
scene.add(dirLight);
const pointLight = new THREE.PointLight(0x88aaff, 0.8, 5);
pointLight.position.set(-1, 1, -1);
scene.add(pointLight);

// ===== МАТЕРІАЛИ =====
const mat1 = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.3, metalness: 0.5 });
const mat2 = new THREE.MeshPhongMaterial({ color: 0x44ff88, shininess: 100 });
const mat3 = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.7, metalness: 0.1 });

// ===== ОБ'ЄКТИ — Варіант 5: TorusKnot, Tube, Capsule =====
// TorusKnot — зліва
const torusKnot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.08, 0.025, 128, 16),
  mat1
);
torusKnot.position.set(-0.38, 0.0, -1.5);
scene.add(torusKnot);

// Tube — по центру (спіральний шлях)
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,    -0.08, 0),
  new THREE.Vector3(0.08,  0,    0),
  new THREE.Vector3(0,     0.08, 0),
  new THREE.Vector3(-0.08, 0,    0),
  new THREE.Vector3(0,    -0.08, 0),
]);
const tube = new THREE.Mesh(
  new THREE.TubeGeometry(curve, 80, 0.018, 8, true),
  mat2
);
tube.position.set(0, 0.0, -1.5);
scene.add(tube);

// Capsule — справа
const capsule = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.06, 0.14, 8, 16),
  mat3
);
capsule.position.set(0.38, 0.0, -1.5);
scene.add(capsule);

const objects = [torusKnot, tube, capsule];
const originalMaterials = [mat1, mat2, mat3];

// ===== КНОПКИ КЕРУВАННЯ =====
document.getElementById('toggleRotate').addEventListener('click', (e) => {
  rotating = !rotating;
  e.target.textContent = `Обертання: ${rotating ? 'Увімк.' : 'Вимк.'}`;
});

document.getElementById('randomColor').addEventListener('click', () => {
  objects.forEach(obj => {
    obj.material.color.setHex(Math.random() * 0xffffff);
  });
});

document.getElementById('toggleTexture').addEventListener('click', (e) => {
  useTexture = !useTexture;
  objects.forEach((obj, i) => {
    if (useTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const colors = ['#ff8800', '#44ff88', '#4488ff'];
      for (let row = 0; row < 8; row++) {
        ctx.fillStyle = row % 2 === 0 ? colors[i] : '#222';
        ctx.fillRect(0, row * 16, 128, 16);
      }
      obj.material.map = new THREE.CanvasTexture(canvas);
      obj.material.needsUpdate = true;
    } else {
      obj.material.map = null;
      obj.material.needsUpdate = true;
    }
  });
  e.target.textContent = `Текстура: ${useTexture ? 'Увімк.' : 'Вимк.'}`;
});

document.getElementById('toggleWireframe').addEventListener('click', (e) => {
  useWireframe = !useWireframe;
  objects.forEach(obj => { obj.material.wireframe = useWireframe; });
  e.target.textContent = `Каркас: ${useWireframe ? 'Увімк.' : 'Вимк.'}`;
});

document.getElementById('speed').addEventListener('input', (e) => {
  rotSpeed = parseFloat(e.target.value);
});

// ===== AR КНОПКА =====
document.getElementById('start-ar').addEventListener('click', async () => {
  if (!navigator.xr) {
    alert('WebXR не підтримується. Використовуйте Chrome на Android з увімкненим WebXR Incubations у chrome://flags');
    return;
  }
  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    alert('AR не підтримується на цьому пристрої. Потрібен Android з ARCore та Chrome.');
    return;
  }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['dom-overlay', 'local-floor'],
      domOverlay: { root: document.body }
    });
    renderer.xr.setSession(session);
  } catch (e) {
    console.error('AR помилка:', e);
    alert('Помилка AR: ' + e.message);
  }
});

// ===== АНІМАЦІЙНИЙ ЦИКЛ =====
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();

  if (rotating) {
    torusKnot.rotation.x += rotSpeed;
    torusKnot.rotation.y += rotSpeed * 0.7;
    tube.rotation.y += rotSpeed;
    tube.rotation.z += rotSpeed * 0.5;
    capsule.rotation.x += rotSpeed * 0.6;
    capsule.rotation.z += rotSpeed * 0.8;
  }

  // Легке "плавання" по Y
  torusKnot.position.y = Math.sin(t * 1.2) * 0.03;
  tube.position.y = Math.sin(t * 0.9 + 1) * 0.03;
  capsule.position.y = Math.sin(t * 1.5 + 2) * 0.03;

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});