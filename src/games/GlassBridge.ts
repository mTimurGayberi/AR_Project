import * as THREE from 'three';
import { BaseMemoryGame } from '../core/BaseMemoryGame';
import { StartZone } from '../core/StartZone';
import { soundManager } from '../utils/SoundManager';

export interface GlassBridgeConfig {
    rows?: number;              // Default: 6 rows
    cols?: number;              // Default: 2 columns (Left / Right)
    revealDuration?: number;    // Seconds safe tiles are shown at start (default: 3.0s)
    tileSize?: number;          // Width & depth of each glass tile in meters (default: 0.68m)
    colSpacing?: number;        // Center-to-center X distance between Left & Right tiles (default: 1.15m)
    rowSpacing?: number;        // Center-to-center Z distance between rows (default: 1.10m)
    stepTriggerRadius?: number; // Radius from tile center that triggers a step (default: 0.38m — never overlaps!)
}

interface GlassTileEntry {
    row: number;
    col: number;
    isSafe: boolean;
    isStepped: boolean;
    isBroken: boolean;
    centerLocalPos: THREE.Vector3;
    group: THREE.Group;
    glassMesh: THREE.Mesh;
    glassMat: THREE.MeshStandardMaterial;
    rimMat: THREE.MeshBasicMaterial;
}

/**
 * GlassBridgeGame
 * 
 * Column 1 (MEMORY) — Game #4: Glass Bridge Trial.
 * Inherits shared memory sequence generation, validation, camera tracking,
 * and reward gem management from `BaseMemoryGame`.
 */
export class GlassBridgeGame extends BaseMemoryGame {
    // #region CONFIGURATION & BRIDGE DIMENSIONS
    public rows: number = 6;
    public cols: number = 2;
    public revealDuration: number = 3.0;     // 3 seconds to memorize the safe path
    public tileSize: number = 0.68;          // 0.68m x 0.68m glass square
    public colSpacing: number = 1.15;        // 1.15m center-to-center X (0.47m empty gap between Left & Right)
    public rowSpacing: number = 1.10;        // 1.10m center-to-center Z (0.42m empty gap between rows)
    public stepTriggerRadius: number = 0.38; // < half of tileSize so two tiles can NEVER overlap
    // #endregion

    // #region 3D OBJECTS & STATE
    public startZone: StartZone;
    private bridgeGroup: THREE.Group = new THREE.Group();
    private tiles: GlassTileEntry[] = [];

    private playerMesh!: THREE.Mesh;
    private playerMaterial!: THREE.MeshStandardMaterial;

    private revealTimer: number = 0;
    private lastRevealCountdownText: string = '';
    private returnNotifyTimer: number = 0;
    // #endregion

    private readonly colors = {
        neutralGlass: 0x38bdf8,   // Translucent icy cyan glass (all tiles look identical!)
        neutralRim:   0x7dd3fc,
        safeGlass:    0x10b981,   // Glowing Emerald Green (during 3s reveal & safe step)
        safeRim:      0x34d399,
        brokenGlass:  0xef4444,   // Shattered Crimson Red (on wrong tile step)
        brokenRim:    0xf87171,
        playerNormal: 0x00d2ff,
        playerFail:   0xff2222
    };

    constructor(config?: GlassBridgeConfig) {
        super('game_04_bridge', 'Glass Bridge Trial', 'item_04_bridge_gem', 'Bridge Gem', {
            pickupRadius: 0.95
        });

        if (config?.rows !== undefined) this.rows = config.rows;
        if (config?.cols !== undefined) this.cols = config.cols;
        if (config?.revealDuration !== undefined) this.revealDuration = config.revealDuration;
        if (config?.tileSize !== undefined) this.tileSize = config.tileSize;
        if (config?.colSpacing !== undefined) this.colSpacing = config.colSpacing;
        if (config?.rowSpacing !== undefined) this.rowSpacing = config.rowSpacing;
        if (config?.stepTriggerRadius !== undefined) this.stepTriggerRadius = config.stepTriggerRadius;

        this.startZone = new StartZone({
            triggerRadius: 0.85,
            padRadius: 0.80,
            padColor: 0x00ff88,
            padOpacity: 0.38
        });
    }

