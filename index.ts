import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";
import { RoomScanner } from "./src/RoomScanner";

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

// 2. Setup HUD Notification Display
function createHUD() {
    const hudContainer = document.createElement('div');
    hudContainer.id = 'game-hud';
    hudContainer.style.position = 'fixed';
    hudContainer.style.top = '48px'; // Avoids iPhone notch / Dynamic Island
    hudContainer.style.left = '50%';
    hudContainer.style.transform = 'translateX(-50%)';
    hudContainer.style.zIndex = '1000';
    hudContainer.style.display = 'flex';
    hudContainer.style.flexDirection = 'column';
    hudContainer.style.alignItems = 'center';
    hudContainer.style.pointerEvents = 'none';
    hudContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';

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

    mazeGame.onNotification = (message, type) => {
        alertBanner.innerText = message;
        alertBanner.style.display = 'block';

        if (type === 'warning') {
            alertBanner.style.background = 'rgba(239, 68, 68, 0.9)';
            alertBanner.style.color = '#ffffff';
            alertBanner.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
        } else if (type === 'success') {
            alertBanner.style.background = 'rgba(16, 185, 129, 0.9)';
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

// Hide the default template Box
if ((instance?.nodes as any)?.Box) {
    const boxNode = (instance.nodes as any).Box;
    if (boxNode.visible?.setValue) boxNode.visible.setValue(false);
    if (boxNode.element) boxNode.element.visible = false;
}

// 4. Initialize Reusable RoomScanner Service
const roomScanner = new RoomScanner(threeScene);

// Link active AR camera for 6-DOF physical walking
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    mazeGame.setCamera(cameraObservable.value);
    roomScanner.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    mazeGame.setCamera(activeCam);
    roomScanner.setCamera(activeCam);
});

// Anchor target
const groundNode = (instance?.nodes as any)?.UserPlacementAnchorGroup?.element
                || (instance?.nodes as any)?.Ground_Anchor?.element
                || (instance?.nodes as any)?.WorldTracker?.element
                || threeScene;

mazeGame.init(groundNode);
mazeGame.container.visible = false; // Hidden until room boundary is scanned
mazeGame.start();

// 5. Start Room Scanning Flow
function startRoomScanFlow() {
    mazeGame.container.visible = false;

    roomScanner.startScan((bounds) => {
        // Fit maze 100% inside the scanned room boundary polygon!
        mazeGame.applyRoomBounds(bounds);
        mazeGame.container.visible = true;
    });
}
startRoomScanFlow();

// Recalibrate button at bottom-left
const recalibBtn = document.createElement('button');
recalibBtn.innerText = '📐 Recalibrate Room';
recalibBtn.style.position = 'fixed';
recalibBtn.style.bottom = '15px';
recalibBtn.style.left = '15px';
recalibBtn.style.zIndex = '1500';
recalibBtn.style.padding = '8px 14px';
recalibBtn.style.borderRadius = '20px';
recalibBtn.style.border = '1px solid rgba(255,255,255,0.2)';
recalibBtn.style.background = 'rgba(15, 23, 42, 0.85)';
recalibBtn.style.color = '#94a3b8';
recalibBtn.style.fontSize = '12px';
recalibBtn.style.cursor = 'pointer';
recalibBtn.onclick = () => {
    startRoomScanFlow();
};
document.body.appendChild(recalibBtn);

// Game loop hook
let lastTime = performance.now();
function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Update room scanner reticle & live boundary line
    roomScanner.update();

    if (mazeGame.container.visible) {
        gameManager.updateActiveGame(delta);
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
