// app.js
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';


// ---------------- CONFIG: Replace these URLs with your model files (GLB/GLTF)
// You can upload GLB files to Replit and use a relative path like '/male.glb' after uploading.
const MODEL_MALE_URL = '/male.glb';    // <- replace with your male model file path or hosted URL
const MODEL_FEMALE_URL = '/female.glb';// <- replace with your female model file path or hosted URL
// -----------------------------------------------------


// Basic UI refs
const viewer = document.getElementById('viewer');
const btnMale = document.getElementById('btnMale');
const btnFemale = document.getElementById('btnFemale');
const selectedRegionsEl = document.getElementById('selectedRegions');
const btnDescribe = document.getElementById('btnDescribe');
const btnClear = document.getElementById('btnClear');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const submitPain = document.getElementById('submitPain');
const results = document.getElementById('results');
const resultsClose = document.getElementById('resultsClose');
const resultContent = document.getElementById('resultContent');


// Three.js scene setup
const scene = new THREE.Scene();
scene.background = null;


const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio ? Math.min(window.devicePixelRatio,2) : 1);
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
viewer.appendChild(renderer.domElement);


const camera = new THREE.PerspectiveCamera(40, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
camera.position.set(0, 1.6, 2.6);


const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,1,0);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 5;


// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.7);
dir.position.set(5, 10, 7.5);
scene.add(dir);


// ground subtle
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6,6),
  new THREE.ShadowMaterial({ opacity: 0.04 })
);
ground.rotation.x = -Math.PI/2;
ground.position.y = 0;
scene.add(ground);


// GLTF Loader
const loader = new GLTFLoader();


// current model container
let currentModel = null;
let colliders = []; // clickable region colliders
let selectedRegions = new Set();


// Define body regions with normalized local offsets (x,y,z) relative to model bounding box center.
// These offsets are approximate; you will tweak them depending on your model scale and pose.
const REGION_DEFS = [
  { key: 'head', label: 'Head', offset: [0, 0.92, 0], r: 0.09 },
  { key: 'neck', label: 'Neck', offset: [0, 0.78, 0], r: 0.06 },
  { key: 'left_shoulder', label: 'Left Shoulder', offset: [-0.18, 0.78, 0], r: 0.08 },
  { key: 'right_shoulder', label: 'Right Shoulder', offset: [0.18, 0.78, 0], r: 0.08 },
  { key: 'left_elbow', label: 'Left Elbow', offset: [-0.22, 0.56, 0.02], r: 0.07 },
  { key: 'right_elbow', label: 'Right Elbow', offset: [0.22, 0.56, 0.02], r: 0.07 },
  { key: 'left_wrist', label: 'Left Wrist', offset: [-0.22, 0.36, 0.06], r: 0.06 },
  { key: 'right_wrist', label: 'Right Wrist', offset: [0.22, 0.36, 0.06], r: 0.06 },
  { key: 'chest', label: 'Chest', offset: [0, 0.6, 0.08], r: 0.12 },
  { key: 'upper_back', label: 'Upper Back', offset: [0, 0.62, -0.06], r: 0.12 },
  { key: 'lower_back', label: 'Lower Back', offset: [0, 0.36, -0.06], r: 0.14 },
  { key: 'left_hip', label: 'Left Hip', offset: [-0.12, 0.28, 0], r: 0.10 },
  { key: 'right_hip', label: 'Right Hip', offset: [0.12, 0.28, 0], r: 0.10 },
  { key: 'left_knee', label: 'Left Knee', offset: [-0.12, 0.07, 0], r: 0.09 },
  { key: 'right_knee', label: 'Right Knee', offset: [0.12, 0.07, 0], r: 0.09 },
  { key: 'left_ankle', label: 'Left Ankle', offset: [-0.12, -0.08, 0], r: 0.08 },
  { key: 'right_ankle', label: 'Right Ankle', offset: [0.12, -0.08, 0], r: 0.08 },
];


// helper: clear colliders
function clearColliders(){
  colliders.forEach(c => scene.remove(c.mesh));
  colliders = [];
  selectedRegions.clear();
  updateSelectedLabel();
  btnDescribe.disabled = true;
}


