import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ===== СТАН =====
let rotating = true;
let rotAxis = 'y';
let model = null;
let modelLight = null;
let sceneAmbient, sceneDir;

// ===== СЦЕНА =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// ===== ОСВІТЛЕННЯ СЦЕНИ =====
sceneAmbient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(sceneAmbient);
sceneDir = new THREE.DirectionalLight(0xffffff, 1.0);
sceneDir.position.set(2, 3, 2);
scene.add(sceneDir);

// ===== ЗАВАНТАЖЕННЯ МОДЕЛІ =====
const loader = new GLTFLoader();
loader.load(
  '/models/dragon_fruit.glb',
  (gltf) => {
    model = gltf.scene;
    // Зберігаємо оригінальні матеріали
    model.traverse(c => {
      if (c.isMesh) c.userData.origMat = c.material.clone();
    });
    // Автоматичне масштабування
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 0.25;
    model.scale.setScalar(targetSize / maxDim);

    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x * targetSize / maxDim, -center.y * targetSize / maxDim, -1.2);

    scene.add(model);
    console.log('dragon_fruit.glb завантажено');
  },
  (xhr) => console.log(`Завантаження: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`),
  (err) => {
    console.error('Помилка завантаження моделі:', err);
    // Fallback — куля рожевого кольору (драконячий фрукт)
    const fb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff3388, roughness: 0.4 })
    );
    fb.position.set(0, 0, -1.2);
    scene.add(fb);
    model = fb;
  }
);

// ===== СВІТЛО МОДЕЛІ =====
function createModelLight(type, colorHex, intensity) {
  if (modelLight) scene.remove(modelLight);
  const color = new THREE.Color(colorHex);
  if (type === 'point') {
    modelLight = new THREE.PointLight(color, intensity, 3);
  } else if (type === 'spot') {
    modelLight = new THREE.SpotLight(color, intensity);
    modelLight.angle = Math.PI / 5;
    modelLight.penumbra = 0.3;
  } else {
    modelLight = new THREE.DirectionalLight(color, intensity);
  }
  modelLight.position.set(0.3, 0.5, -0.7);
  scene.add(modelLight);
}
createModelLight('point', '#ffffff', 0.8);

// ===== КЕРУВАННЯ =====
document.getElementById('toggleRotate').addEventListener('click', (e) => {
  rotating = !rotating;
  e.target.textContent = rotating ? 'Увімк.' : 'Вимк.';
});

['axisX', 'axisY', 'axisZ'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    rotAxis = id.replace('axis', '').toLowerCase();
    document.getElementById('axisX').style.background = rotAxis === 'x' ? '#ff8800' : '#333';
    document.getElementById('axisY').style.background = rotAxis === 'y' ? '#ff8800' : '#333';
    document.getElementById('axisZ').style.background = rotAxis === 'z' ? '#ff8800' : '#333';
  });
});

document.getElementById('matOriginal').addEventListener('click', () => {
  if (!model) return;
  model.traverse(c => {
    if (c.isMesh && c.userData.origMat) c.material = c.userData.origMat.clone();
  });
});
document.getElementById('matAlt').addEventListener('click', () => {
  if (!model) return;
  const altMat = new THREE.MeshStandardMaterial({ color: 0xaaaaff, metalness: 0.9, roughness: 0.1 });
  model.traverse(c => { if (c.isMesh) c.material = altMat; });
});

document.getElementById('sceneOn').addEventListener('click', () => {
  sceneAmbient.intensity = 0.5;
  sceneDir.intensity = 1.0;
});
document.getElementById('sceneOff').addEventListener('click', () => {
  sceneAmbient.intensity = 0;
  sceneDir.intensity = 0;
});

document.getElementById('modelOn').addEventListener('click', () => {
  if (modelLight) modelLight.intensity = parseFloat(document.getElementById('intensity').value);
});
document.getElementById('modelOff').addEventListener('click', () => {
  if (modelLight) modelLight.intensity = 0;
});

document.getElementById('lightPoint').addEventListener('click', () => {
  createModelLight('point', document.getElementById('lightColor').value,
    parseFloat(document.getElementById('intensity').value));
});
document.getElementById('lightSpot').addEventListener('click', () => {
  createModelLight('spot', document.getElementById('lightColor').value,
    parseFloat(document.getElementById('intensity').value));
});
document.getElementById('lightDir').addEventListener('click', () => {
  createModelLight('directional', document.getElementById('lightColor').value,
    parseFloat(document.getElementById('intensity').value));
});

document.getElementById('intensity').addEventListener('input', (e) => {
  if (modelLight) modelLight.intensity = parseFloat(e.target.value);
});
document.getElementById('lightColor').addEventListener('input', (e) => {
  if (modelLight) modelLight.color.set(e.target.value);
});

// ===== AR КНОПКА =====
document.getElementById('start-ar').addEventListener('click', async () => {
  if (!navigator.xr) { alert('WebXR недоступний'); return; }
  const ok = await navigator.xr.isSessionSupported('immersive-ar');
  if (!ok) { alert('AR не підтримується на цьому пристрої'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['dom-overlay', 'local-floor'],
      domOverlay: { root: document.body }
    });
    renderer.xr.setSession(session);
  } catch (e) {
    console.error(e);
    alert('Помилка AR: ' + e.message);
  }
});

// ===== АНІМАЦІЯ =====
renderer.setAnimationLoop(() => {
  if (model && rotating) {
    if (rotAxis === 'x') model.rotation.x += 0.01;
    else if (rotAxis === 'y') model.rotation.y += 0.01;
    else model.rotation.z += 0.01;
  }
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});