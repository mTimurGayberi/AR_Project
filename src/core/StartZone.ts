import * as THREE from 'three';

export interface StartZoneConfig {
    triggerRadius?: number;
    padRadius?: number;
    padColor?: number;
    padOpacity?: number;
    vibrateOnEnter?: boolean;
}

/**
 * StartZone
 * 
 * Reusable Start Point and Activation Zone for all 10 mini-games.
 * Manages the flagpole / start marker, the translucent glowing green indicator area,
 * player entrance proximity detection, hiding on trial start, and reappearing on loss/restart.
 */
export class StartZone {
    // #region CONFIGURATION & VISUAL CONTROLS
    // =========================================================================
    // Easily tweak any of these numbers to customize the start area!
    // =========================================================================
    public triggerRadius: number = 1.4;       // Radius in meters where the player is considered 'inside'
    public padRadius: number = 1.3;           // Geometric radius of the green ground indicator circle
    public padColor: number = 0x00ff88;       // Vibrant neon emerald green
    public padOpacity: number = 0.35;         // Low opacity for transparent floor glow
    public vibrateOnEnter: boolean = true;    // Light haptic pulse when entering start area
    // #endregion

    // #region INTERNAL STATE & OBJECT REFS
    private flagModel: THREE.Object3D | null = null;
    private customPadModel: THREE.Object3D | null = null;
    private proceduralPad: THREE.Mesh | null = null;
    private parentContainer: THREE.Group | null = null;
    public centerPosition: THREE.Vector3 = new THREE.Vector3();
    private isPadStyled: boolean = false;
    private isVisible: boolean = true;
    // #endregion

    // Optional event callbacks
    public onPlayerEntered?: () => void;

    constructor(config?: StartZoneConfig) {
        if (config) {
            if (config.triggerRadius !== undefined) this.triggerRadius = config.triggerRadius;
            if (config.padRadius !== undefined) this.padRadius = config.padRadius;
            if (config.padColor !== undefined) this.padColor = config.padColor;
            if (config.padOpacity !== undefined) this.padOpacity = config.padOpacity;
            if (config.vibrateOnEnter !== undefined) this.vibrateOnEnter = config.vibrateOnEnter;
        }
    }

    // #region SCENE BINDING & SETUP
    /**
     * Bind 3D nodes from Mattercraft (flag.glb and/or StartPad).
     */
    public bindNodes(container: THREE.Group, nodes: { flag?: THREE.Object3D | any; startPad?: THREE.Object3D | any }): void {
        this.parentContainer = container;
        this.flagModel = nodes.flag?.element || nodes.flag || null;
        this.customPadModel = nodes.startPad?.element || nodes.startPad || null;

        // 1. If flag is provided, use its position as the anchor
        if (this.flagModel) {
            this.flagModel.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            this.flagModel.getWorldPosition(worldPos);
            container.worldToLocal(worldPos);
            this.centerPosition.set(worldPos.x, 0, worldPos.z);
            console.log(`[StartZone] Bound to flag.glb at (${this.centerPosition.x.toFixed(2)}, ${this.centerPosition.z.toFixed(2)})`);
        }

        // 2. Style custom artist startPad if present
        if (this.customPadModel) {
            this.stylePadMesh(this.customPadModel);
            if (this.flagModel) {
                this.customPadModel.position.set(this.centerPosition.x, 0.02, this.centerPosition.z);
            } else {
                this.updateCenterFromPad();
            }
        } else {
            // 3. Create procedural fallback pad if no custom pad was provided
            this.createProceduralPad();
        }

        this.setVisible(true);
    }

    /**
     * Styles any mesh as an unlit, translucent glowing green ground indicator.
     */
    public stylePadMesh(target: THREE.Object3D): void {
        let styledCount = 0;
        target.traverse((child: any) => {
            if (child.isMesh) {
                child.material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(this.padColor),
                    transparent: true,
                    opacity: this.padOpacity,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                child.material.needsUpdate = true;
                styledCount++;
            }
        });
        if (styledCount > 0) {
            this.isPadStyled = true;
        }
    }

    private createProceduralPad(): void {
        if (!this.parentContainer || this.proceduralPad) return;
        const geo = new THREE.CylinderGeometry(this.padRadius, this.padRadius, 0.04, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.padColor),
            transparent: true,
            opacity: this.padOpacity,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.proceduralPad = new THREE.Mesh(geo, mat);
        this.proceduralPad.position.set(this.centerPosition.x, 0.02, this.centerPosition.z);
        this.parentContainer.add(this.proceduralPad);
    }

    private updateCenterFromPad(): void {
        if (!this.customPadModel || !this.parentContainer) return;
        this.customPadModel.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        this.customPadModel.getWorldPosition(worldPos);
        this.parentContainer.worldToLocal(worldPos);
        this.centerPosition.set(worldPos.x, 0, worldPos.z);
    }
    // #endregion

    // #region PROXIMITY & TRIGGER CHECKS
    /**
     * Checks if player is within the start zone radius.
     */
    public checkPlayer(playerLocalPos: THREE.Vector3): { isInside: boolean; distance: number } {
        // Late styling retry if GLTF took a few frames to download
        if (!this.isPadStyled && this.customPadModel) {
            this.stylePadMesh(this.customPadModel);
        }

        const dx = playerLocalPos.x - this.centerPosition.x;
        const dz = playerLocalPos.z - this.centerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        const isInside = distance < this.triggerRadius;
        return { isInside, distance };
    }

    public getCenterPosition(): THREE.Vector3 {
        return this.centerPosition;
    }
    // #endregion

    // #region VISIBILITY CONTROLS
    /**
     * Show or hide the green start area indicator.
     */
    public setVisible(visible: boolean): void {
        this.isVisible = visible;
        if (this.customPadModel) {
            this.customPadModel.visible = visible;
            this.customPadModel.traverse?.((c: any) => { c.visible = visible; });
        }
        if (this.proceduralPad) {
            this.proceduralPad.visible = visible;
        }
    }

    public getIsVisible(): boolean {
        return this.isVisible;
    }
    // #endregion
}

