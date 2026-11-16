import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";
import { MazeGame } from "./src/MazeGame";
import { SimonGame } from "./src/SimonGame";
import { GameHUD } from "./src/ui/GameHUD";
import { soundManager } from "./src/SoundManager";

console.log("=== SENSEI AR 10 MINI-GAMES SYSTEM ===");

// 1. Create GameHUD and hook up touch callbacks
const hud = new GameHUD();

// 2. Create and register Mini-Game #1 (Maze) & Mini-Game #2 (Simon)
const mazeGame = new MazeGame({
    wallGracePeriod: 2.0,    // Seconds warning before penalty reset
    collisionDistance: 0.25,  // Proximity threshold in meters (0.25m = ~10 inches)
    moveSpeed: 3.0           // Keyboard dev simulation speed
});

const simonGame = new SimonGame({
    totalRounds: 3,
    startingSequenceLength: 3, // Round 1 = 3 flashes, Round 2 = 4, Round 3 = 5
    panelDistanceZ: -1.6,      // 1.6m in front of placement anchor
    panelHeightY: 1.15         // Chest/eye height
});

gameManager.registerGame(mazeGame);
gameManager.registerGame(simonGame);
// Do not activate any game at startup — all game folders stay hidden until the user selects a game!

type ActivePlayableGame = MazeGame | SimonGame;
const getCurrentPlayableGame = (): ActivePlayableGame | null => {
    return (gameManager.getActiveGame() as ActivePlayableGame) || null;
};

// Connect notifications & restart button availability from both games to HUD
mazeGame.onNotification = (message, type) => {
    if (gameManager.getActiveGame() === mazeGame) hud.notify(message, type);
};
simonGame.onNotification = (message, type) => {
    if (gameManager.getActiveGame() === simonGame) hud.notify(message, type);
};

mazeGame.onRestartAvailabilityChanged = (canRestart) => {
    if (gameManager.getActiveGame() === mazeGame) hud.setRestartVisible(canRestart);
};
simonGame.onRestartAvailabilityChanged = (canRestart) => {
    if (gameManager.getActiveGame() === simonGame) hud.setRestartVisible(canRestart);
};

// Connect HUD touch button callbacks to active game
hud.onRestartClicked = () => {
    getCurrentPlayableGame()?.restartTrial();
};

hud.onPlacementChanged = (placed) => {
    mazeGame.setPlaced(placed);
    simonGame.setPlaced(placed);
};

hud.onResetAllClicked = () => {
    gameManager.resetAllProgress();
    const active = getCurrentPlayableGame();
    if (active) {
        active.restartTrial();
        active.onNotification?.('🧹 Quest reset! 0/10 items collected.', 'info');
    }
};

// 3. Initialize Mattercraft 3D Scene
const launchButtonEl = document.getElementById('launchButton');
const result = initialize(Scene, {}, {
    launchButton: launchButtonEl
});

if (launchButtonEl) {
    launchButtonEl.addEventListener('click', () => {
        soundManager.unlockAndPreload();
        hud.onLaunched();
    });
}

const instance = result.rootInstance;
const threeScene = useScene(result.contextManager);

// 4. Link active AR camera for 6-DOF physical walking & 3D button raycasting
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    mazeGame.setCamera(cameraObservable.value);
    simonGame.setCamera(cameraObservable.value);
}
cameraObservable.addListener((activeCam) => {
    mazeGame.setCamera(activeCam);
    simonGame.setCamera(activeCam);
});

// 5. Anchor Game 1 (Maze) & Game 2 (Simon) inside UserPlacementAnchorGroup's moving _innerGroup!
const sceneNodes = (instance?.nodes as any) || {};

const placementAnchorNode = sceneNodes.UserPlacementAnchorGroup || sceneNodes['UserPlacementAnchorGroup'];
const game1Node = sceneNodes.Game_1_Maze || sceneNodes['Game_1_Maze'];

// IMPORTANT: In UserPlacementAnchorGroup, `.element` is a static outer wrapper at (0,0,0),
// whereas `._innerGroup` / `._parentForChildren` (which is `game1Node.element.parent`) is the
// actual moving group that slides across the floor during placement!
const placementInnerGroup = placementAnchorNode?._innerGroup
                         || placementAnchorNode?._parentForChildren
                         || game1Node?.element?.parent
                         || placementAnchorNode?.element
                         || sceneNodes.Ground_Anchor?.element
                         || sceneNodes.WorldTracker?.element
                         || threeScene;

const game1Container = game1Node?.element || placementInnerGroup;

const game2Node = sceneNodes.Game_2_Placeholder || sceneNodes['Game_2_[Placeholder]'] || sceneNodes.Game_2;

