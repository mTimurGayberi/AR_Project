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
    moveSpeed: 2.5
});

gameManager.registerGame(mazeGame);
gameManager.setActiveGame(mazeGame.id);

let currentCamera: THREE.Camera | null = null;

// 2. Setup HUD Notification Display
function createHUD() {
    const hudContainer = document.createElement('div');
    hudContainer.id = 'game-hud';
    hudContainer.style.position = 'fixed';
    hudContainer.style.top = '15px';
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

// 3. Setup Interactive Room Calibration Card ("Walk the Room")
function setupRoomCalibrationUI() {
    const card = document.createElement('div');
    card.id = 'room-calib-card';
    card.style.position = 'fixed';
    card.style.bottom = '25px';
    card.style.left = '50%';
    card.style.transform = 'translateX(-50%)';
    card.style.width = '88%';
    card.style.maxWidth = '360px';
    card.style.background = 'rgba(15, 23, 42, 0.94)';
    card.style.border = '1px solid rgba(56, 189, 248, 0.4)';
    card.style.borderRadius = '18px';
    card.style.padding = '18px 20px';
    card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)';
    card.style.zIndex = '2000';
    card.style.textAlign = 'center';
    card.style.color = '#ffffff';
    card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    (card.style as any).backdropFilter = 'blur(10px)';

    const title = document.createElement('div');
    title.innerText = '📐 Room Calibration';
    title.style.fontSize = '17px';
    title.style.fontWeight = '700';
    title.style.color = '#38bdf8';
    title.style.marginBottom = '6px';
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.innerText = 'Stand at Corner 1 of your room, then tap below:';
    subtitle.style.fontSize = '13px';
    subtitle.style.color = '#cbd5e1';
    subtitle.style.lineHeight = '1.4';
    subtitle.style.marginBottom = '14px';
    card.appendChild(subtitle);

    const liveDist = document.createElement('div');
    liveDist.style.fontSize = '12px';
    liveDist.style.color = '#94a3b8';
    liveDist.style.marginBottom = '10px';
    liveDist.style.display = 'none';
    card.appendChild(liveDist);

    const actionBtn = document.createElement('button');
    actionBtn.innerText = '📍 Set Corner 1';
    actionBtn.style.width = '100%';
    actionBtn.style.padding = '12px';
    actionBtn.style.borderRadius = '10px';
    actionBtn.style.border = 'none';
    actionBtn.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
    actionBtn.style.color = '#ffffff';
    actionBtn.style.fontSize = '15px';
    actionBtn.style.fontWeight = 'bold';
    actionBtn.style.cursor = 'pointer';
    card.appendChild(actionBtn);

    const skipBtn = document.createElement('div');
    skipBtn.innerText = 'Skip (Use 4m × 4m room default)';
    skipBtn.style.fontSize = '12px';
    skipBtn.style.color = '#64748b';
    skipBtn.style.marginTop = '10px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.textDecoration = 'underline';
    card.appendChild(skipBtn);

    document.body.appendChild(card);

    let step = 1;
    let corner1Pos: THREE.Vector3 | null = null;
    let distInterval: any = null;

    actionBtn.onclick = () => {
        if (!currentCamera) return;

        if (step === 1) {
            corner1Pos = currentCamera.getWorldPosition(new THREE.Vector3());
            step = 2;
            title.innerText = '🚶 Walk to Opposite Corner';
            subtitle.innerText = 'Walk across your room to Corner 2, then tap:';
            actionBtn.innerText = '📍 Set Corner 2 (Opposite)';
            actionBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            liveDist.style.display = 'block';

            distInterval = setInterval(() => {
                if (currentCamera && corner1Pos) {
                    const currentPos = currentCamera.getWorldPosition(new THREE.Vector3());
                    const dist = currentPos.distanceTo(corner1Pos);
                    liveDist.innerText = `Distance walked: ${dist.toFixed(1)}m`;
                }
            }, 100);
        } else if (step === 2 && corner1Pos) {
            if (distInterval) clearInterval(distInterval);
            const corner2Pos = currentCamera.getWorldPosition(new THREE.Vector3());

            mazeGame.calibrateRoom(corner1Pos, corner2Pos);

            title.innerText = '✅ Room Calibrated!';
            subtitle.innerText = `Mapped to ${mazeGame.roomWidth.toFixed(1)}m × ${mazeGame.roomDepth.toFixed(1)}m.\nWalls are 1.8m human-height.`;
            actionBtn.style.display = 'none';
            liveDist.style.display = 'none';
            skipBtn.style.display = 'none';

            setTimeout(() => {
                card.style.display = 'none';
            }, 1800);
        }
    };

    skipBtn.onclick = () => {
        if (distInterval) clearInterval(distInterval);
        card.style.display = 'none';
        mazeGame.notify('Using 4m × 4m default room scale.', 'info');
    };

    // Re-calibrate button in corner
    const recalibBtn = document.createElement('button');
    recalibBtn.innerText = '📐 Recalibrate Room';
    recalibBtn.style.position = 'fixed';
    recalibBtn.style.bottom = '15px';
    recalibBtn.style.left = '15px';
    recalibBtn.style.zIndex = '1500';
    recalibBtn.style.padding = '8px 14px';
    recalibBtn.style.borderRadius = '20px';
    recalibBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    recalibBtn.style.background = 'rgba(15, 23, 42, 0.8)';
    recalibBtn.style.color = '#94a3b8';
    recalibBtn.style.fontSize = '12px';
    recalibBtn.style.cursor = 'pointer';
    recalibBtn.onclick = () => {
        step = 1;
        title.innerText = '📐 Room Calibration';
        subtitle.innerText = 'Stand at Corner 1 of your room, then tap below:';
        actionBtn.innerText = '📍 Set Corner 1';
        actionBtn.style.display = 'block';
        actionBtn.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
        liveDist.style.display = 'none';
        skipBtn.style.display = 'block';
        card.style.display = 'block';
    };
    document.body.appendChild(recalibBtn);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createHUD();
            setupRoomCalibrationUI();
        });
    } else {
        createHUD();
        setupRoomCalibrationUI();
    }
}

// 4. Initialize Mattercraft 3D Scene
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

// Hide the default template Box so it doesn't block the scene!
if ((instance?.nodes as any)?.Box) {
    const boxNode = (instance.nodes as any).Box;
    if (boxNode.visible?.setValue) boxNode.visible.setValue(false);
    if (boxNode.element) boxNode.element.visible = false;
}

// Prefer Ground_Anchor or WorldTracker so it anchors to the real physical floor in AR
const arAnchor = (instance?.nodes as any)?.Ground_Anchor?.element 
              || (instance?.nodes as any)?.WorldTracker?.element 
              || (instance?.nodes as any)?.Ground_Anchor
              || (instance?.nodes as any)?.WorldTracker
              || threeScene;

// Attach MazeGame directly to the AR anchor
mazeGame.init(arAnchor);
mazeGame.start();

// Game loop hook
let lastTime = performance.now();
function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.updateActiveGame(delta);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
