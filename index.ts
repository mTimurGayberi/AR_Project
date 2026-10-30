import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";

console.log("=== SENSEI AR 10 MINI-GAMES SYSTEM ===");

// 1. Create and register the first mini-game (Maze)
// Dimensions and colliders are dynamically auto-detected from whatever is in Mattercraft!
const mazeGame = new MazeGame({
    wallGracePeriod: 2.0,    // Seconds warning before penalty reset
    collisionDistance: 0.25,  // Proximity threshold in meters (0.25m = ~10 inches. Lower = less sensitive, e.g. 0.20m)
    moveSpeed: 3.0           // Keyboard dev simulation speed
});

gameManager.registerGame(mazeGame);
gameManager.setActiveGame(mazeGame.id);

let updateCounterUI: () => void = () => {};

function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const mStr = mins < 10 ? '0' + mins : '' + mins;
    const sStr = secs < 10 ? '0' + secs : '' + secs;
    return `${mStr}:${sStr}`;
}

// 2. Setup HUD Notification Display & Bottom Action Bar
function createHUD() {
    // Failure / Warning Screen Vignette Overlay
    const failVignette = document.createElement('div');
    failVignette.id = 'hud-vignette';
    failVignette.style.position = 'fixed';
    failVignette.style.top = '0';
    failVignette.style.left = '0';
    failVignette.style.width = '100vw';
    failVignette.style.height = '100vh';
    failVignette.style.pointerEvents = 'none';
    failVignette.style.zIndex = '999990';
    failVignette.style.opacity = '0';
    failVignette.style.transition = 'opacity 0.3s ease';
    failVignette.style.boxShadow = 'inset 0 0 60px 20px rgba(239, 68, 68, 0.75)';
    document.body.appendChild(failVignette);

    // Top HUD Container
    const hudContainer = document.createElement('div');
    hudContainer.id = 'game-hud';
    hudContainer.style.position = 'fixed';
    hudContainer.style.top = '48px'; // Avoids iPhone notch / Dynamic Island
    hudContainer.style.left = '50%';
    hudContainer.style.transform = 'translateX(-50%)';
    hudContainer.style.zIndex = '999999'; // High z-index ensures visibility on mobile WebAR!
    hudContainer.style.display = 'flex';
    hudContainer.style.flexDirection = 'column';
    hudContainer.style.alignItems = 'center';
    hudContainer.style.pointerEvents = 'none';
    hudContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    hudContainer.style.width = '90%';
    hudContainer.style.maxWidth = '460px';

    const counterPill = document.createElement('div');
    counterPill.id = 'hud-counter';
    counterPill.style.background = 'rgba(15, 23, 42, 0.88)';
    counterPill.style.color = '#38bdf8';
    counterPill.style.border = '1px solid rgba(56, 189, 248, 0.35)';
    counterPill.style.borderRadius = '20px';
    counterPill.style.padding = '8px 18px';
    counterPill.style.fontSize = '13px';
    counterPill.style.fontWeight = 'bold';
    counterPill.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    counterPill.style.textAlign = 'center';
    (counterPill.style as any).backdropFilter = 'blur(8px)';
    (counterPill.style as any).webkitBackdropFilter = 'blur(8px)';

    updateCounterUI = () => {
        const prog = gameManager.getProgression();
        const walls = mazeGame.getLoadedCollidersCount();
        const elapsed = mazeGame.getElapsedTime();
        counterPill.innerText = `🔮 Items: ${prog.collected} / ${prog.total} | ⏱️ ${formatTime(elapsed)} | 🛡️ Walls: ${walls}`;
    };
    updateCounterUI();
    hudContainer.appendChild(counterPill);

    const alertBanner = document.createElement('div');
    alertBanner.id = 'hud-banner';
    alertBanner.style.marginTop = '10px';
    alertBanner.style.padding = '10px 18px';
    alertBanner.style.borderRadius = '10px';
    alertBanner.style.fontSize = '14px';
    alertBanner.style.fontWeight = '600';
    alertBanner.style.display = 'none';
    alertBanner.style.textAlign = 'center';
    alertBanner.style.transition = 'all 0.25s ease';
    alertBanner.style.pointerEvents = 'none';
    (alertBanner.style as any).backdropFilter = 'blur(6px)';
    (alertBanner.style as any).webkitBackdropFilter = 'blur(6px)';
    hudContainer.appendChild(alertBanner);

    document.body.appendChild(hudContainer);

    let hideBannerTimer: any = null;

    mazeGame.onNotification = (message, type) => {
        if (hideBannerTimer) {
            clearTimeout(hideBannerTimer);
            hideBannerTimer = null;
        }

        alertBanner.innerText = message;
        alertBanner.style.display = 'block';

        if (type === 'error') {
            // Real Failure State: Bright red, glowing, STICKY until physical return or restart!
            alertBanner.style.background = 'rgba(220, 38, 38, 0.95)';
            alertBanner.style.color = '#ffffff';
            alertBanner.style.border = '1px solid rgba(254, 202, 202, 0.5)';
            alertBanner.style.boxShadow = '0 0 20px rgba(220, 38, 38, 0.85)';
            failVignette.style.opacity = '1';
            // Notice: No auto-hide timeout for error! Must physically return or tap Restart.
        } else if (type === 'warning') {
            alertBanner.style.background = 'rgba(234, 88, 12, 0.95)';
            alertBanner.style.color = '#ffffff';
            alertBanner.style.border = '1px solid rgba(253, 186, 116, 0.5)';
            alertBanner.style.boxShadow = '0 0 16px rgba(234, 88, 12, 0.75)';
            failVignette.style.opacity = '0.35';
        } else if (type === 'success') {
            alertBanner.style.background = 'rgba(16, 185, 129, 0.95)';
            alertBanner.style.color = '#ffffff';
            alertBanner.style.border = '1px solid rgba(167, 243, 208, 0.5)';
            alertBanner.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.75)';
            failVignette.style.opacity = '0';
            updateCounterUI();
            hideBannerTimer = setTimeout(() => {
                alertBanner.style.display = 'none';
            }, 3500);
        } else {
            alertBanner.style.background = 'rgba(30, 41, 59, 0.9)';
            alertBanner.style.color = '#e2e8f0';
            alertBanner.style.border = '1px solid rgba(148, 163, 184, 0.3)';
            alertBanner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            failVignette.style.opacity = '0';
            hideBannerTimer = setTimeout(() => {
                alertBanner.style.display = 'none';
            }, 3500);
        }
    };

    // Bottom Action Buttons (Mobile WebAR Touch Friendly)
    const bottomControls = document.createElement('div');
    bottomControls.id = 'hud-bottom-controls';
    bottomControls.style.position = 'fixed';
    bottomControls.style.bottom = '24px';
    bottomControls.style.left = '50%';
    bottomControls.style.transform = 'translateX(-50%)';
    bottomControls.style.zIndex = '999999';
    bottomControls.style.display = 'flex';
    bottomControls.style.gap = '12px';
    bottomControls.style.pointerEvents = 'auto';
    bottomControls.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // 1. Restart Current Game Button
    const restartBtn = document.createElement('button');
    restartBtn.innerText = '🔄 Restart Trial';
    restartBtn.style.background = 'rgba(15, 23, 42, 0.88)';
    restartBtn.style.color = '#38bdf8';
    restartBtn.style.border = '1px solid rgba(56, 189, 248, 0.45)';
    restartBtn.style.borderRadius = '24px';
    restartBtn.style.padding = '10px 18px';
    restartBtn.style.fontSize = '14px';
    restartBtn.style.fontWeight = 'bold';
    restartBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.outline = 'none';
    (restartBtn.style as any).backdropFilter = 'blur(8px)';
    (restartBtn.style as any).webkitBackdropFilter = 'blur(8px)';
    restartBtn.onclick = () => {
        failVignette.style.opacity = '0';
        mazeGame.restartTrial();
    };

    // 2. Reset All 10 Mini-Games Progress Button
    const resetAllBtn = document.createElement('button');
    resetAllBtn.innerText = '⚙️ Reset Quest';
    resetAllBtn.style.background = 'rgba(15, 23, 42, 0.88)';
    resetAllBtn.style.color = '#fda4af';
    resetAllBtn.style.border = '1px solid rgba(244, 63, 94, 0.45)';
    resetAllBtn.style.borderRadius = '24px';
    resetAllBtn.style.padding = '10px 18px';
    resetAllBtn.style.fontSize = '14px';
    resetAllBtn.style.fontWeight = 'bold';
    resetAllBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    resetAllBtn.style.cursor = 'pointer';
    resetAllBtn.style.outline = 'none';
    (resetAllBtn.style as any).backdropFilter = 'blur(8px)';
    (resetAllBtn.style as any).webkitBackdropFilter = 'blur(8px)';
    resetAllBtn.onclick = () => {
        const confirmed = window.confirm('Reset ALL quest progress back to 0/10 special items?');
        if (confirmed) {
            failVignette.style.opacity = '0';
            gameManager.resetAllProgress();
            gameManager.setActiveGame(mazeGame.id);
            mazeGame.restartTrial();
            updateCounterUI();
            mazeGame.notify('🧹 Quest reset! 0/10 items collected.', 'info');
        }
    };

    // Tactile touch reactions for mobile
    [restartBtn, resetAllBtn].forEach(btn => {
        btn.addEventListener('touchstart', () => { btn.style.transform = 'scale(0.95)'; });
        btn.addEventListener('touchend', () => { btn.style.transform = 'scale(1.0)'; });
    });

    bottomControls.appendChild(restartBtn);
    bottomControls.appendChild(resetAllBtn);
    document.body.appendChild(bottomControls);
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