    // #region INITIALIZATION & 3D GLASS BRIDGE BUILDER
    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.createPlayerAvatar();

        // 1. Place StartZone at (0, 0, 0) at the entrance of the bridge
        this.startZone.centerPosition.set(0, 0, 0);
        this.startZone.bindNodes(this.container, {});

        // 2. Build the 6x2 = 12 Glass Tiles extending forward (-Z) from the StartZone
        this.buildGlassBridgeTiles();

        // 3. Place the Golden Gem at the far end of the bridge (past Row 5), initially visible!
        const firstRowZ = -1.35;
        const lastRowZ = firstRowZ - (this.rows - 1) * this.rowSpacing;
        this.buildRewardGemNode(new THREE.Vector3(0, 0.75, lastRowZ - 1.15), true);

        const targetParent = parentContainer?.element || parentContainer;
        if (targetParent && typeof targetParent.add === 'function') {
            targetParent.add(this.container);
        }

        console.log('[GlassBridgeGame] Initialized 6x2 (12-tile) Glass Bridge (extends BaseMemoryGame).');
    }

    private addLighting(): void {
        const ambient = new THREE.AmbientLight(0xffffff, 1.4);
        this.container.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(3, 8, 4);
        this.container.add(dirLight);
    }

    private createPlayerAvatar(): void {
        const radius = 0.24;
        const geo = new THREE.CylinderGeometry(radius, radius, 0.08, 24);
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.playerNormal,
            emissive: this.colors.playerNormal,
            emissiveIntensity: 0.6
        });
        this.playerMesh = new THREE.Mesh(geo, this.playerMaterial);
        this.playerMesh.position.set(0, 0.04, 0);
        this.playerMesh.visible = false;
        this.container.add(this.playerMesh);
    }

    private buildGlassBridgeTiles(): void {
        this.bridgeGroup.name = 'GlassBridgeTilesGroup';
        this.container.add(this.bridgeGroup);
        this.tiles = [];

        const firstRowZ = -1.35;
        const tileGeo = new THREE.BoxGeometry(this.tileSize, 0.04, this.tileSize);
        const edgesGeo = new THREE.EdgesGeometry(tileGeo);

        for (let r = 0; r < this.rows; r++) {
            const rowZ = firstRowZ - r * this.rowSpacing;

            for (let c = 0; c < this.cols; c++) {
                const colX = (c - (this.cols - 1) * 0.5) * this.colSpacing;

                const tileGroup = new THREE.Group();
                tileGroup.name = `GlassTile_R${r}_C${c}`;
                tileGroup.position.set(colX, 0.03, rowZ);

                const glassMat = new THREE.MeshStandardMaterial({
                    color: this.colors.neutralGlass,
                    emissive: this.colors.neutralGlass,
                    emissiveIntensity: 0.22,
                    transparent: true,
                    opacity: 0.48,
                    roughness: 0.15,
                    metalness: 0.2,
                    side: THREE.DoubleSide
                });

                const glassMesh = new THREE.Mesh(tileGeo, glassMat);
                tileGroup.add(glassMesh);

                const rimMat = new THREE.MeshBasicMaterial({
                    color: this.colors.neutralRim
                });
                const rimLines = new THREE.LineSegments(edgesGeo, rimMat);
                tileGroup.add(rimLines);

                this.bridgeGroup.add(tileGroup);

                this.tiles.push({
                    row: r,
                    col: c,
                    isSafe: false,
                    isStepped: false,
                    isBroken: false,
                    centerLocalPos: new THREE.Vector3(colX, 0.03, rowZ),
                    group: tileGroup,
                    glassMesh,
                    glassMat,
                    rimMat
                });
            }
        }
    }
    // #endregion

    // #region SHARED MEMORY SEQUENCE -> TILE BINDING
    /**
     * Uses `BaseMemoryGame.generateMemorySequence(rows, cols, false)` to generate
     * the safe column (0 or 1) for each row, and syncs the 12 tile states.
     */
    private randomizeSafePath(): void {
        this.generateMemorySequence(this.rows, this.cols, false);

        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            tile.isSafe = this.validateMemoryStep(tile.row, tile.col);
            tile.isStepped = false;
            tile.isBroken = false;
            tile.group.position.copy(tile.centerLocalPos);
            tile.group.rotation.set(0, 0, 0);
        }
    }

    private applyAllTilesVisualMode(mode: 'NEUTRAL' | 'REVEAL'): void {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            if (mode === 'REVEAL') {
                if (tile.isSafe) {
                    this.setTileStyle(tile, this.colors.safeGlass, this.colors.safeRim, 0.85, 0.9);
                } else {
                    this.setTileStyle(tile, 0x1e293b, 0x475569, 0.20, 0.05);
                }
            } else {
                this.setTileStyle(tile, this.colors.neutralGlass, this.colors.neutralRim, 0.48, 0.22);
            }
        }
    }

    private setTileStyle(
        tile: GlassTileEntry,
        glassHex: number,
        rimHex: number,
        opacity: number,
        emissiveIntensity: number
    ): void {
        tile.glassMat.color.setHex(glassHex);
        tile.glassMat.emissive.setHex(glassHex);
        tile.glassMat.emissiveIntensity = emissiveIntensity;
        tile.glassMat.opacity = opacity;
        tile.glassMat.needsUpdate = true;

        tile.rimMat.color.setHex(rimHex);
        tile.rimMat.needsUpdate = true;
    }
    // #endregion

    // #region LIFECYCLE & PLACEMENT
    public override canRestart(): boolean {
        if (!this.isPlaced) return false;
        if (this.isTrialWon || this.isCompleted) return true;
        return this.phase !== 'WAITING_TO_START';
    }

    public override setPlaced(placed: boolean): void {
        this.isPlaced = placed;
        if (this.playerMesh) {
            this.playerMesh.visible = placed;
        }
        if (placed && this.isActive && this.container.visible) {
            this.prepareWaitingAtStart();
        } else {
            this.stopTimer();
            soundManager.stopOrbLoop();
            this.phase = 'WAITING_TO_START';
            this.startZone.setVisible(true);
            this.syncRestartAvailability(true);
        }
    }

    public override start(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.prepareWaitingAtStart();
    }

    public override reset(): void {
        this.restartTrial();
    }

    private prepareWaitingAtStart(): void {
        this.phase = 'WAITING_TO_START';
        this.isTrialWon = false;
        this.isCompleted = false;
        this.currentStepIndex = 0; // Must start at Row index 0!
        this.resetTimer();
        this.stopTimer();
        soundManager.stopOrbLoop();

        this.collectible.reset();
        this.gemWrapper.visible = true;

        this.randomizeSafePath();
        this.applyAllTilesVisualMode('NEUTRAL');
        this.startZone.setVisible(true);
        this.setPlayerVisualState('normal');
        this.syncRestartAvailability(true);

        if (this.isPlaced && this.container.visible) {
            this.notify('🚩 Walk into the green Start Area to reveal the safe Glass Bridge path for 3s!', 'info');
        }
    }

    public override restartTrial(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.resetTimer();
        this.stopTimer();

        const localPos = this.updatePlayerLocalPosFromCamera();
        this.playerMesh.position.set(localPos.x, 0.04, localPos.z);

        const check = this.startZone.checkPlayer(this.playerMesh.position);
        if (check.isInside) {
            this.beginThreeSecondReveal();
        } else {
            this.prepareWaitingAtStart();
        }
    }

    private beginThreeSecondReveal(): void {
        this.randomizeSafePath();
        this.currentStepIndex = 0; // Next required row is strictly Row 0!
        this.collectible.reset();
        this.gemWrapper.visible = true;

        this.startZone.setVisible(false);
        this.setPlayerVisualState('normal');
        this.applyAllTilesVisualMode('REVEAL');

        this.phase = 'SHOWING_MEMORY_CUE';
        this.revealTimer = this.revealDuration;
        this.lastRevealCountdownText = '';
        this.resetTimer();
        this.stopTimer();

        this.triggerMemoryStartFeedback();
        this.syncRestartAvailability(true);
        this.notify(`👀 Memorize the glowing green tiles! Hiding in ${this.revealDuration.toFixed(0)}s...`, 'info');
    }
    // #endregion

    // #region MAIN GAME LOOP
    protected onUpdate(deltaTime: number): void {
        if (!this.isPlaced) return;

        // 1. Track Player Position from 6-DOF AR Camera (via BaseMemoryGame)
        const localPos = this.updatePlayerLocalPosFromCamera();
        this.playerMesh.position.set(localPos.x, 0.04, localPos.z);

        if (this.gemWrapper.visible && !this.isTrialWon) {
            this.collectible.animate(deltaTime);
        }

        if (this.phase === 'WON') return;

        const startCheck = this.startZone.checkPlayer(this.playerMesh.position);

        if (this.phase === 'WAITING_TO_START') {
            if (startCheck.isInside) {
                this.beginThreeSecondReveal();
            }
            return;
        }

        if (this.phase === 'FAILED_PENALTY') {
            this.returnNotifyTimer += deltaTime;
            if (this.returnNotifyTimer >= 0.6) {
                this.returnNotifyTimer = 0;
                this.notify(
                    `💥 Wrong Tile! Gem vanished! Walk back to green Start Area (${startCheck.distance.toFixed(1)}m)`,
                    'error'
                );
            }

            if (startCheck.isInside) {
                this.beginThreeSecondReveal();
            }
            return;
        }

        if (this.phase === 'SHOWING_MEMORY_CUE') {
            this.revealTimer -= deltaTime;
            const secsLeft = Math.ceil(Math.max(0, this.revealTimer)).toString();
            if (secsLeft !== this.lastRevealCountdownText && this.revealTimer > 0) {
                this.lastRevealCountdownText = secsLeft;
                this.notify(`👀 Memorize the green path! Tiles hide in ${secsLeft}s...`, 'info');
            }

            if (this.revealTimer <= 0) {
                this.applyAllTilesVisualMode('NEUTRAL');
                this.phase = 'PLAYER_MEMORY_INPUT';
                this.resetTimer();
                this.startTimer();
                this.vibrate(100);
                this.notify('🌉 GO! Step only on the safe glass tiles to reach the Gem!', 'success');
            }
            return;
        }

        if (this.phase === 'PLAYER_MEMORY_INPUT') {
            for (let i = 0; i < this.tiles.length; i++) {
                const tile = this.tiles[i];
                const dx = this.playerMesh.position.x - tile.centerLocalPos.x;
                const dz = this.playerMesh.position.z - tile.centerLocalPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist <= this.stepTriggerRadius) {
                    // 1. Check if player skipped a row (e.g. jumped from start or row 0 directly to row 2, 3, 4...)
                    if (tile.row > this.currentStepIndex) {
                        this.handleWrongTileStep(
                            tile,
                            `💥 SKIPPED ROW ${this.currentStepIndex + 1}! You must step on rows in order (1 → ${this.rows}). Walk back to Start Area!`
                        );
                        return;
                    }

                    // 2. If stepping on a previous or current row, check if the tile itself is safe
                    if (!this.validateMemoryStep(tile.row, tile.col)) {
                        this.handleWrongTileStep(
                            tile,
                            '💥 GLASS SHATTERED! Gem vanished! Walk back to the green Start Area to retry.'
                        );
                        return;
                    }

                    // 3. Safe tile on the exact expected row (`tile.row === this.currentStepIndex`)
                    if (tile.row === this.currentStepIndex && !tile.isStepped) {
                        tile.isStepped = true;
                        this.currentStepIndex++; // Advance required row index (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6)
                        this.setTileStyle(tile, this.colors.safeGlass, this.colors.safeRim, 0.85, 0.9);
                        this.triggerCorrectStepFeedback(tile.row);

                        if (this.currentStepIndex >= this.rows) {
                            this.notify(`🌟 All ${this.rows} Rows Cleared! Step forward to claim the Bridge Gem!`, 'success');
                        } else {
                            this.notify(`✅ Safe Tile! (Row ${tile.row + 1}/${this.rows} Complete)`, 'success');
                        }
                    }
                }
            }

            // 4. Prevent walking around the bridge: if player bypassed the current required row's Z line without stepping on it, fail!
            if (this.currentStepIndex < this.rows) {
                const firstRowZ = -1.35;
                const requiredRowZ = firstRowZ - this.currentStepIndex * this.rowSpacing;
                // Bridge extends in -Z direction; if player walked more than 0.62m past requiredRowZ without stepping on it:
                if (this.playerMesh.position.z < requiredRowZ - 0.62) {
                    this.handleBypassBridgeFailure(this.currentStepIndex);
                    return;
                }
            }

            // 5. Gem is ONLY collectible after EVERY row (0 .. rows - 1) has been stepped on in order!
            if (this.gemWrapper.visible && this.currentStepIndex >= this.rows) {
                const collected = this.collectible.update(deltaTime, this.playerMesh.position, this.playerMesh);
                if (collected) {
                    this.onWin();
                }
            }
        }
    }

    private handleWrongTileStep(tile: GlassTileEntry, message: string): void {
        tile.isBroken = true;
        this.setTileStyle(tile, this.colors.brokenGlass, this.colors.brokenRim, 0.9, 1.1);

        tile.group.position.y = -0.18;
        tile.group.rotation.x = 0.35;
        tile.group.rotation.z = tile.col === 0 ? -0.25 : 0.25;

        this.gemWrapper.visible = false;
        this.triggerWrongStepFeedback();

        this.stopTimer();
        this.phase = 'FAILED_PENALTY';
        this.returnNotifyTimer = 0;
        this.startZone.setVisible(true);
        this.setPlayerVisualState('fail');
        this.syncRestartAvailability(true);

        this.notify(message, 'error');
    }

    private handleBypassBridgeFailure(missedRowIndex: number): void {
        this.gemWrapper.visible = false;
        this.triggerWrongStepFeedback();

        this.stopTimer();
        this.phase = 'FAILED_PENALTY';
        this.returnNotifyTimer = 0;
        this.startZone.setVisible(true);
        this.setPlayerVisualState('fail');
        this.syncRestartAvailability(true);

        this.notify(
            `💥 Missed Row ${missedRowIndex + 1}/${this.rows}! You cannot walk around the bridge. Return to Start Area!`,
            'error'
        );
    }

    public override onWin(): void {
        super.onWin();
        this.notify('🎉 VICTORY! You crossed the Glass Bridge and claimed the Bridge Gem!', 'success');
    }

    private setPlayerVisualState(state: 'normal' | 'fail'): void {
        if (!this.playerMaterial) return;
        const hex = state === 'fail' ? this.colors.playerFail : this.colors.playerNormal;
        this.playerMaterial.color.setHex(hex);
        this.playerMaterial.emissive.setHex(hex);
        this.playerMaterial.emissiveIntensity = state === 'fail' ? 0.9 : 0.6;
    }
    // #endregion
}
