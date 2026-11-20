import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';
import { CollectibleItem, CollectibleConfig } from './CollectibleItem';
import { soundManager } from '../utils/SoundManager';

export type MemoryGamePhase =
    | 'WAITING_TO_START'
    | 'SHOWING_MEMORY_CUE'
    | 'PLAYER_MEMORY_INPUT'
    | 'ROUND_TRANSITION'
    | 'FAILED_PENALTY'
    | 'REWARD_READY'
    | 'WON';

/**
 * BaseMemoryGame
 * 
 * Abstract base class for all Column 1 (MEMORY) mini-games:
 * - Game 1: Simon Lanterns (`SimonGame`)
 * - Game 4: Glass Bridge (`GlassBridgeGame`)
 * - Game 7: Cooking Recipe (`CookingGame`)
 * 
 * Centralizes:
 * - Memory sequence generation (`memorySequence`: 1D array of correct choices per step/row)
 * - Step validation (`validateMemoryStep(stepIndex, chosenOption)`)
 * - 6-DOF AR camera tracking (`getPlayerLocalPosition()`)
 * - Placement & HUD Restart button availability lifecycle (`setPlaced`, `canRestart`, `syncRestartAvailability`)
 * - Reward Gem creation, visibility, tap/proximity pickup, and audio/haptic feedback
 */
export abstract class BaseMemoryGame extends BaseMiniGame {
    // #region SHARED MEMORY SEQUENCE STATE
    protected phase: MemoryGamePhase = 'WAITING_TO_START';
    protected memorySequence: number[] = [];
    protected currentStepIndex: number = 0;
    protected isTrialWon: boolean = false;
    // #endregion

    // #region AR PLACEMENT, CAMERA & RESTART LIFECYCLE
    public isPlaced: boolean = false;
    public onRestartAvailabilityChanged?: (canRestart: boolean) => void;
    private lastCanRestartState: boolean = false;

    protected camera: THREE.Camera | null = null;
    protected tempWorldPos: THREE.Vector3 = new THREE.Vector3();
    protected tempLocalPos: THREE.Vector3 = new THREE.Vector3();
    // #endregion

    // #region SHARED REWARD GEM COMPONENT
    public collectible: CollectibleItem;
    protected gemWrapper: THREE.Group = new THREE.Group();
    // #endregion

    constructor(
        id: string,
        name: string,
        rewardItemId: string,
        rewardItemName: string,
        collectibleConfig?: CollectibleConfig
    ) {
        super(id, name, rewardItemId);

        this.collectible = new CollectibleItem(rewardItemId, rewardItemName, {
            pickupRadius: 1.2,
            spinSpeedY: 1.8,
            spinSpeedX: 0,
            enableFloating: true,
            floatAmplitude: 0.08,
            ...collectibleConfig
        });
    }

    // #region CORE MEMORY ENGINE (SEQUENCE GENERATION & VALIDATION)
    /**
     * Generates or extends the memory sequence of integers in `[0 .. numOptions - 1]`.
     * - For Simon: `numOptions = 4` (4 lamp colors), `appendOnly = true` (adds 1 new step each round).
     * - For Glass Bridge: `numOptions = 2` (Left=0, Right=1), `length = 6` (6 rows), `appendOnly = false`.
     */
    protected generateMemorySequence(length: number, numOptions: number, appendOnly: boolean = false): number[] {
        if (!appendOnly) {
            this.memorySequence = [];
        }
        while (this.memorySequence.length < length) {
            const nextChoice = Math.floor(Math.random() * numOptions);
            this.memorySequence.push(nextChoice);
        }
        return this.memorySequence;
    }

    /**
     * Checks whether the player's chosen option at `stepIndex` matches the memorized sequence.
     */
    protected validateMemoryStep(stepIndex: number, chosenOption: number): boolean {
        if (stepIndex < 0 || stepIndex >= this.memorySequence.length) {
            return false;
        }
        return this.memorySequence[stepIndex] === chosenOption;
    }

    /**
     * Standard audio + haptic feedback when a memory reveal/round starts.
     */
    protected triggerMemoryStartFeedback(): void {
        if (this.isPlaced && this.container.visible) {
            soundManager.playLevelStart();
        }
    }

    /**
     * Standard audio + haptic feedback when the player makes a correct memory choice.
     */
    protected triggerCorrectStepFeedback(toneIndex: number): void {
        soundManager.playSimonTone(toneIndex % 4, false);
        this.vibrate(45);
    }

    /**
     * Standard audio + haptic feedback when the player makes a wrong memory choice.
     */
    protected triggerWrongStepFeedback(): void {
        soundManager.stopOrbLoop();
        soundManager.playWallCollision();
        this.vibrate([220, 80, 220]);
    }

    protected vibrate(pattern: number | number[]): void {
        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            try { (navigator as any).vibrate(pattern); } catch (e) {}
        }
    }
    // #endregion

    // #region SHARED CAMERA & PLACEMENT HELPERS
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Converts the 6-DOF AR camera's world position into `this.container` local coordinates.
     */
    protected updatePlayerLocalPosFromCamera(outPos?: THREE.Vector3): THREE.Vector3 {
        if (this.camera) {
            this.container.updateMatrixWorld(true);
            this.camera.getWorldPosition(this.tempWorldPos);
            this.tempLocalPos.copy(this.tempWorldPos);
            this.container.worldToLocal(this.tempLocalPos);
        }
        if (outPos) {
            outPos.copy(this.tempLocalPos);
            return outPos;
        }
        return this.tempLocalPos;
    }

    public abstract canRestart(): boolean;
    public abstract restartTrial(): void;
    public abstract setPlaced(placed: boolean): void;

    protected syncRestartAvailability(force: boolean = false): void {
        const current = this.canRestart();
        if (force || current !== this.lastCanRestartState) {
            this.lastCanRestartState = current;
            this.onRestartAvailabilityChanged?.(current);
        }
    }
    // #endregion

    // #region SHARED REWARD GEM BUILDER & PICKUP
    /**
     * Creates the golden 3D Collectible Gem at `localPosition` inside `this.container`.
     */
    protected buildRewardGemNode(localPosition: THREE.Vector3, initiallyVisible: boolean = false): void {
        this.gemWrapper.name = `${this.id}_RewardGem`;
        this.gemWrapper.position.copy(localPosition);
        this.gemWrapper.visible = initiallyVisible;

        const geo = new THREE.IcosahedronGeometry(0.21, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffc800,
            emissive: 0xb45309,
            emissiveIntensity: 0.38,
            roughness: 0.15,
            metalness: 0.6
        });
        const gemMesh = new THREE.Mesh(geo, mat);
        this.gemWrapper.add(gemMesh);
        this.container.add(this.gemWrapper);

        this.collectible.bindModel(this.gemWrapper);
        this.gemWrapper.visible = initiallyVisible;
    }

    /**
     * Shared win handler for all Memory column games.
     */
    public override onWin(): void {
        if (this.isTrialWon) return;
        this.isTrialWon = true;
        this.phase = 'WON';

        soundManager.stopOrbLoop();
        soundManager.playLevelFinish();
        this.vibrate([140, 70, 180]);

        super.onWin();
        this.isActive = true; // Keep active so restart/tracking continues cleanly
        this.syncRestartAvailability(true);
    }
    // #endregion
}
