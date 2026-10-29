import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";
import { WorldTrackingUI } from "@zcomponent/zappar-three/lib/components/WorldTrackingUI";
import { UserPlacementAnchorGroup } from "@zcomponent/zappar-three/lib/components/anchorgroups/UserPlacementAnchorGroup";

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
    mazeGame.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    mazeGame.setCamera(activeCam);
});

// Hide the default template Box so it doesn't block the scene!
if ((instance?.nodes as any)?.Box) {
    const boxNode = (instance.nodes as any).Box;
    if (boxNode.visible?.setValue) boxNode.visible.setValue(false);
    if (boxNode.element) boxNode.element.visible = false;
}

// 4. Teeter Tower Style Scanning & Tap-to-Place
// Check if UserPlacementAnchorGroup exists in Mattercraft scene, or create it dynamically
let placementAnchor = (instance?.nodes as any)?.UserPlacementAnchorGroup 
                   || (instance?.nodes as any)?.User_Placement_Anchor_Group;

// Initialize official Zappar floor scanning animation ("Move forward and back to find a surface")
try {
    new WorldTrackingUI(result.contextManager, {});
} catch (e) {
    console.log("[AR] WorldTrackingUI:", e);
}

// If UserPlacementAnchorGroup wasn't created in the Mattercraft UI, create it dynamically
if (!placementAnchor) {
    try {
        const userPlacement = new UserPlacementAnchorGroup(result.contextManager, {
            startInPlacementMode: true
        });
        userPlacement.placeOnPlanes.setValue(true);
        userPlacement.placeOnGround.setValue(true);
        userPlacement.showPlaceButton.setValue(true);
        userPlacement.placeButtonText.setValue("Tap to Place Maze");
        placementAnchor = userPlacement;
    } catch (e) {
        console.log("[AR] UserPlacementAnchorGroup dynamic init:", e);
    }
}

// Anchor MazeGame to UserPlacementAnchorGroup (or Ground_Anchor fallback)
const arAnchor = placementAnchor?.element 
              || (instance?.nodes as any)?.Ground_Anchor?.element 
              || (instance?.nodes as any)?.WorldTracker?.element 
              || threeScene;

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