// helper: place colliders based on model bounding box
function createCollidersForModel(root){
  // compute bbox in model space
  const bbox = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);


  // remove old colliders
  clearColliders();


  REGION_DEFS.forEach(def => {
    const [nx, ny, nz] = def.offset; // normalized offsets relative to bbox size
    const worldPos = new THREE.Vector3(
      center.x + (nx * size.x),
      center.y + (ny * size.y - size.y*0.5) + size.y*0.5, // tweak so offsets align vertically
      center.z + (nz * size.z)
    );


    const geometry = new THREE.SphereGeometry(def.r * Math.max(size.x,size.y,size.z), 16, 12);
    const material = new THREE.MeshBasicMaterial({ color: 0x3A7AFE, transparent: true, opacity: 0.0 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(worldPos);
    sphere.userData = { key: def.key, label: def.label };
    sphere.name = 'collider_' + def.key;


    // add small visible helper if you want to debug: set opacity = 0.15
    // material.opacity = 0.15;


    scene.add(sphere);
    colliders.push({ mesh: sphere, def });
  });
}


// load model
async function loadModel(url){
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => {
      resolve(gltf.scene);
    }, undefined, e => reject(e));
  });
}


async function setModel(url){
  if (currentModel) {
    scene.remove(currentModel);
    clearColliders();
  }
  try {
    const mdl = await loadModel(url);
    // normalize scale and center
    const container = new THREE.Group();
    container.add(mdl);


    // compute bbox and center model at y=0
    const bbox = new THREE.Box3().setFromObject(container);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const scale = 1.4 / Math.max(size.x, size.y, size.z);
    container.scale.setScalar(scale);
    bbox.setFromObject(container);
    bbox.getCenter(container.position).multiplyScalar(-1); // center at origin


    // shift model so feet are at y=0 (approx)
    bbox.setFromObject(container);
    const minY = bbox.min.y;
    container.position.y -= minY; // now min y ~ 0


    scene.add(container);
    currentModel = container;


    createCollidersForModel(container);


  } catch(err){
    console.error('Model load error', err);
    alert('Failed to load model. Check console and model URL.');
  }
}


// click handling
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onPointerDown(event){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);


  // test colliders first
  const meshes = colliders.map(c => c.mesh);
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length){
    const target = intersects[0].object;
    const key = target.userData.key;
    if (selectedRegions.has(key)) {
      // unselect
      selectedRegions.delete(key);
      target.material.opacity = 0.0;
    } else {
      selectedRegions.add(key);
      target.material.opacity = 0.25;
    }
    updateSelectedLabel();
    btnDescribe.disabled = selectedRegions.size === 0;
  }
}


function updateSelectedLabel(){
  if (selectedRegions.size === 0){
    selectedRegionsEl.textContent = 'None';
  } else {
    const arr = Array.from(selectedRegions);
    const labels = arr.map(k => {
      const def = REGION_DEFS.find(d => d.key === k);
      return def ? def.label : k;
    });
    selectedRegionsEl.textContent = labels.join(', ');
  }
}


// animate
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


// resize handling
window.addEventListener('resize', () => {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
});


// pointer event
renderer.domElement.addEventListener('pointerdown', onPointerDown);


// UI buttons
btnMale.addEventListener('click', async () => {
  btnMale.classList.add('active');
  btnFemale.classList.remove('active');
  await setModel(MODEL_MALE_URL);
});
btnFemale.addEventListener('click', async () => {
  btnFemale.classList.add('active');
  btnMale.classList.remove('active');
  await setModel(MODEL_FEMALE_URL);
});


btnClear.addEventListener('click', () => {
  // reset selection look
  colliders.forEach(c => c.mesh.material.opacity = 0.0);
  selectedRegions.clear();
  updateSelectedLabel();
  btnDescribe.disabled = true;
});


// open modal
btnDescribe.addEventListener('click', () => {
  modal.classList.remove('hidden');
});
modalClose.addEventListener('click', () => modal.classList.add('hidden'));


// submit pain => compute diagnoses
submitPain.addEventListener('click', () => {
  const checked = Array.from(document.querySelectorAll('input[name="painType"]:checked')).map(i => i.value);
  const details = document.getElementById('details').value.trim();
  modal.classList.add('hidden');


  const regions = Array.from(selectedRegions);
  const diag = computeDiagnoses(regions, checked, details);
  showResults(diag);
});


