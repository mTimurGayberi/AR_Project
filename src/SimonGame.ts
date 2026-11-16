import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';
import { CollectibleItem } from './core/CollectibleItem';
import { soundManager } from './SoundManager';

export interface SimonConfig {
    totalRounds?: number;            // Number of rounds to win (default: 3)
    startingSequenceLength?: number; // Sequence length in Round 1 (default: 3 -> 4 -> 5)
    flashDuration?: number;          // Seconds a button stays lit during sequence playback
    flashGap?: number;               // Seconds between flashes in sequence playback
    panelDistanceZ?: number;         // Distance in front of anchor in meters (default: -1.6m)
    panelHeightY?: number;           // Center height of the 4-button console in meters (default: 1.15m)
}

type SimonPhase = 'WAITING_FOR_PLACEMENT' | 'ShowingSequence' | 'PlayerTurn' | 'RoundTransition' | 'RewardReady' | 'Won';

interface SimonButtonEntry {
    index: number;
    name: string;
    baseColor: number;
    glowColor: number;
    mesh: THREE.Object3D;
    materials: THREE.MeshStandardMaterial[];
    baseLocalZ: number;
    pressOffset: number;
    flashTimer: number;
}

/**
 * SimonGame
 * 
 * Game #2 in the 10 mini-game quest.
 * Features:
 * - 4 glowing 3D buttons in front of the player (procedural 3D console + custom .glb binding).
 * - Direct touch-screen raycasting: tap the 3D buttons directly on your phone screen!
 * - Classic multi-round Simon memory sequence (Round 1 -> Round 2 -> Round 3).
 * - Unlocks Collectible Gem #2 ('item_02_memory_gem') on completion (collect by walking close or tapping the gem).
 */
export class SimonGame extends BaseMiniGame {
    // #region CONFIGURATION & SIMON CONTROLS
    // =========================================================================
    // Easily tweak round count, speed, and 3D button layout in AR!
    // =========================================================================
    public totalRounds: number = 3;
    public startingSequenceLength: number = 3; // Round 1 = 3, Round 2 = 4, Round 3 = 5
    public flashDuration: number = 0.52;
    public flashGap: number = 0.24;
    public panelDistanceZ: number = -1.6;      // 1.6m in front of player
    public panelHeightY: number = 1.15;        // Chest/eye level height in meters
    public buttonSpacing: number = 0.34;       // Spacing between the 4 buttons
    // #endregion

    // #region MODULAR COMPONENTS & 3D OBJECTS
    public collectible: CollectibleItem;
    private camera: THREE.Camera | null = null;
    private consoleGroup: THREE.Group = new THREE.Group();
    private buttons: SimonButtonEntry[] = [];
    private raycastTargets: THREE.Object3D[] = [];
    private gemWrapper: THREE.Group = new THREE.Group();

    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();
    private tempWorldPos: THREE.Vector3 = new THREE.Vector3();
    private tempLocalPos: THREE.Vector3 = new THREE.Vector3();
    // #endregion

    // #region GAME STATE
    public isPlaced: boolean = false;
    public onRestartAvailabilityChanged?: (canRestart: boolean) => void;
    private lastCanRestartState: boolean = false;

    private phase: SimonPhase = 'WAITING_FOR_PLACEMENT';
    private currentRound: number = 1;
    private sequence: number[] = [];
    private playbackIndex: number = 0;
    private playerStepIndex: number = 0;
    private phaseTimer: number = 0;
    private isCurrentlyLit: boolean = false;
    private activeLitButton: number = -1;
    private hasStartedAnyRound: boolean = false;
    private isTrialWon: boolean = false;
    // #endregion

    private readonly buttonDefs = [
        { name: 'Red',    baseColor: 0x991b1b, glowColor: 0xff3b3b, offsetX: -1, offsetY:  1 },
        { name: 'Blue',   baseColor: 0x075985, glowColor: 0x38bdf8, offsetX:  1, offsetY:  1 },
        { name: 'Green',  baseColor: 0x065f46, glowColor: 0x10b981, offsetX: -1, offsetY: -1 },
        { name: 'Yellow', baseColor: 0x92400e, glowColor: 0xfbbf24, offsetX:  1, offsetY: -1 },
    ];

