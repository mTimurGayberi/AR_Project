import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";
import { GameHUD } from "./src/ui/GameHUD";

console.log("=== SENSEI AR 10 MINI-GAMES SYSTEM ===");

// 1. Create GameHUD and hook up touch callbacks
const hud = new GameHUD();

// 2. Create and register Mini-Game #1 (Maze)
const mazeGame = new MazeGame({
    wallGracePeriod: 2.0,    // Seconds warning before penalty reset
    collisionDistance: 0.25,  // Proximity threshold in meters (0.25m = ~10 inches)
    moveSpeed: 3.0           // Keyboard dev simulation speed
});

gameManager.registerGame(mazeGame);
gameManager.setActiveGame(mazeGame.id);

// Connect notifications & restart button availability from mazeGame to HUD
mazeGame.onNotification = (message, type) => {
    hud.notify(message, type);
};

mazeGame.onRestartAvailabilityChanged = (canRestart) => {
    hud.setRestartVisible(canRestart);
};

// Connect HUD touch button callbacks to game
hud.onRestartClicked = () => {
    mazeGame.restartTrial();
};

hud.onPlacementChanged = (placed) => {
    mazeGame.setPlaced(placed);
};

hud.onResetAllClicked = () => {
    gameManager.resetAllProgress();
    gameManager.setActiveGame(mazeGame.id);
    mazeGame.restartTrial();
    mazeGame.onNotification?.('🧹 Quest reset! 0/10 items collected.', 'info');
};

// 3. Initialize Mattercraft 3D Scene
const launchButtonEl = document.getElementById('launchButton');
const result = initialize(Scene, {}, {
    launchButton: launchButtonEl
});

if (launchButtonEl) {
    launchButtonEl.addEventListener('click', () => {
        hud.onLaunched();
    });
}

const instance = result.rootInstance;
const threeScene = useScene(result.contextManager);

// 4. Link active AR camera for 6-DOF physical walking
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    mazeGame.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    mazeGame.setCamera(activeCam);
});

// 5. Anchor Maze directly to Game_1_Maze container
const game1Container = (instance?.nodes as any)?.Game_1_Maze?.element
                    || (instance?.nodes as any)?.['Game_1_Maze']?.element
                    || (instance?.nodes as any)?.Ground_Anchor?.element
                    || (instance?.nodes as any)?.UserPlacementAnchorGroup?.element
                    || (instance?.nodes as any)?.WorldTracker?.element
                    || threeScene;

mazeGame.init(game1Container);

// Hide placeholders for future games (Game 2 to 10)
for (let i = 2; i <= 10; i++) {
    const placeholder = (instance?.nodes as any)?.[`Game_${i}_[Placeholder]`]?.element
                     || (instance?.nodes as any)?.[`Game_${i}`]?.element;
    if (placeholder) {
        placeholder.visible = false;
    }
}

// 6. Automatically discover custom visual scene nodes from Mattercraft
const sceneNodes = (instance?.nodes as any) || {};

// Walls node
let wallsGroup = sceneNodes['mazeWalls.glb']
              || sceneNodes['mazeWalls_glb']
              || sceneNodes.mazeWalls
              || sceneNodes['mazeWalls']
              || sceneNodes['Colliders/Walls']
              || sceneNodes.Colliders 
              || sceneNodes.Walls 
              || sceneNodes['Colliders_Walls']
              || sceneNodes.Game_1_Maze;

if (!wallsGroup && threeScene) {
    threeScene.traverse((obj: any) => {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('mazewalls') || (n.includes('walls') && !n.includes('floor'))) {
            wallsGroup = obj;
        }
    });
}

// Flag node (Start Anchor)
let flagNode = sceneNodes['flag.glb'] 
            || sceneNodes.Flag 
            || sceneNodes['Flag.glb'] 
            || sceneNodes.flag 
            || sceneNodes.StartFlag;

if (!flagNode && threeScene) {
    threeScene.traverse((obj: any) => {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('flag')) {
            flagNode = obj;
        }
    });
}

// StartPad indicator node
let startPadNode = sceneNodes.StartPad 
                || sceneNodes.startPod
                || sceneNodes.StartPod
                || sceneNodes['startPod.glb']
                || sceneNodes['StartPad.glb']
                || sceneNodes['Start Pad']
                || sceneNodes.Start_Pad
                || sceneNodes.Start;

if (!startPadNode && threeScene) {
    threeScene.traverse((obj: any) => {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('startpad') || n.includes('startpod') || n.includes('start_pad') || n.includes('pad') || n.includes('pod')) {
            startPadNode = obj;
        }
    });
}

// Collectible Gem node
let goalNode = sceneNodes.gem
            || sceneNodes.Gem
            || sceneNodes['gem.glb']
            || sceneNodes['Gem.glb']
            || sceneNodes.GoalItem 
            || sceneNodes.WindGem 
            || sceneNodes['Goal Item'] 
            || sceneNodes.Collectible 
            || sceneNodes['Collectible']
            || sceneNodes.Icosphere
            || sceneNodes.IcoSphere;

if (!goalNode && threeScene) {
    threeScene.traverse((obj: any) => {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('gem') || n.includes('icosphere') || n.includes('collectible') || n.includes('goalitem')) {
            goalNode = obj;
        }
    });
}

// Bind custom nodes to MazeGame
mazeGame.bindCustomSceneNodes({
    collidersGroup: wallsGroup,
    startPad: startPadNode,
    flag: flagNode,
    goalItem: goalNode
});

mazeGame.container.visible = true;
mazeGame.start();

// 6.5 Sync placement state and game-started condition if UserPlacementAnchor exists in scene
let hasPlacementAnchor = false;
for (const key of Object.keys(sceneNodes)) {
    const node = sceneNodes[key];
    if (node && (node.onPlacing || node.onNotPlacing || (node.placementMode && node.placementMode.value !== undefined))) {
        hasPlacementAnchor = true;
        if (node.onPlacing && typeof node.onPlacing.addListener === 'function') {
            node.onPlacing.addListener(() => {
                mazeGame.setPlaced(false);
                hud.setPlaced(false);
            });
        }
        if (node.onNotPlacing && typeof node.onNotPlacing.addListener === 'function') {
            node.onNotPlacing.addListener(() => {
                mazeGame.setPlaced(true);
                hud.setPlaced(true);
            });
        }
        if (node.placementMode && typeof node.placementMode.addListener === 'function') {
            node.placementMode.addListener((isPlacing: boolean) => {
                mazeGame.setPlaced(!isPlacing);
                hud.setPlaced(!isPlacing);
            });
            mazeGame.setPlaced(!node.placementMode.value);
            hud.setPlaced(!node.placementMode.value);
        }
        break;
    }
}

// Fallback for non-placement environments: activate game on launch
if (!hasPlacementAnchor && launchButtonEl) {
    launchButtonEl.addEventListener('click', () => {
        mazeGame.setPlaced(true);
        hud.setPlaced(true);
    });
}

// 7. Game render loop
let lastTime = performance.now();
let hudTimer = 0;

function loop(now: number) {
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    gameManager.updateActiveGame(delta);

    // Update HUD status every 0.25s
    hudTimer += delta;
    if (hudTimer >= 0.25) {
        hudTimer = 0;
        const prog = gameManager.getProgression();
        const elapsed = mazeGame.getElapsedTime();
        hud.updateStatus(prog.collected, prog.total, elapsed);
        hud.setRestartVisible(mazeGame.canRestart());
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