// 5. Anchor Maze directly to your Game_1_Maze group (or Ground Anchor fallback)
const game1Container = (instance?.nodes as any)?.Game_1_Maze?.element
                    || (instance?.nodes as any)?.['Game_1_Maze']?.element
                    || (instance?.nodes as any)?.Ground_Anchor?.element
                    || (instance?.nodes as any)?.UserPlacementAnchorGroup?.element
                    || (instance?.nodes as any)?.WorldTracker?.element
                    || threeScene;

mazeGame.init(game1Container);

// Hide placeholders for future games (Game 2 to 10) so only Game 1 is active
for (let i = 2; i <= 10; i++) {
    const placeholder = (instance?.nodes as any)?.[`Game_${i}_[Placeholder]`]?.element
                     || (instance?.nodes as any)?.[`Game_${i}`]?.element;
    if (placeholder) {
        placeholder.visible = false;
    }
}

// Automatically hook up custom visual scene nodes if created by 3D artist in Mattercraft!
const sceneNodes = (instance?.nodes as any) || {};

// Forgiving node lookup: supports 'mazeWalls.glb', 'Walls', 'Colliders', 'Colliders/Walls', 'Game_1_Maze'
let wallsGroup = sceneNodes['mazeWalls.glb']
              || sceneNodes['mazeWalls_glb']
              || sceneNodes.mazeWalls
              || sceneNodes['mazeWalls']
              || sceneNodes['Colliders/Walls']
              || sceneNodes.Colliders 
              || sceneNodes.Walls 
              || sceneNodes['Colliders_Walls']
              || sceneNodes.Maze
              || sceneNodes.Game_1_Maze;