// results panel
function showResults(list){
  results.classList.remove('hidden');
  resultContent.innerHTML = '';
  if (list.length === 0){
    resultContent.innerHTML = '<p>No strong matches found. Try adding more detail or selecting additional regions.</p>';
    return;
  }
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<strong>${item.title}</strong><p style="margin:6px 0">${item.desc}</p><em style="font-size:13px;color:#6b7280">Why this matches: ${item.reason}</em>`;
    resultContent.appendChild(div);
  });
}
resultsClose.addEventListener('click', () => results.classList.add('hidden'));


// Very simple diagnostic logic — expand this with clinical rules over time
function computeDiagnoses(regions, painTypes, details){
  // normalize sets
  const sRegions = new Set(regions);
  const sPain = new Set(painTypes);


  const out = [];


  // Example rules (these are illustrative — not comprehensive medical rules)
  // Shoulder pain + pulling/pain -> biceps/rotator cuff
  if ((sRegions.has('left_shoulder') || sRegions.has('right_shoulder')) &&
      (sPain.has('pulling') || sPain.has('aching') || sPain.has('sharp'))) {
    out.push({
      title: 'Rotator cuff tendinopathy / Biceps tendinopathy',
      desc: 'Pain around the shoulder, worse with lifting or throwing. May feel achy or pulling.',
      reason: 'Selected shoulder region + pulling/aching/sharp pain.'
    });
  }


  // Neck + tingling/numbness -> cervical radiculopathy
  if (sRegions.has('neck') && (sPain.has('tingling') || sPain.has('numbness'))) {
    out.push({
      title: 'Cervical radiculopathy (nerve root irritation)',
      desc: 'Neck pain with radiating tingling or numbness into the arm — could be nerve irritation.',
      reason: 'Neck region with tingling/numbness.'
    });
  }


  // Lower back + burning/aching -> lumbar strain or disc-related
  if (sRegions.has('lower_back') && (sPain.has('aching') || sPain.has('burning') || sPain.has('sharp'))) {
    out.push({
      title: 'Lumbar strain / Disc-related issue',
      desc: 'Lower back pain that is aching or sharp; if it radiates down the leg it may be disc-related.',
      reason: 'Lower back selected with aching/burning/sharp qualities.'
    });
  }


  // Elbow medial + pulling -> medial epicondylitis
  if ((sRegions.has('left_elbow') || sRegions.has('right_elbow')) && sPain.has('pulling')) {
    out.push({
      title: 'Epicondylitis (golfer\'s/tennis elbow - depends on side)',
      desc: 'Pain at the elbow aggravated by gripping or wrist motion.',
      reason: 'Elbow region + pulling pain.'
    });
  }


  // Wrist with tingling/numbness -> possible carpal tunnel / nerve entrapment
  if ((sRegions.has('left_wrist') || sRegions.has('right_wrist')) && (sPain.has('tingling') || sPain.has('numbness'))) {
    out.push({
      title: 'Nerve entrapment (e.g., carpal tunnel)',
      desc: 'Tingling or numbness in the wrist/hand area suggests nerve irritation or compression.',
      reason: 'Wrist selected with tingling/numbness.'
    });
  }


  // Knee: sharp after injury -> ligament or meniscus
  if ((sRegions.has('left_knee') || sRegions.has('right_knee')) && sPain.has('sharp') && /injur|twist|fell|land/i.test(details)) {
    out.push({
      title: 'Ligament sprain / Meniscal injury',
      desc: 'A sharp knee pain after a twist/fall could indicate ligament or meniscus damage.',
      reason: 'Knee selected + sharp pain + reported acute injury.'
    });
  }


  // Generic fallback: add some broadly relevant suggestions
  if (out.length === 0 && regions.length > 0) {
    out.push({
      title: 'Non-specific musculoskeletal pain',
      desc: 'Symptoms could be due to muscle strain, overuse, or minor soft-tissue injury. Consider rest, ice, and seeing a clinician if severe or persistent.',
      reason: 'No specific rule matched — use as general starting point.'
    });
  }


  // Deduplicate by title
  const unique = [];
  const seen = new Set();
  for (const it of out){
    if (!seen.has(it.title)){
      seen.add(it.title);
      unique.push(it);
    }
  }
  return unique;
}


// initial model load (male by default)
setModel(MODEL_MALE_URL);


// enable describe button when a region is selected (already handled inside selection)