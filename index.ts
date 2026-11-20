import * as THREE from 'three';
import { initialize, useScene, useCamera } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/utils/GameManager";
import { SimonGame } from "./src/games/SimonGame";
import { GlassBridgeGame } from "./src/games/GlassBridge";
import { GameHUD, type GameDropdownOption } from "./src/ui/GameHUD";
import { soundManager } from "./src/utils/SoundManager";
import type { BaseMiniGame } from "./src/core/BaseMiniGame";
// import { MazeGame } from "./src/MazeGame"; // Muted / parked on the side

console.log("=== SENSEI AR 10 MINI-GAMES ENTRY POINT ===");

/**
 * Interface for playable mini-games managed by the entry point.
 */
interface PlayableMiniGame extends BaseMiniGame {
    isPlaced: boolean;
    setPlaced(placed: boolean): void;
    setCamera(camera: THREE.Camera): void;
    canRestart(): boolean;
    restartTrial(): void;
    onRestartAvailabilityChanged?: (canRestart: boolean) => void;
}

interface GameCatalogEntry {
    gameNumber: number;
    label: string;
    column: 'MEMORY' | 'SHOOTING' | 'PUZZLE';
    folderCandidates: string[];
    game: PlayableMiniGame | null;
    folderNode?: any;
}

// 1. Create GameHUD
const hud = new GameHUD();

// 2. Instantiate Active Mini-Games (MazeGame is muted/parked on the side)
const simonGame = new SimonGame({
    totalRounds: 3,
    startingSequenceLength: 3 // Round 1 = 3 flashes, Round 2 = 4, Round 3 = 5
});

const glassBridgeGame = new GlassBridgeGame({
    rows: 6,
    cols: 2,
    revealDuration: 3.0 // Show safe tiles for 3 seconds
});

/**
 * 10-Game Modular Catalog (3 Columns x 4 Rows: MEMORY | SHOOTING | PUZZLE)
 * As each new game is implemented, plug its instance into `game` below!
 */
const GAME_CATALOG: GameCatalogEntry[] = [
    // Row 1
    {
        gameNumber: 1,
        label: '1. 🏮 Simon Lanterns [Memory]',
        column: 'MEMORY',
        folderCandidates: ['Game_2_Simon', 'Game_1_Simon', 'Game_2_Placeholder', 'Game_2_[Placeholder]'],
        game: simonGame
    },
    {
        gameNumber: 2,
        label: '2. 🥷 Shuriken Throw [Shooting]',
        column: 'SHOOTING',
        folderCandidates: ['Game_2_Shuriken', 'Game_3_Placeholder_', 'Game_3_[Placeholder] ', 'Game_3_[Placeholder]'],
        game: null
    },
    {
        gameNumber: 3,
        label: '3. 🖼️ Paintings [Puzzle]',
        column: 'PUZZLE',
        folderCandidates: ['Game_3_Paintings', 'Game_4_Placeholder_', 'Game_4_[Placeholder]  ', 'Game_4_[Placeholder]'],
        game: null
    },
    // Row 2
    {
        gameNumber: 4,
        label: '4. 🌉 Glass Bridge [Memory]',
        column: 'MEMORY',
        folderCandidates: ['Game_4_Bridge', 'Game_5_Placeholder_', 'Game_5_[Placeholder]  ', 'Game_5_[Placeholder]'],
        game: glassBridgeGame
    },
    {
        gameNumber: 5,
        label: '5. 🕯️ Candle Spark [Shooting]',
        column: 'SHOOTING',
        folderCandidates: ['Game_5_Candle', 'Game_6_Placeholder_', 'Game_6_[Placeholder]  ', 'Game_6_[Placeholder]'],
        game: null
    },
    {
        gameNumber: 6,
        label: '6. 📦 Boxes [Puzzle]',
        column: 'PUZZLE',
        folderCandidates: ['Game_6_Boxes', 'Game_7_Placeholder_', 'Game_7_[Placeholder]  ', 'Game_7_[Placeholder]'],
        game: null
    },
    // Row 3
    {
        gameNumber: 7,
        label: '7. 🍜 Cooking [Memory]',
        column: 'MEMORY',
        folderCandidates: ['Game_7_Cooking', 'Game_8_Placeholder_', 'Game_8_[Placeholder]  ', 'Game_8_[Placeholder]'],
        game: null
    },
    {
        gameNumber: 8,
        label: '8. 🍙 Feed the Master [Shooting]',
        column: 'SHOOTING',
        folderCandidates: ['Game_8_FeedMaster', 'Game_9_Placeholder_', 'Game_9_[Placeholder]  ', 'Game_9_[Placeholder]'],
        game: null
    },
    {
        gameNumber: 9,
        label: '9. 🧩 Puzzle III [Puzzle]',
        column: 'PUZZLE',
        folderCandidates: ['Game_9_Puzzle', 'Game_10_Placeholder_', 'Game_10_[Placeholder]  ', 'Game_10_[Placeholder]'],
        game: null
    },
    // Row 4 (Finale)
    {
        gameNumber: 10,
        label: '10. 🔥 Test Fireball [Shooting]',
        column: 'SHOOTING',
        folderCandidates: ['Game_10_Fireball'],
        game: null
    }
];

