import * as THREE from 'three';

// ===== СТАН =====
let rotating = true;
let scaleAnim = false;
let currentScale = 0.10;
let matType = 'standard';
let objColor = 0xffaa44;
let hitTestSource = null;
let hitTestSourceRequested = false;
let placedObjects = [];
let reticle;

// ===== СЦЕНА =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// ===== ОСВІТЛЕННЯ =====
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(1, 3, 2);
scene.add(dir);

// ===== RETICLE (мітка поверхні) =====
reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.045, 0.07, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// ===== Превью об'єкта (до AR) =====
let previewMesh = null;
function updatePreview() {
  if (previewMesh) scene.remove(previewMesh);
  previewMesh = createDodecahedron();
  previewMesh.position.set(0, 0, -1.2);
  scene.add(previewMesh);
}

// ===== ФУНКЦІЯ СТВОРЕННЯ OБ'ЄКТА =====
function createDodecahedron() {
  const geo = new THREE.DodecahedronGeometry(currentScale);
  let mat;
  const color = new THREE.Color(objColor);
  if (matType === 'emissive') {
    mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4
    });
  } else if (matType === 'transparent') {
    mat = new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity: 0.45,
      roughness: 0.0, metalness: 0.1, transmission: 0.5
    });
  } else {
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  }
  return new THREE.Mesh(geo, mat);
}

updatePreview();

// ===== КЕРУВАННЯ =====
document.getElementById('colorPicker').addEventListener('input', (e) => {
  objColor = parseInt(e.target.value.replace('#', ''), 16);
  updatePreview();
});

document.getElementById('toggleRotate').addEventListener('click', (e) => {
  rotating = !rotating;
  e.target.textContent = rotating ? 'Увімк.' : 'Вимк.';
});

document.getElementById('scaleUp').addEventListener('click', () => {
  currentScale = Math.min(0.5, +(currentScale + 0.02).toFixed(2));
  document.getElementById('scaleVal').textContent = currentScale.toFixed(2);
  updatePreview();
});
document.getElementById('scaleDown').addEventListener('click', () => {
  currentScale = Math.max(0.02, +(currentScale - 0.02).toFixed(2));
  document.getElementById('scaleVal').textContent = currentScale.toFixed(2);
  updatePreview();
});

document.getElementById('toggleScaleAnim').addEventListener('click', (e) => {
  scaleAnim = !scaleAnim;
  e.target.textContent = scaleAnim ? 'Увімк.' : 'Вимк.';
});

document.getElementById('matStd').addEventListener('click', () => { matType = 'standard'; updatePreview(); });
document.getElementById('matEmis').addEventListener('click', () => { matType = 'emissive'; updatePreview(); });
document.getElementById('matTrans').addEventListener('click', () => { matType = 'transparent'; updatePreview(); });

// ===== AR КНОПКА =====
document.getElementById('start-ar').addEventListener('click', async () => {
  if (!navigator.xr) {
    alert('WebXR не підтримується. Chrome на Android з WebXR Incubations у chrome://flags');
    return;
  }
  const ok = await navigator.xr.isSessionSupported('immersive-ar');
  if (!ok) {
    alert('AR не підтримується. Потрібен Android з ARCore та Chrome.');
    return;
  }
  try {
    // Прибираємо превью
    if (previewMesh) { scene.remove(previewMesh); previewMesh = null; }

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'local-floor'],
      domOverlay: { root: document.body }
    });
    renderer.xr.setSession(session);

    hitTestSourceRequested = false;
    hitTestSource = null;
    reticle.visible = false;

    // Тап = розмістити об'єкт
    session.addEventListener('select', () => {
      if (reticle.visible) {
        const obj = createDodecahedron();
        obj.position.setFromMatrixPosition(reticle.matrix);
        obj.position.y += currentScale * 0.5;
        obj.userData.baseY = obj.position.y;
        scene.add(obj);
        placedObjects.push(obj);
      }
    });

    session.addEventListener('end', () => {
      hitTestSource = null;
      hitTestSourceRequested = false;
      reticle.visible = false;
    });
  } catch (e) {
    console.error('AR помилка:', e);
    alert('Помилка AR: ' + e.message);
  }
});

// ===== АНІМАЦІЙНИЙ ЦИКЛ =====
const clock = new THREE.Clock();
renderer.setAnimationLoop((timestamp, frame) => {
  const t = clock.getElapsedTime();

  // --- Hit Test ---
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested && session) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        }).catch(e => console.error('hitTestSource error:', e));
      }).catch(e => console.error('viewer space error:', e));
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

  // --- Анімація превью ---
  if (previewMesh) {
    if (rotating) previewMesh.rotation.y += 0.01;
    if (scaleAnim) {
      const s = 1 + 0.15 * Math.sin(t * 3);
      previewMesh.scale.setScalar(s);
    }
  }

  // --- Анімація розміщених об'єктів ---
  placedObjects.forEach((obj, i) => {
    if (rotating) obj.rotation.y += 0.01;
    if (scaleAnim) {
      const s = 1 + 0.15 * Math.sin(t * 3 + i * 0.5);
      obj.scale.setScalar(s);
    }
  });

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});