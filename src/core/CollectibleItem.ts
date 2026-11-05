import * as THREE from 'three';

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
    public spinSpeedX: number = 0.5;          // Subtle vertical tilt rotation speed
    public enableFloating: boolean = true;    // If true, the item gently bobs up and down
    public floatAmplitude: number = 0.08;     // Float hover height in meters (+/- 8cm)
    public floatFrequency: number = 2.0;      // Float speed (higher = faster hover)
    // #endregion

    // #region INTERNAL STATE & OBJECT REFS
    private model: THREE.Object3D | null = null;
    private initialLocalY: number = 1.2;      // Recorded base height
    private floatTime: number = 0;
    private isCollected: boolean = false;
    private worldPosTemp: THREE.Vector3 = new THREE.Vector3();
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
            this.initialLocalY = this.model.position.y || 1.2;
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
     * Runs every frame to spin the item, bob it up and down, and test for player pickup.
     * Returns true on the exact frame the item is collected.
     */
    public update(deltaTime: number, playerLocalPos: THREE.Vector3): boolean {
        if (!this.model || this.isCollected) return false;

        // 1. Spinning rotation
        this.model.rotation.y += deltaTime * this.spinSpeedY;
        this.model.rotation.x += deltaTime * this.spinSpeedX;

        // 2. Subtle floating hover animation
        if (this.enableFloating) {
            this.floatTime += deltaTime * this.floatFrequency;
            this.model.position.y = this.initialLocalY + Math.sin(this.floatTime) * this.floatAmplitude;
        }

        // 3. Proximity check with player (horizontal distance)
        const dx = playerLocalPos.x - this.model.position.x;
        const dz = playerLocalPos.z - this.model.position.z;
        const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

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

        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            try { (navigator as any).vibrate([150, 80, 200]); } catch (e) {}
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

