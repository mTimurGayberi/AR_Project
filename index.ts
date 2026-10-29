import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";

// --- INITIALIZE MINI-GAMES & PROGRESSION ---
console.log("=== SENSEI AR 10 MINI-GAMES SYSTEM ===");

// 1. Create and register the first mini-game (Maze)
const mazeGame = new MazeGame({
    wallGracePeriod: 2.0, // 2-second grace period before wall collision causes a reset
    wallHeight: 1.8,      // Fixed human-height walls (never shortened!)
    cellSize: 1.0,
    moveSpeed: 2.5
});

gameManager.registerGame(mazeGame);
gameManager.setActiveGame(mazeGame.id);

let currentCamera: THREE.Camera | null = null;
let isMazePlaced = false;

// 2. Setup HUD Notification Display
function createHUD() {
    const hudContainer = document.createElement('div');
    hudContainer.id = 'game-hud';
    hudContainer.style.position = 'fixed';
    hudContainer.style.top = '48px'; // Moved down so iPhone notch/island doesn't obscure the HUD
    hudContainer.style.left = '50%';
    hudContainer.style.transform = 'translateX(-50%)';
    hudContainer.style.zIndex = '1000';
    hudContainer.style.display = 'flex';
    hudContainer.style.flexDirection = 'column';
    hudContainer.style.alignItems = 'center';
    hudContainer.style.pointerEvents = 'none';
    hudContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Item counter pill
    const counterPill = document.createElement('div');
    counterPill.id = 'hud-counter';
    counterPill.style.background = 'rgba(15, 23, 42, 0.85)';
    counterPill.style.color = '#38bdf8';
    counterPill.style.border = '1px solid rgba(56, 189, 248, 0.3)';
    counterPill.style.borderRadius = '20px';
    counterPill.style.padding = '8px 18px';
    counterPill.style.fontSize = '14px';
    counterPill.style.fontWeight = 'bold';
    counterPill.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    (counterPill.style as any).backdropFilter = 'blur(6px)';

    const updateCounterUI = () => {
        const prog = gameManager.getProgression();
        counterPill.innerText = `🔮 Special Items: ${prog.collected} / ${prog.total}`;
    };
    updateCounterUI();
    hudContainer.appendChild(counterPill);

    // Dynamic Banner for announcements (Wall warnings, Wins, Fails)
    const alertBanner = document.createElement('div');
    alertBanner.id = 'hud-banner';
    alertBanner.style.marginTop = '10px';
    alertBanner.style.padding = '10px 20px';
    alertBanner.style.borderRadius = '8px';
    alertBanner.style.fontSize = '14px';
    alertBanner.style.fontWeight = '600';
    alertBanner.style.display = 'none';
    alertBanner.style.transition = 'all 0.3s ease';
    hudContainer.appendChild(alertBanner);

    document.body.appendChild(hudContainer);

    // Connect BaseMiniGame notification hook
    mazeGame.onNotification = (message, type) => {
        console.log(`[MiniGame Notification] (${type}) ${message}`);
        alertBanner.innerText = message;
        alertBanner.style.display = 'block';

        if (type === 'warning') {
            alertBanner.style.background = 'rgba(239, 68, 68, 0.9)'; // Red warning
            alertBanner.style.color = '#ffffff';
            alertBanner.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
        } else if (type === 'success') {
            alertBanner.style.background = 'rgba(16, 185, 129, 0.9)'; // Green success
            alertBanner.style.color = '#ffffff';
            alertBanner.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.6)';
            updateCounterUI();
        } else {
            alertBanner.style.background = 'rgba(30, 41, 59, 0.85)';
            alertBanner.style.color = '#e2e8f0';
            alertBanner.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        }

        if (type !== 'warning') {
            setTimeout(() => {
                alertBanner.style.display = 'none';
            }, 3000);
        }
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createHUD);
    } else {
        createHUD();
    }
}