    constructor(config?: SimonConfig) {
        super('game_02_simon', 'Sensei Simon Trial', 'item_02_memory_gem');

        if (config?.totalRounds !== undefined) this.totalRounds = config.totalRounds;
        if (config?.startingSequenceLength !== undefined) this.startingSequenceLength = config.startingSequenceLength;
        if (config?.flashDuration !== undefined) this.flashDuration = config.flashDuration;
        if (config?.flashGap !== undefined) this.flashGap = config.flashGap;
        if (config?.panelDistanceZ !== undefined) this.panelDistanceZ = config.panelDistanceZ;
        if (config?.panelHeightY !== undefined) this.panelHeightY = config.panelHeightY;

        this.collectible = new CollectibleItem('item_02_memory_gem', 'Memory Gem', {
            pickupRadius: 1.35,
            spinSpeedY: 1.8,
            spinSpeedX: 0,
            enableFloating: true,
            floatAmplitude: 0.08
        });
    }

    // #region INITIALIZATION & 3D CONSOLE BUILDER
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.buildProceduralConsole();
        this.buildFallbackRewardGem();
        this.setupTouchAndKeyListeners();

        const targetParent = parentContainer?.element || parentContainer;
        if (targetParent && typeof targetParent.add === 'function') {
            targetParent.add(this.container);
        }

