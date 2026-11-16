import * as THREE from 'three';
import { soundManager } from '../SoundManager';

export interface CollectibleConfig {
    id?: string;
    name?: string;
    pickupRadius?: number;
    spinSpeedY?: number;
    spinSpeedX?: number;
    enableFloating?: boolean;
    floatAmplitude?: number;
    floatFrequency?: number;
}

/**
 * CollectibleItem
 * 
 * Reusable 3D collectible item system for all 10 mini-games (gems, scrolls, artifacts).
 * Handles model binding, continuous 3D spinning, subtle hover bobbing,
 * proximity collection detection, and trial reset.
 */
export class CollectibleItem {
    public readonly id: string;
    public readonly name: string;

    // #region CONFIGURATION & ANIMATION CONTROLS
    // =========================================================================
    // Easily tweak any of these numbers to change how the item looks and reacts!
    // =========================================================================
    public pickupRadius: number = 1.3;        // Collection trigger distance in meters (e.g. 1.2m - 1.5m)
    public spinSpeedY: number = 1.8;          // Horizontal rotation speed (radians per second)
    public spinSpeedX: number = 0;            // Keep 0 so offset GLTF meshes only spin horizontally without swinging
    public enableFloating: boolean = true;    // If true, the item gently bobs up and down
    public floatAmplitude: number = 0.08;     // Float hover height in meters (+/- 8cm)
    public floatFrequency: number = 2.0;      // Float speed (higher = faster hover)
    // #endregion

    // #region INTERNAL STATE & OBJECT REFS
    private model: THREE.Object3D | null = null;
    private initialLocalY: number = 0.5;      // Recorded base height
    private floatTime: number = 0;
    private isCollected: boolean = false;
    private worldPosTemp: THREE.Vector3 = new THREE.Vector3();
    private playerWorldTemp: THREE.Vector3 = new THREE.Vector3();
    // #endregion

    // Optional pickup callback
    public onCollected?: (item: CollectibleItem) => void;

    constructor(id: string, name: string = 'Special Item', config?: CollectibleConfig) {
        this.id = id;
        this.name = name;

        if (config) {
            if (config.pickupRadius !== undefined) this.pickupRadius = config.pickupRadius;
            if (config.spinSpeedY !== undefined) this.spinSpeedY = config.spinSpeedY;
            if (config.spinSpeedX !== undefined) this.spinSpeedX = config.spinSpeedX;
            if (config.enableFloating !== undefined) this.enableFloating = config.enableFloating;
            if (config.floatAmplitude !== undefined) this.floatAmplitude = config.floatAmplitude;
            if (config.floatFrequency !== undefined) this.floatFrequency = config.floatFrequency;
        }
    }

    // #region 3D MODEL BINDING
    /**
     * Binds a 3D model node (e.g. gem.glb from Mattercraft or Blender).
     */
    public bindModel(node: THREE.Object3D | any): void {
        this.model = node?.element || node;
        if (this.model) {
            this.model.updateMatrixWorld(true);
            this.initialLocalY = this.model.position.y !== 0 ? this.model.position.y : 0.5;
            this.model.rotation.x = 0;
            this.model.rotation.z = 0;
            this.model.visible = !this.isCollected;
            console.log(`[CollectibleItem] Bound 3D model for '${this.name}' at base height ${this.initialLocalY.toFixed(2)}m`);
        }
    }

    public getModel(): THREE.Object3D | null {
        return this.model;
    }
    // #endregion

    // #region UPDATE & ANIMATION LOOP
    /**
     * Animates the item (spinning + vertical up-and-down bobbing) without checking pickup.
     */
    public animate(deltaTime: number): void {
        if (!this.model || this.isCollected) return;

        // 1. Horizontal spinning rotation (keep X/Z at 0 if spinSpeedX is 0 so it never wobbles)
        this.model.rotation.y += deltaTime * this.spinSpeedY;
        if (this.spinSpeedX !== 0) {
            this.model.rotation.x += deltaTime * this.spinSpeedX;
        } else {
            this.model.rotation.x = 0;
            this.model.rotation.z = 0;
        }

        // 2. Subtle vertical-only floating hover animation
        if (this.enableFloating) {
            this.floatTime += deltaTime * this.floatFrequency;
            this.model.position.y = this.initialLocalY + Math.sin(this.floatTime) * this.floatAmplitude;
        }
    }

    /**
     * Runs every frame to spin the item, bob it up and down, and test for player pickup.
     * Uses world-space XZ distance when `playerObject` is provided so scene hierarchy offsets never break collection.
     * Returns true on the exact frame the item is collected.
     */
    public update(deltaTime: number, playerLocalPos: THREE.Vector3, playerObject?: THREE.Object3D | null): boolean {
        if (!this.model || this.isCollected) return false;

        this.animate(deltaTime);

        // 3. Proximity check with player (horizontal XZ distance in world space if available)
        let dx: number;
        let dz: number;

        if (playerObject) {
            playerObject.updateMatrixWorld(true);
            playerObject.getWorldPosition(this.playerWorldTemp);
            this.model.updateMatrixWorld(true);
            this.model.getWorldPosition(this.worldPosTemp);
            dx = this.playerWorldTemp.x - this.worldPosTemp.x;
            dz = this.playerWorldTemp.z - this.worldPosTemp.z;
        } else {
            dx = playerLocalPos.x - this.model.position.x;
            dz = playerLocalPos.z - this.model.position.z;
        }

        const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

        // Update 3D proximity volume for orb_loop.mp3
        soundManager.updateOrbProximity(horizontalDistance);

        if (horizontalDistance < this.pickupRadius) {
            this.collect();
            return true;
        }

        return false;
    }

    public getWorldPosition(outVec: THREE.Vector3): THREE.Vector3 {
        if (this.model) {
            this.model.updateMatrixWorld(true);
            this.model.getWorldPosition(outVec);
        } else {
            outVec.set(0, 0, 0);
        }
        return outVec;
    }

    public getPosition(): THREE.Vector3 {
        if (this.model) {
            return this.model.position;
        }
        return this.worldPosTemp.set(0, 0, 0);
    }
    // #endregion

    // #region STATE & RESET
    /**
     * Trigger collection of this item.
     */
    public collect(): void {
        if (this.isCollected) return;
        this.isCollected = true;

        if (this.model) {
            this.model.visible = false;
        }

        soundManager.playOrbPickUp();

        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            try { (navigator as any).vibrate([150, 80, 200]); } catch (e) { }
        }

        console.log(`[CollectibleItem] '${this.name}' (${this.id}) collected!`);
        this.onCollected?.(this);
    }

    /**
     * Reset item state for a new trial attempt.
     */
    public reset(): void {
        this.isCollected = false;
        this.floatTime = 0;
        if (this.model) {
            this.model.visible = true;
            this.model.position.y = this.initialLocalY;
        }
    }

    public isItemCollected(): boolean {
        return this.isCollected;
    }
    // #endregion
}