// Deep search Three.js scene if not found in root nodes
if (!wallsGroup && threeScene) {
    threeScene.traverse((obj: any) => {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('mazewalls') || (n.includes('walls') && !n.includes('floor'))) {
            wallsGroup = obj;
        }
    });
}

const startPadNode = sceneNodes.StartPad 
                  || sceneNodes['Start Pad']
                  || sceneNodes.Start_Pad
                  || sceneNodes.Start;

const endPadNode = sceneNodes.EndPad 
                || sceneNodes['End Pad']
                || sceneNodes.End_Pad
                || sceneNodes.End
                || sceneNodes.Finish;

const goalNode = sceneNodes.GoalItem 
              || sceneNodes.WindGem 
              || sceneNodes['Goal Item'] 
              || sceneNodes.Collectible 
              || sceneNodes['Collectible']
              || sceneNodes.Item
              || sceneNodes.Goal;

if (wallsGroup || startPadNode || endPadNode) {
    mazeGame.bindCustomSceneNodes({
        collidersGroup: wallsGroup,
        startPad: startPadNode,
        endPad: endPadNode,
        goalItem: goalNode
    });
}

mazeGame.container.visible = true; // Fixed variant: immediately visible and ready!
mazeGame.start();
mazeGame.onNotification?.('Walk through the entrance into the maze towards the green Start Pad!', 'info');

// 6. Game loop hook
let lastTime = performance.now();
let hudTimer = 0;
function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.updateActiveGame(delta);

    hudTimer += delta;
    if (hudTimer >= 0.5) {
        hudTimer = 0;
        updateCounterUI();
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
