import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";

// --- CONFIGURATION FOR CAMPUS ROOM ---
// You can adjust roomWidth and roomDepth here to match your exact room dimensions.
const CAMPUS_ROOM_CONFIG = {
    roomWidth: 5.0,        // Fixed room width in meters (e.g. 4.0m - 6.0m)
    roomDepth: 5.0,        // Fixed room depth in meters
    wallHeight: 1.8,       // Fixed human height in meters (never shrunk!)
    wallGracePeriod: 2.0,  // Seconds warning before penalty reset
    moveSpeed: 2.5         // Keyboard dev simulation speed
};

console.log("=== SENSEI AR 10 MINI-GAMES SYSTEM ===");
console.log(`[Campus Setup] Fixed Maze Room: ${CAMPUS_ROOM_CONFIG.roomWidth}m × ${CAMPUS_ROOM_CONFIG.roomDepth}m (Wall height: ${CAMPUS_ROOM_CONFIG.wallHeight}m)`);

// 1. Create and register the first mini-game (Maze)
const mazeGame = new MazeGame({
    roomWidth: CAMPUS_ROOM_CONFIG.roomWidth,
    roomDepth: CAMPUS_ROOM_CONFIG.roomDepth,
    wallHeight: CAMPUS_ROOM_CONFIG.wallHeight,
    wallGracePeriod: CAMPUS_ROOM_CONFIG.wallGracePeriod,
    moveSpeed: CAMPUS_ROOM_CONFIG.moveSpeed
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
            }, 3500);
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

// Handle the level Box representing the maze area
const boxNode = (instance?.nodes as any)?.Box;
if (boxNode?.element) {
    const boxMesh = boxNode.element as THREE.Mesh;
    
    // If the Box in Mattercraft was scaled to represent the room, use its scale!
    if (boxMesh.scale && (boxMesh.scale.x > 1.1 || boxMesh.scale.z > 1.1)) {
        console.log(`[Level Box] Adopting level box scale: ${boxMesh.scale.x}m × ${boxMesh.scale.z}m`);
        mazeGame.setRoomDimensions(boxMesh.scale.x, boxMesh.scale.z);
    }

    // Make the level box a sleek translucent wireframe boundary so it never blocks the player's view
    if (boxMesh.material) {
        if (Array.isArray(boxMesh.material)) {
            boxMesh.material.forEach((m: any) => {
                m.transparent = true;
                m.opacity = 0.15;
                m.wireframe = true;
            });
        } else {
            const mat = boxMesh.material as any;
            mat.transparent = true;
            mat.opacity = 0.15;
            mat.wireframe = true;
            mat.color = new THREE.Color(0x38bdf8);
        }
    }
}

// 4. Link active AR camera for 6-DOF physical walking
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    mazeGame.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    mazeGame.setCamera(activeCam);
});

// 5. Anchor Maze directly to Ground Anchor / Level Anchor
const groundNode = (instance?.nodes as any)?.Ground_Anchor?.element
                || (instance?.nodes as any)?.UserPlacementAnchorGroup?.element
                || (instance?.nodes as any)?.WorldTracker?.element
                || threeScene;

mazeGame.init(groundNode);
mazeGame.container.visible = true; // Fixed variant: immediately visible and ready!
mazeGame.start();
mazeGame.onNotification?.('Walk through the entrance into the maze towards the green Start Pad!', 'info');

// 6. Game loop hook
let lastTime = performance.now();
function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.updateActiveGame(delta);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