        console.log('[SimonGame] Initialized 4-Button AR Simon Console.');
    }

    private addLighting(): void {
        const ambient = new THREE.AmbientLight(0xffffff, 1.4);
        this.container.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(2, 5, 3);
        this.container.add(keyLight);
    }

    /**
     * Builds the 4 glowing 3D buttons on a sleek floating stand in front of the player.
     */
    private buildProceduralConsole(): void {
        this.consoleGroup.name = 'SimonConsoleGroup';
        this.consoleGroup.position.set(0, this.panelHeightY, this.panelDistanceZ);
        this.consoleGroup.rotation.x = -0.15; // Slight upward tilt toward the player's eyes
        this.container.add(this.consoleGroup);

        // 1. Sleek Dark Backing Board + Cyan Rim
        const boardGeo = new THREE.BoxGeometry(0.86, 0.86, 0.06);
        const boardMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.35,
            metalness: 0.5
        });
        const backingBoard = new THREE.Mesh(boardGeo, boardMat);
        backingBoard.position.set(0, 0, -0.04);
        this.consoleGroup.add(backingBoard);

        const rimGeo = new THREE.BoxGeometry(0.90, 0.90, 0.04);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.4,
            roughness: 0.3
        });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.position.set(0, 0, -0.055);
        this.consoleGroup.add(rimMesh);

        // 2. Create the 4 Interactive 3D Buttons (2x2 Grid)
        this.buttons = [];
        this.raycastTargets = [];

        const halfSpacing = this.buttonSpacing * 0.5;
        const btnGeo = new THREE.CylinderGeometry(0.13, 0.145, 0.08, 32);
        btnGeo.rotateX(Math.PI / 2); // Face cylinder cap directly toward the player (+Z)

        this.buttonDefs.forEach((def, idx) => {
            const mat = new THREE.MeshStandardMaterial({
                color: def.baseColor,
                emissive: def.baseColor,
                emissiveIntensity: 0.25,
                roughness: 0.25,
                metalness: 0.15
            });

            const btnMesh = new THREE.Mesh(btnGeo, mat);
            btnMesh.name = `SimonButton_${idx}_${def.name}`;
            btnMesh.position.set(def.offsetX * halfSpacing, def.offsetY * halfSpacing, 0.03);
            btnMesh.userData.simonButtonIndex = idx;

            this.consoleGroup.add(btnMesh);

            this.buttons.push({
                index: idx,
                name: def.name,
                baseColor: def.baseColor,
                glowColor: def.glowColor,
                mesh: btnMesh,
                materials: [mat],
                baseLocalZ: 0.03,
                pressOffset: 0,
                flashTimer: 0
            });

            this.raycastTargets.push(btnMesh);
        });
    }

    /**
     * Builds a golden 3D gem above the Simon console (or clones gem.glb if bound via bindCustomSceneNodes).
     */
    private buildFallbackRewardGem(): void {
        this.gemWrapper.name = 'SimonRewardGem';
        this.gemWrapper.position.set(0, this.panelHeightY + 0.68, this.panelDistanceZ);
        this.gemWrapper.visible = false;

        const geo = new THREE.IcosahedronGeometry(0.22, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffc800,
            emissive: 0xb45309,
            emissiveIntensity: 0.35,
            roughness: 0.15,
            metalness: 0.6
        });
        const fallbackMesh = new THREE.Mesh(geo, mat);
        this.gemWrapper.add(fallbackMesh);
        this.container.add(this.gemWrapper);

        this.collectible.bindModel(this.gemWrapper);
        this.gemWrapper.visible = false;
    }

    /**
     * Optional: Bind custom Blender .glb button meshes or clone the golden gem model from Mattercraft.
     */
    public bindCustomSceneNodes(nodes: {
        buttons?: (THREE.Object3D | any)[];
        goalItem?: THREE.Object3D | any;
    }): void {
        // If custom 3D button models are provided, bind them!
        if (nodes.buttons && nodes.buttons.length === 4) {
            this.raycastTargets = [];
            nodes.buttons.forEach((rawNode, idx) => {
                const obj: THREE.Object3D = rawNode?.element || rawNode;
                if (!obj) return;
                const mats: THREE.MeshStandardMaterial[] = [];
                obj.traverse((child: any) => {
                    if (child.isMesh) {
                        child.userData.simonButtonIndex = idx;
                        if (child.material) {
                            const clonedMat = child.material.clone();
                            child.material = clonedMat;
                            mats.push(clonedMat);
                        }
                    }
                });
                obj.userData.simonButtonIndex = idx;
                this.buttons[idx].mesh = obj;
                if (mats.length > 0) this.buttons[idx].materials = mats;
                this.buttons[idx].baseLocalZ = obj.position.z;
                this.raycastTargets.push(obj);
            });
        }
    }
    // #endregion

    // #region LIFECYCLE & PLACEMENT
    public canRestart(): boolean {
        if (!this.isPlaced) return false;
        return this.hasStartedAnyRound || this.isTrialWon || this.isCompleted;
    }

    private syncRestartAvailability(force: boolean = false): void {
        const current = this.canRestart();
        if (force || current !== this.lastCanRestartState) {
            this.lastCanRestartState = current;
            this.onRestartAvailabilityChanged?.(current);
        }
    }

    public setPlaced(placed: boolean): void {
        this.isPlaced = placed;

        if (!placed) {
            this.stopTimer();
            soundManager.stopOrbLoop();
            this.phase = 'WAITING_FOR_PLACEMENT';
            this.hasStartedAnyRound = false;
            this.gemWrapper.visible = false;
            this.resetAllButtonVisuals();
            this.syncRestartAvailability(true);
            return;
        }

        if (this.isActive && this.container.visible) {
            this.restartTrial();
        }
    }

    public override start(): void {
        this.isActive = true;
        this.container.visible = true;
        if (this.isPlaced) {
            this.restartTrial();
        } else {
            this.phase = 'WAITING_FOR_PLACEMENT';
            this.stopTimer();
            this.syncRestartAvailability(true);
        }
    }

    public override reset(): void {
        this.restartTrial();
    }

    /**
     * Starts or restarts the Simon Trial from Round 1.
     */
    public restartTrial(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.currentRound = 1;
        this.sequence = [];
        this.playbackIndex = 0;
        this.playerStepIndex = 0;
        this.hasStartedAnyRound = true;

        this.resetTimer();
        this.startTimer();

        soundManager.stopOrbLoop();
        if (this.isPlaced && this.container.visible) {
            soundManager.playLevelStart();
        }

        this.collectible.reset();
        this.gemWrapper.visible = false;
        this.resetAllButtonVisuals();

        this.generateSequenceForCurrentRound();
        this.phase = 'RoundTransition';
        this.phaseTimer = 1.0; // 1.0s preparation before Round 1 flashes

        this.syncRestartAvailability(true);
        this.notify(`🎛️ Simon Round 1/${this.totalRounds}: Watch the buttons flash!`, 'info');
    }
    // #endregion

    // #region SIMON SEQUENCE LOGIC & VISUALS
    private generateSequenceForCurrentRound(): void {
        const targetLength = this.startingSequenceLength + (this.currentRound - 1);
        // Keep previous sequence steps and append new ones (classic Simon progression!)
        while (this.sequence.length < targetLength) {
            const nextBtn = Math.floor(Math.random() * 4);
            this.sequence.push(nextBtn);
        }
    }

    private setButtonLit(index: number, lit: boolean, customColorHex?: number): void {
        const btn = this.buttons[index];
        if (!btn) return;

        const targetColor = customColorHex !== undefined ? customColorHex : (lit ? btn.glowColor : btn.baseColor);
        const intensity = lit ? 1.15 : 0.25;

        for (const mat of btn.materials) {
            mat.color.setHex(targetColor);
            if (mat.emissive) {
                mat.emissive.setHex(targetColor);
                mat.emissiveIntensity = intensity;
            }
        }

        btn.pressOffset = lit ? -0.025 : 0;
        btn.mesh.position.z = btn.baseLocalZ + btn.pressOffset;
        const scale = lit ? 1.08 : 1.0;
        btn.mesh.scale.set(scale, scale, 1.0);
    }

    private resetAllButtonVisuals(): void {
        this.isCurrentlyLit = false;
        this.activeLitButton = -1;
        for (let i = 0; i < this.buttons.length; i++) {
            this.buttons[i].flashTimer = 0;
            this.setButtonLit(i, false);
        }
    }

    private triggerPlayerButtonFlash(index: number, isError: boolean = false): void {
        const btn = this.buttons[index];
        if (!btn) return;
        this.setButtonLit(index, true, isError ? 0xff0000 : undefined);
        btn.flashTimer = isError ? 0.45 : 0.25;
    }
    // #endregion

    // #region DIRECT SCREEN TAP RAYCASTING
    private setupTouchAndKeyListeners(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('pointerdown', (e: PointerEvent) => {
            if (!this.isActive || !this.isPlaced || !this.container.visible) return;

            // Ignore taps on HUD buttons or Zapworks placement UI
            const targetEl = e.target as HTMLElement | null;
            if (targetEl && targetEl.closest && targetEl.closest('#game-hud, .zcomponent-zappar-three-place-ui-button, .splash')) {
                return;
            }

            if (!this.camera) return;

            // Convert screen tap coordinates to Normalized Device Coordinates (-1 to +1)
            this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.pointerNDC, this.camera);

            // 1. If Reward Gem is unlocked, allow tapping the 3D Gem directly to collect it!
            if (this.phase === 'RewardReady' && this.gemWrapper.visible) {
                const gemHits = this.raycaster.intersectObject(this.gemWrapper, true);
                if (gemHits.length > 0) {
                    this.collectible.collect();
                    this.onWin();
                    return;
                }
            }

            // 2. Check if player tapped one of the 4 3D Simon buttons on screen
            if (this.phase !== 'PlayerTurn') return;

            const hits = this.raycaster.intersectObjects(this.raycastTargets, true);
            if (hits.length > 0) {
                let hitObj: THREE.Object3D | null = hits[0].object;
                while (hitObj && hitObj.userData.simonButtonIndex === undefined) {
                    hitObj = hitObj.parent;
                }
                if (hitObj && typeof hitObj.userData.simonButtonIndex === 'number') {
                    this.handlePlayerButtonPress(hitObj.userData.simonButtonIndex);
                }
            }
        });

        // Desktop shortcut keys 1-4 for quick testing in browser preview
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.isActive || !this.isPlaced || this.phase !== 'PlayerTurn') return;
            if (e.key === '1') this.handlePlayerButtonPress(0);
            if (e.key === '2') this.handlePlayerButtonPress(1);
            if (e.key === '3') this.handlePlayerButtonPress(2);
            if (e.key === '4') this.handlePlayerButtonPress(3);
        });
    }

    private handlePlayerButtonPress(buttonIndex: number): void {
        if (this.phase !== 'PlayerTurn') return;

        const expectedIndex = this.sequence[this.playerStepIndex];

        if (buttonIndex === expectedIndex) {
            // Correct button pressed!
            this.triggerPlayerButtonFlash(buttonIndex, false);
            soundManager.playSimonTone(buttonIndex, false);
            if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                try { (navigator as any).vibrate(45); } catch (e) {}
            }

            this.playerStepIndex++;

            // Did player finish the entire sequence for this round?
            if (this.playerStepIndex >= this.sequence.length) {
                if (this.currentRound < this.totalRounds) {
                    this.currentRound++;
                    this.generateSequenceForCurrentRound();
                    this.phase = 'RoundTransition';
                    this.phaseTimer = 1.1;
                    this.notify(`✅ Round ${this.currentRound - 1}/${this.totalRounds} Cleared! Get ready for Round ${this.currentRound}...`, 'success');
                } else {
                    // All rounds beaten! Spawn Reward Gem #2!
                    this.phase = 'RewardReady';
                    this.gemWrapper.visible = true;
                    soundManager.startOrbLoop();
                    this.notify('🌟 Sequence Mastered! Walk up to or tap the golden Memory Gem to collect it!', 'success');
                    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                        try { (navigator as any).vibrate([120, 60, 160]); } catch (e) {}
                    }
                }
            }
        } else {
            // Wrong button pressed! Flash red and replay the current round's sequence
            this.triggerPlayerButtonFlash(buttonIndex, true);
            soundManager.playSimonTone(buttonIndex, true);
            if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                try { (navigator as any).vibrate([200, 80, 200]); } catch (e) {}
            }
            this.playerStepIndex = 0;
            this.phase = 'RoundTransition';
            this.phaseTimer = 1.4;
            this.notify(`❌ Wrong button! Watch Round ${this.currentRound}/${this.totalRounds} again...`, 'error');
        }
    }
    // #endregion

    // #region MAIN UPDATE LOOP
    protected onUpdate(deltaTime: number): void {
        if (!this.isPlaced) return;

        // Update short button tap flash timers
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            if (btn.flashTimer > 0) {
                btn.flashTimer -= deltaTime;
                if (btn.flashTimer <= 0) {
                    btn.flashTimer = 0;
                    this.setButtonLit(i, false);
                }
            }
        }

        // State machine for Simon rounds
        if (this.phase === 'RoundTransition') {
            this.phaseTimer -= deltaTime;
            if (this.phaseTimer <= 0) {
                this.phase = 'ShowingSequence';
                this.playbackIndex = 0;
                this.isCurrentlyLit = false;
                this.phaseTimer = 0.25;
            }
            return;
        }

        if (this.phase === 'ShowingSequence') {
            this.phaseTimer -= deltaTime;
            if (this.phaseTimer <= 0) {
                if (!this.isCurrentlyLit) {
                    // Turn ON next button in sequence
                    if (this.playbackIndex < this.sequence.length) {
                        const btnIdx = this.sequence[this.playbackIndex];
                        this.activeLitButton = btnIdx;
                        this.setButtonLit(btnIdx, true);
                        soundManager.playSimonTone(btnIdx, false);
                        this.isCurrentlyLit = true;
                        this.phaseTimer = this.flashDuration;
                    } else {
                        // Finished showing sequence -> Player's turn!
                        this.phase = 'PlayerTurn';
                        this.playerStepIndex = 0;
                        this.notify(`👆 Your Turn! Tap the ${this.sequence.length} buttons in order (Round ${this.currentRound}/${this.totalRounds})`, 'info');
                    }
                } else {
                    // Turn OFF currently lit button and wait gap before next flash
                    if (this.activeLitButton >= 0) {
                        this.setButtonLit(this.activeLitButton, false);
                        this.activeLitButton = -1;
                    }
                    this.isCurrentlyLit = false;
                    this.playbackIndex++;
                    this.phaseTimer = this.flashGap;
                }
            }
            return;
        }

        if (this.phase === 'RewardReady' && !this.isTrialWon) {
            if (this.camera) {
                this.camera.getWorldPosition(this.tempWorldPos);
                this.tempLocalPos.copy(this.tempWorldPos);
                this.container.worldToLocal(this.tempLocalPos);
            }
            const collected = this.collectible.update(deltaTime, this.tempLocalPos, this.camera);
            if (collected) {
                this.onWin();
            }
        }
    }

    public override onWin(): void {
        if (this.isTrialWon) return;
        this.isTrialWon = true;
        this.phase = 'Won';

        soundManager.stopOrbLoop();
        soundManager.playLevelFinish();

        super.onWin();
        this.isActive = true; // Keep active so restart works cleanly
        this.syncRestartAvailability(true);

        this.notify('🎉 VICTORY! You collected the Memory Gem! [Game 2 Complete]', 'success');
    }
    // #endregion
}