// Helper to toggle both Mattercraft ZComponent visibility and Three.js Object3D visibility
const setFolderVisible = (zNode: any, visible: boolean) => {
    if (!zNode) return;
    if (zNode.visible && typeof zNode.visible === 'object' && 'value' in zNode.visible) {
        zNode.visible.value = visible;
    } else if (typeof zNode.visible === 'boolean') {
        zNode.visible = visible;
    }
    if (zNode.element) {
        zNode.element.visible = visible;
    }
};

mazeGame.init(game1Container);
simonGame.init(placementInnerGroup);

// Hide ALL 10 game folders at startup for maximum GPU optimization until user selects a game!
setFolderVisible(game1Node, false);
mazeGame.container.visible = false;
simonGame.container.visible = false;

for (let i = 2; i <= 10; i++) {
    const placeholderNode = sceneNodes[`Game_${i}_[Placeholder]`]
                         || sceneNodes[`Game_${i}_Placeholder`]
                         || sceneNodes[`Game_${i}_Placeholder_`]
                         || sceneNodes[`Game_${i}`];
    setFolderVisible(placeholderNode, false);
}

// Switch between Game 1 (Maze) and Game 2 (Simon) when selected in the HUD
hud.onGameSelected = (gameNumber) => {
    soundManager.stopAllLoops();

    // Enter floor placement mode when selecting a game so the player can choose where to place it with ✓
    if (placementAnchorNode?.placementMode && !placementAnchorNode.placementMode.value) {
        placementAnchorNode.placementMode.value = true;
    }

    if (gameNumber === 1) {
        // Turn OFF Game 2 and turn ON Game 1 folder
        setFolderVisible(game2Node, false);
        simonGame.container.visible = false;

        setFolderVisible(game1Node, true);
        mazeGame.container.visible = true;
        gameManager.setActiveGame(mazeGame.id);
        mazeGame.start();
        hud.setRestartVisible(mazeGame.canRestart());
    } else {
        // Turn OFF Game 1 (Maze folder) and turn ON Game 2
        setFolderVisible(game1Node, false);
        mazeGame.container.visible = false;

        setFolderVisible(game2Node, true);
        simonGame.container.visible = true;
        gameManager.setActiveGame(simonGame.id);
        simonGame.start();
        hud.setRestartVisible(simonGame.canRestart());
    }
};

// 6. Automatically discover custom visual scene nodes from Mattercraft

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

// Bind custom nodes to MazeGame (keep hidden until user selects Game 1 in HUD!)
mazeGame.bindCustomSceneNodes({
    collidersGroup: wallsGroup,
    startPad: startPadNode,
    flag: flagNode,
    goalItem: goalNode
});
setFolderVisible(game1Node, false);
mazeGame.container.visible = false;

// 6.5 Sync placement state and game-started condition if UserPlacementAnchor exists in scene
let hasPlacementAnchor = false;
for (const key of Object.keys(sceneNodes)) {
    const node = sceneNodes[key];
    if (node && (node.onPlacing || node.onNotPlacing || (node.placementMode && node.placementMode.value !== undefined))) {
        hasPlacementAnchor = true;
        if (node.onPlacing && typeof node.onPlacing.addListener === 'function') {
            node.onPlacing.addListener(() => {
                mazeGame.setPlaced(false);
                simonGame.setPlaced(false);
                hud.setPlaced(false);
            });
        }
        if (node.onNotPlacing && typeof node.onNotPlacing.addListener === 'function') {
            node.onNotPlacing.addListener(() => {
                mazeGame.setPlaced(true);
                simonGame.setPlaced(true);
                hud.setPlaced(true);
            });
        }
        if (node.placementMode && typeof node.placementMode.addListener === 'function') {
            node.placementMode.addListener((isPlacing: boolean) => {
                mazeGame.setPlaced(!isPlacing);
                simonGame.setPlaced(!isPlacing);
                hud.setPlaced(!isPlacing);
            });
            mazeGame.setPlaced(!node.placementMode.value);
            simonGame.setPlaced(!node.placementMode.value);
            hud.setPlaced(!node.placementMode.value);
        }
        break;
    }
}

// Fallback for non-placement environments: activate game on launch
if (!hasPlacementAnchor && launchButtonEl) {
    launchButtonEl.addEventListener('click', () => {
        mazeGame.setPlaced(true);
        simonGame.setPlaced(true);
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
        const activeGame = getCurrentPlayableGame();
        const elapsed = activeGame ? activeGame.getElapsedTime() : 0;
        hud.updateStatus(prog.collected, prog.total, elapsed);
        hud.setRestartVisible(activeGame ? activeGame.canRestart() : false);
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
