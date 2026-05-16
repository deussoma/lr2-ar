import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ============================================================
// СТАН
// ============================================================
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

let templateModel = null;
let previewModel  = null;
let placedObjects = [];

let dirLightObj;
let lightIntensity = 0.8;
let jumpEnabled    = false;
let rotEnabled     = true;
let currentMaterial = 'realistic';
let jumpT = 0;

// ============================================================
// МАТЕРІАЛИ
// ============================================================
const materials = {
  gold:   new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.1 }),
  glass:  new THREE.MeshPhysicalMaterial({ color: 0xaaddff, transparent: true, opacity: 0.4, roughness: 0.0, metalness: 0.0 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.03 }),
  glow:   new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00bb55, emissiveIntensity: 1.2 }),
};

function applyMaterial(root, matName) {
  root.traverse(c => {
    if (!c.isMesh) return;
    if (!c.userData.origMat) c.userData.origMat = c.material;
    c.material = (matName === 'realistic') ? c.userData.origMat : materials[matName];
  });
}

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);

// ============================================================
// ОСВІТЛЕННЯ
// ============================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
dirLightObj = new THREE.DirectionalLight(0xffffff, lightIntensity);
dirLightObj.position.set(1, 3, 2);
scene.add(dirLightObj);

// ============================================================
// RETICLE
// ============================================================
reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.11, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// ============================================================
// ФУНКЦІЯ РОЗМІЩЕННЯ ОБ'ЄКТА
// ============================================================
function placeObject() {
  console.log('placeObject викликано, reticle.visible =', reticle.visible, 'templateModel =', !!templateModel);

  if (!reticle.visible) {
    console.log('reticle не видимий — пропускаємо');
    return;
  }
  if (!templateModel) {
    console.log('templateModel ще не завантажено');
    return;
  }

  const clone = templateModel.clone();

  // Автомасштаб
  const box    = new THREE.Box3().setFromObject(clone);
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) clone.scale.setScalar(0.18 / maxDim);

  // Позиція з reticle matrix
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(reticle.matrix);
  clone.position.copy(position);
  clone.userData.baseY = position.y;

  applyMaterial(clone, currentMaterial);
  scene.add(clone);
  placedObjects.push(clone);

  console.log('Об\'єкт розміщено на', position);
}

// ============================================================
// ЗАВАНТАЖЕННЯ МОДЕЛІ
// ============================================================
const loader = new GLTFLoader();
loader.load(
  '/models/rubiks_cube.glb',
  (gltf) => {
    templateModel = gltf.scene;
    templateModel.traverse(c => {
      if (c.isMesh) c.userData.origMat = c.material;
    });

    previewModel = templateModel.clone();
    const box    = new THREE.Box3().setFromObject(previewModel);
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) previewModel.scale.setScalar(0.18 / maxDim);
    previewModel.position.set(0, -0.05, -0.6);
    scene.add(previewModel);
    console.log('rubiks_cube.glb завантажено ✓');
  },
  null,
  (err) => {
    console.error('Помилка завантаження GLB:', err);
    // Fallback — простий куб
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
    const fallback = new THREE.Mesh(geo, mat);
    fallback.position.set(0, 0, -0.6);
    scene.add(fallback);
    templateModel = fallback;
    previewModel  = fallback;
  }
);

// ============================================================
// AR КНОПКА
// ============================================================
document.getElementById('start-ar').addEventListener('click', async () => {
  if (!navigator.xr) {
    alert('WebXR не підтримується.\nChrome на Android → chrome://flags → WebXR Incubations → Enabled');
    return;
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!supported) {
    alert('AR не підтримується.\nПотрібен ARCore (Google Play Services for AR).');
    return;
  }

  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'local-floor'],
      domOverlay: { root: document.body }
    });

    // Прибираємо превью
    if (previewModel) {
      scene.remove(previewModel);
      previewModel = null;
    }

    hitTestSource          = null;
    hitTestSourceRequested = false;
    reticle.visible        = false;

    renderer.xr.setSession(session);

    // *** ГОЛОВНЕ ВИПРАВЛЕННЯ ***
    // Вішаємо select прямо на session — це найнадійніший спосіб
    session.addEventListener('select', () => {
      console.log('session select event!');
      placeObject();
    });

    // Також вішаємо на controller як запасний варіант
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      console.log('controller select event!');
      placeObject();
    });
    scene.add(controller);

    session.addEventListener('end', () => {
      hitTestSource          = null;
      hitTestSourceRequested = false;
      reticle.visible        = false;
    });

  } catch (e) {
    console.error('AR помилка:', e);
    alert('Помилка запуску AR:\n' + e.message);
  }
});

// ============================================================
// КЕРУВАННЯ
// ============================================================
document.getElementById('materialSelect').addEventListener('change', (e) => {
  currentMaterial = e.target.value;
  if (previewModel) applyMaterial(previewModel, currentMaterial);
  placedObjects.forEach(o => applyMaterial(o, currentMaterial));
});

document.getElementById('dirLightToggle').addEventListener('click', (e) => {
  const isOn = dirLightObj.intensity > 0;
  dirLightObj.intensity = isOn ? 0 : lightIntensity;
  e.target.textContent  = isOn ? 'Вимк.' : 'Увімк.';
});

document.getElementById('incLight').addEventListener('click', () => {
  lightIntensity = Math.min(3.0, +(lightIntensity + 0.2).toFixed(1));
  dirLightObj.intensity = lightIntensity;
  document.getElementById('lightIntVal').textContent = lightIntensity.toFixed(1);
});
document.getElementById('decLight').addEventListener('click', () => {
  lightIntensity = Math.max(0.0, +(lightIntensity - 0.2).toFixed(1));
  dirLightObj.intensity = lightIntensity;
  document.getElementById('lightIntVal').textContent = lightIntensity.toFixed(1);
});
document.getElementById('lightColor').addEventListener('input', (e) => {
  dirLightObj.color.set(e.target.value);
});

document.getElementById('jumpToggle').addEventListener('click', (e) => {
  jumpEnabled = !jumpEnabled;
  e.target.textContent = jumpEnabled ? 'Увімк.' : 'Вимк.';
});
document.getElementById('rotToggle').addEventListener('click', (e) => {
  rotEnabled = !rotEnabled;
  e.target.textContent = rotEnabled ? 'Увімк.' : 'Вимк.';
});

// ============================================================
// АНІМАЦІЙНИЙ ЦИКЛ
// ============================================================
const clock = new THREE.Clock();

renderer.setAnimationLoop((timestamp, frame) => {
  jumpT += 0.04;

  // ------- HIT TEST (точно як офіційний three.js приклад) -------
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session        = renderer.xr.getSession();

    if (!hitTestSourceRequested && session) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
          console.log('hitTestSource готовий ✓');
        });
      });

      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource          = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(referenceSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
    }
  }
  // ------- кінець HIT TEST -------

  // Анімація превью
  if (previewModel) {
    if (rotEnabled)  previewModel.rotation.y += 0.012;
    if (jumpEnabled) previewModel.position.y  = -0.05 + Math.abs(Math.sin(jumpT * 2)) * 0.05;
  }

  // Анімація розміщених об'єктів
  placedObjects.forEach(obj => {
    if (rotEnabled)  obj.rotation.y += 0.012;
    if (jumpEnabled) obj.position.y  = (obj.userData.baseY || 0) + Math.abs(Math.sin(jumpT * 2)) * 0.07;
  });

  renderer.render(scene, camera);
});

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});