// Register all implemented games with GameManager & populate the HUD dropdown
const dropdownOptions: GameDropdownOption[] = GAME_CATALOG.map((entry) => {
    if (entry.game) {
        gameManager.registerGame(entry.game);
        entry.game.onNotification = (message, type) => {
            if (gameManager.getActiveGame() === entry.game) {
                hud.notify(message, type);
            }
        };
        entry.game.onRestartAvailabilityChanged = (canRestart) => {
            if (gameManager.getActiveGame() === entry.game) {
                hud.setRestartVisible(canRestart);
            }
        };
    }
    return {
        gameNumber: entry.gameNumber,
        label: entry.label,
        enabled: entry.game !== null
    };
});

hud.setGameOptions(dropdownOptions);

const getCurrentPlayableGame = (): PlayableMiniGame | null => {
    return (gameManager.getActiveGame() as PlayableMiniGame) || null;
};

const forEachPlayableGame = (fn: (game: PlayableMiniGame) => void) => {
    for (const entry of GAME_CATALOG) {
        if (entry.game) fn(entry.game);
    }
};

// Connect HUD callbacks
hud.onRestartClicked = () => {
    getCurrentPlayableGame()?.restartTrial();
};

hud.onPlacementChanged = (placed) => {
    forEachPlayableGame((game) => game.setPlaced(placed));
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
const sceneNodes = (instance?.nodes as any) || {};

// 4. Link active AR camera to all playable games
const cameraObservable = useCamera(result.contextManager);
if (cameraObservable.value) {
    forEachPlayableGame((game) => game.setCamera(cameraObservable.value!));
}
cameraObservable.addListener((activeCam) => {
    forEachPlayableGame((game) => game.setCamera(activeCam));
});

// 5. Discover UserPlacementAnchorGroup's moving `_innerGroup` and hide all folders at startup
const placementAnchorNode = sceneNodes.UserPlacementAnchorGroup || sceneNodes['UserPlacementAnchorGroup'];
const legacyMazeNode = sceneNodes.Game_1_Maze || sceneNodes['Game_1_Maze'];

const placementInnerGroup = placementAnchorNode?._innerGroup
                         || placementAnchorNode?._parentForChildren
                         || legacyMazeNode?.element?.parent
                         || placementAnchorNode?.element
                         || sceneNodes.Ground_Anchor?.element
                         || sceneNodes.WorldTracker?.element
                         || threeScene;

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

// Permanently mute/hide legacy Maze folder (`Game_1_Maze`)
setFolderVisible(legacyMazeNode, false);

// Hide all placeholder folders (Game 2..10) at startup
for (let i = 1; i <= 10; i++) {
    const keys = [
        `Game_${i}_[Placeholder]`,
        `Game_${i}_[Placeholder] `,
        `Game_${i}_[Placeholder]  `,
        `Game_${i}_Placeholder`,
        `Game_${i}_Placeholder_`,
        `Game_${i}`
    ];
    for (const k of keys) {
        if (sceneNodes[k]) setFolderVisible(sceneNodes[k], false);
    }
}

// Resolve each catalog entry's folder and initialize its game container
for (const entry of GAME_CATALOG) {
    for (const candidateName of entry.folderCandidates) {
        if (sceneNodes[candidateName]) {
            entry.folderNode = sceneNodes[candidateName];
            break;
        }
    }
    setFolderVisible(entry.folderNode, false);

    if (entry.game) {
        const targetContainer = entry.folderNode?.element || placementInnerGroup;
        entry.game.init(targetContainer);
        entry.game.container.visible = false;
    }
}

// Bind custom 3D nodes for Game 1 (Simon Lanterns)
const lanternNode = sceneNodes['lantern.glb']
                 || sceneNodes.lantern_glb
                 || sceneNodes.lantern
                 || sceneNodes.Lantern;

const goalNode = sceneNodes.gem
              || sceneNodes.Gem
              || sceneNodes['gem.glb']
              || sceneNodes.orb
              || sceneNodes['orb.glb'];

simonGame.bindCustomSceneNodes({
    lanternTemplate: lanternNode,
    game2Folder: GAME_CATALOG[0].folderNode,
    goalItem: goalNode
});

// Ensure all folders stay hidden until the player picks a game from the dropdown!
for (const entry of GAME_CATALOG) {
    setFolderVisible(entry.folderNode, false);
    if (entry.game) entry.game.container.visible = false;
}

const findCatalogEntry = (num: number): GameCatalogEntry | undefined => {
    for (let i = 0; i < GAME_CATALOG.length; i++) {
        if (GAME_CATALOG[i].gameNumber === num) return GAME_CATALOG[i];
    }
    return undefined;
};

// 6. Switch active game when selected from the 10-game HUD Dropdown
hud.onGameSelected = (gameNumber: number) => {
    soundManager.stopAllLoops();

    const selectedEntry = findCatalogEntry(gameNumber);
    if (!selectedEntry || !selectedEntry.game) {
        hud.notify(`🚧 Game ${gameNumber} is coming soon!`, 'info');
        return;
    }

    // Enter floor placement mode so player can place the newly selected game with ✓
    if (placementAnchorNode?.placementMode && !placementAnchorNode.placementMode.value) {
        placementAnchorNode.placementMode.value = true;
    }

    // Turn OFF all other game folders & containers (including legacy Maze)
    setFolderVisible(legacyMazeNode, false);
    for (const entry of GAME_CATALOG) {
        if (entry.gameNumber !== gameNumber) {
            setFolderVisible(entry.folderNode, false);
            if (entry.game) entry.game.container.visible = false;
        }
    }

    // Turn ON only the selected game's folder & start it
    setFolderVisible(selectedEntry.folderNode, true);
    selectedEntry.game.container.visible = true;
    gameManager.setActiveGame(selectedEntry.game.id);
    selectedEntry.game.start();
    hud.setRestartVisible(selectedEntry.game.canRestart());
};

// 6.5 Sync placement state with UserPlacementAnchorGroup
let hasPlacementAnchor = false;
for (const key of Object.keys(sceneNodes)) {
    const node = sceneNodes[key];
    if (node && (node.onPlacing || node.onNotPlacing || (node.placementMode && node.placementMode.value !== undefined))) {
        hasPlacementAnchor = true;
        if (node.onPlacing && typeof node.onPlacing.addListener === 'function') {
            node.onPlacing.addListener(() => {
                forEachPlayableGame((g) => g.setPlaced(false));
                hud.setPlaced(false);
            });
        }
        if (node.onNotPlacing && typeof node.onNotPlacing.addListener === 'function') {
            node.onNotPlacing.addListener(() => {
                forEachPlayableGame((g) => g.setPlaced(true));
                hud.setPlaced(true);
            });
        }
        if (node.placementMode && typeof node.placementMode.addListener === 'function') {
            node.placementMode.addListener((isPlacing: boolean) => {
                forEachPlayableGame((g) => g.setPlaced(!isPlacing));
                hud.setPlaced(!isPlacing);
            });
            const initialPlaced = !node.placementMode.value;
            forEachPlayableGame((g) => g.setPlaced(initialPlaced));
            hud.setPlaced(initialPlaced);
        }
        break;
    }
}

// 7. Main Render Loop
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