// 3. Initialize Mattercraft 3D Scene
const result = initialize(Scene, {}, {
    launchButton: document.getElementById('launchButton')
});

const instance = result.rootInstance;
const threeScene = useScene(result.contextManager);
console.log("Scene initialized successfully!", instance, threeScene);

// Link active AR camera for physical 1:1 room-scale walking
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    currentCamera = cameraObservable.value;
    mazeGame.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    currentCamera = activeCam;
    mazeGame.setCamera(activeCam);
});

// Hide the default template Box
if ((instance?.nodes as any)?.Box) {
    const boxNode = (instance.nodes as any).Box;
    if (boxNode.visible?.setValue) boxNode.visible.setValue(false);
    if (boxNode.element) boxNode.element.visible = false;
}

// 4. Teeter Tower Style Floor Scanning & Tap-to-Place System
// Anchor target: UserPlacementAnchorGroup, Ground_Anchor, or threeScene
const groundNode = (instance?.nodes as any)?.UserPlacementAnchorGroup?.element
                || (instance?.nodes as any)?.Ground_Anchor?.element
                || (instance?.nodes as any)?.WorldTracker?.element
                || threeScene;

// Create 3D Floor Placement Reticle (Teeter Tower style ring)
const reticleGeo = new THREE.RingGeometry(0.4, 0.46, 32);
const reticleMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
});
const placementReticle = new THREE.Mesh(reticleGeo, reticleMat);
placementReticle.rotation.x = -Math.PI / 2; // Lie flat on the floor
placementReticle.visible = false;
threeScene.add(placementReticle);

// Setup Teeter Tower Scan & Place UI
function setupTeeterTowerScanUI() {
    let scanStep = 1;
    let corner1Pos: THREE.Vector3 | null = null;
    let corner1Marker: THREE.Mesh | null = null;
    const markerGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    // 1. Scanning Instruction Banner
    const scanPrompt = document.createElement('div');
    scanPrompt.id = 'scan-prompt';
    scanPrompt.style.position = 'fixed';
    scanPrompt.style.top = '105px';
    scanPrompt.style.left = '50%';
    scanPrompt.style.transform = 'translateX(-50%)';
    scanPrompt.style.background = 'rgba(15, 23, 42, 0.9)';
    scanPrompt.style.border = '1px solid rgba(56, 189, 248, 0.4)';
    scanPrompt.style.borderRadius = '12px';
    scanPrompt.style.padding = '10px 18px';
    scanPrompt.style.color = '#38bdf8';
    scanPrompt.style.fontSize = '14px';
    scanPrompt.style.fontWeight = '600';
    scanPrompt.style.textAlign = 'center';
    scanPrompt.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
    scanPrompt.style.zIndex = '1200';
    (scanPrompt.style as any).backdropFilter = 'blur(6px)';
    document.body.appendChild(scanPrompt);

    // 2. Large Action Button
    const placeButton = document.createElement('button');
    placeButton.id = 'place-maze-btn';
    placeButton.innerText = '📍 Set Room Corner 1';
    placeButton.style.position = 'fixed';
    placeButton.style.bottom = '40px';
    placeButton.style.left = '50%';
    placeButton.style.transform = 'translateX(-50%)';
    placeButton.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
    placeButton.style.color = '#ffffff';
    placeButton.style.border = 'none';
    placeButton.style.borderRadius = '28px';
    placeButton.style.padding = '16px 36px';
    placeButton.style.fontSize = '17px';
    placeButton.style.fontWeight = 'bold';
    placeButton.style.boxShadow = '0 10px 25px rgba(2, 132, 199, 0.5)';
    placeButton.style.cursor = 'pointer';
    placeButton.style.zIndex = '2000';
    placeButton.style.letterSpacing = '0.5px';
    document.body.appendChild(placeButton);

    scanPrompt.innerText = '📐 Aim circle at Corner 1 of your room & tap';

    // 3. Relocate button (re-open scanning)
    const moveBtn = document.createElement('button');
    moveBtn.innerText = '🔄 Recalibrate Room';
    moveBtn.style.position = 'fixed';
    moveBtn.style.bottom = '15px';
    moveBtn.style.left = '15px';
    moveBtn.style.zIndex = '1500';
    moveBtn.style.padding = '8px 14px';
    moveBtn.style.borderRadius = '20px';
    moveBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    moveBtn.style.background = 'rgba(15, 23, 42, 0.8)';
    moveBtn.style.color = '#94a3b8';
    moveBtn.style.fontSize = '12px';
    moveBtn.style.display = 'none';
    moveBtn.style.cursor = 'pointer';
    moveBtn.onclick = () => {
        scanStep = 1;
        corner1Pos = null;
        isMazePlaced = false;
        mazeGame.container.visible = false;
        if (corner1Marker) corner1Marker.visible = false;
        placementReticle.visible = true;
        scanPrompt.innerText = '📐 Aim circle at Corner 1 of your room & tap';
        scanPrompt.style.display = 'block';
        placeButton.innerText = '📍 Set Room Corner 1';
        placeButton.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
        placeButton.style.display = 'block';
        moveBtn.style.display = 'none';
    };
    document.body.appendChild(moveBtn);

    // 2-Corner Room Scanning Action
    placeButton.onclick = () => {
        if (!currentCamera) return;

        if (scanStep === 1) {
            // Drop pin at Corner 1
            corner1Pos = placementReticle.position.clone();
            scanStep = 2;

            if (!corner1Marker) {
                corner1Marker = new THREE.Mesh(markerGeo, markerMat);
                threeScene.add(corner1Marker);
            }
            corner1Marker.position.copy(corner1Pos);
            corner1Marker.visible = true;

            // Prompt player for Corner 2
            scanPrompt.innerText = '📐 Now aim circle at Opposite Corner & tap';
            placeButton.innerText = '📍 Set Corner 2 (Fit Maze)';
            placeButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (scanStep === 2 && corner1Pos) {
            // Record Corner 2
            const corner2Pos = placementReticle.position.clone();

            // Calibrate maze: scales X & Z to fit within room perimeter, keeping wall height fixed at 1.8m!
            mazeGame.calibrateRoom(corner1Pos, corner2Pos);
            mazeGame.container.visible = true;
            isMazePlaced = true;

            // Hide reticle & markers
            if (corner1Marker) corner1Marker.visible = false;
            placementReticle.visible = false;
            scanPrompt.style.display = 'none';
            placeButton.style.display = 'none';
            moveBtn.style.display = 'block';

            mazeGame.reset();
            mazeGame.onNotification?.(`✅ Room mapped! Maze fitted to room (${mazeGame.roomWidth.toFixed(1)}m × ${mazeGame.roomDepth.toFixed(1)}m).`, 'success');
        }
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTeeterTowerScanUI);
    } else {
        setupTeeterTowerScanUI();
    }
}

// Attach MazeGame initially hidden until player scans & places
mazeGame.init(groundNode);
mazeGame.container.visible = false; // Hidden during initial floor scanning
mazeGame.start();

// Game loop hook (updates camera raycast for placement reticle + game logic)
let lastTime = performance.now();
const forwardVec = new THREE.Vector3();

function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // During placement mode: update the floor reticle in front of camera
    if (!isMazePlaced && currentCamera) {
        placementReticle.visible = true;

        // Cast ~2.2m ahead on the floor
        currentCamera.getWorldDirection(forwardVec);
        const camPos = currentCamera.getWorldPosition(new THREE.Vector3());

        const targetX = camPos.x + forwardVec.x * 2.2;
        const targetZ = camPos.z + forwardVec.z * 2.2;
        const floorY = camPos.y - 1.2; // Project to floor height below phone

        placementReticle.position.set(targetX, floorY, targetZ);
    }

    if (isMazePlaced) {
        gameManager.updateActiveGame(delta);
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
