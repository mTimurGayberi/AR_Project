import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';
import { StartZone } from './core/StartZone';
import { CollectibleItem } from './core/CollectibleItem';

export interface MazeConfig {
    wallGracePeriod?: number;   // Duration in seconds (e.g. 2.0s) before penalty reset
    collisionDistance?: number; // Proximity in meters to trigger warning (default 0.25m, lower = less sensitive)
    wallHeight?: number;        // Fixed height of walls in meters (e.g. 2.2m)
    moveSpeed?: number;         // Desktop dev simulation speed
}

/**
 * MazeGame
 * 
 * Game #1 in the 10 mini-game quest.
 * Modularized Architecture:
 * - Uses StartZone for the flag & translucent green activation pad.
 * - Uses CollectibleItem for the golden spinning gem.
 * - Manages 360-degree wall raycast proximity collisions.
 * - Continuous 6-DOF phone walking camera tracking.
 */
export class MazeGame extends BaseMiniGame {
    // #region CONFIGURATION & WALL COLLISION CONTROLS
    // =========================================================================
    // Easily tweak any of these numbers to change collision sensitivity!
    // =========================================================================
    public wallGracePeriod: number = 2.0;    // Grace period in seconds before penalty reset
    public collisionDistance: number = 0.25;  // Proximity threshold in meters (0.25m = ~10 inches)
    public wallHeight: number = 2.2;         // Human height in meters for walls
    public moveSpeed: number = 3.0;          // Desktop keyboard movement speed
    // #endregion

    // #region MODULAR COMPONENTS
    public startZone: StartZone;
    public collectible: CollectibleItem;
    // #endregion

    // #region 3D OBJECTS & AR TRACKING
    private camera: THREE.Camera | null = null;
    private tempWorldPos: THREE.Vector3 = new THREE.Vector3();
    private tempLocalPos: THREE.Vector3 = new THREE.Vector3();

    private playerMesh!: THREE.Mesh;
    private playerMaterial!: THREE.MeshStandardMaterial;
    private playerSphere: THREE.Sphere = new THREE.Sphere(new THREE.Vector3(), 0.35); // 0.35m body radius

    private customWallMeshes: THREE.Mesh[] = [];
    private rawWallsNode: any = null;
    private lastMeshScanTime: number = 0;

    // 12 radial directions around player for 360-degree wall raycasting
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private rayDirections: THREE.Vector3[] = [];
    // #endregion

    // #region GAME STATE
    private isCollidingWithWall: boolean = false;
    private wallCollisionTimer: number = 0;
    private isWaitingForPhysicalReturn: boolean = false;
    private isWaitingToStart: boolean = true;
    private isTrialWon: boolean = false;

    private returnNotifyTimer: number = 0;
    private graceNotifyTimer: number = 0;

    private normalPlayerColor: number = 0x00d2ff;  // Vibrant cyan
    private warningPlayerColor: number = 0xff2222; // Glowing red warning
    // #endregion

    // #region DESKTOP INPUT STATE
    private inputVelocity: THREE.Vector2 = new THREE.Vector2();
    private isUsingKeyboard: boolean = false;
    // #endregion

    constructor(config?: MazeConfig) {
        super('game_01_maze', 'Sensei Maze Trial', 'item_01_wind_gem');

        if (config?.wallGracePeriod !== undefined) this.wallGracePeriod = config.wallGracePeriod;
        if (config?.collisionDistance !== undefined) this.collisionDistance = config.collisionDistance;
        if (config?.wallHeight !== undefined) this.wallHeight = config.wallHeight;
        if (config?.moveSpeed !== undefined) this.moveSpeed = config.moveSpeed;

        // Initialize modular components
        this.startZone = new StartZone({
            triggerRadius: 1.4,
            padRadius: 1.3,
            padColor: 0x00ff88,
            padOpacity: 0.35
        });

        this.collectible = new CollectibleItem('item_01_wind_gem', 'Wind Gem', {
            pickupRadius: 1.3,
            spinSpeedY: 1.8,
            spinSpeedX: 0.5,
            enableFloating: true,
            floatAmplitude: 0.08
        });

        // Initialize 12 radial directions for 360-degree horizontal raycasting
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            this.rayDirections.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize());
        }
    }

    // #region INITIALIZATION & SCENE BINDING
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.createPlayerAvatar();
        this.setupInputListeners();

        if (parentContainer && typeof parentContainer.add === 'function') {
            parentContainer.add(this.container);
        } else if (parentContainer?.element && typeof parentContainer.element.add === 'function') {
            parentContainer.element.add(this.container);
        }

        console.log('[MazeGame] Initialized (Modular Architecture).');
    }

    private addLighting(): void {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
        this.container.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
        dirLight.position.set(5, 10, 7);
        this.container.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
        fillLight.position.set(-5, 8, -5);
        this.container.add(fillLight);
    }

    private createPlayerAvatar(): void {
        const radius = 0.3;
        const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 24);
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: this.normalPlayerColor,
            emissive: this.normalPlayerColor,
            emissiveIntensity: 0.6
        });
        this.playerMesh = new THREE.Mesh(geo, this.playerMaterial);
        this.playerSphere.radius = radius;
        this.container.add(this.playerMesh);
    }

    /**
     * Bind 3D visual nodes imported from Mattercraft (walls, flag, startPad, gem).
     */
    public bindCustomSceneNodes(nodes: {
        collidersGroup?: THREE.Group | THREE.Object3D | any;
        wallsGroup?: THREE.Group | THREE.Object3D | any;
        startPad?: THREE.Object3D | any;
        flag?: THREE.Object3D | any;
        goalItem?: THREE.Object3D | any;
    }): void {
        this.rawWallsNode = nodes.collidersGroup?.element || nodes.collidersGroup || nodes.wallsGroup?.element || nodes.wallsGroup;

        if (this.rawWallsNode) {
            this.scanWallMeshes();
        }

        // Bind StartZone (handles flag & translucent green ground pad)
        this.startZone.bindNodes(this.container, {
            flag: nodes.flag,
            startPad: nodes.startPad
        });

        // Bind CollectibleItem (handles golden gem, spin animation, pickup)
        if (nodes.goalItem) {
            this.collectible.bindModel(nodes.goalItem);
        }

        this.resetPlayerPosition();
    }

    /**
     * Scans the walls node for collision meshes.
     * Automatically filters out floors, grounds, pads, flags, and collectibles!
     */
    public scanWallMeshes(): void {
        if (!this.rawWallsNode) return;

        const wallsObj = this.rawWallsNode;
        wallsObj.updateMatrixWorld(true);
        this.container.updateMatrixWorld(true);

        const foundMeshes: THREE.Mesh[] = [];

        wallsObj.traverse((child: any) => {
            if (child.isMesh && child.geometry) {
                const name = (child.name || '').toLowerCase();

                // Exclude non-wall meshes (floors, pads, flags, gems)
                let curr: THREE.Object3D | null = child;
                let isNonWall = false;
                while (curr && curr !== wallsObj) {
                    const n = (curr.name || '').toLowerCase();
                    if (n.includes('floor') || n.includes('ground') || n.includes('pad') || 
                        n.includes('flag') || n.includes('start') || n.includes('item') || 
                        n.includes('gem') || n.includes('collectible') || n.includes('icosphere')) {
                        isNonWall = true;
                        break;
                    }
                    curr = curr.parent;
                }

                if (isNonWall || name.includes('floor') || name.includes('ground') || name.includes('pad') ||
                    name.includes('flag') || name.includes('start') || name.includes('item') ||
                    name.includes('gem') || name.includes('collectible') || name.includes('icosphere')) {
                    return;
                }

                // Double-sided materials so raycasts hit both front and back faces
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m: any) => { m.side = THREE.DoubleSide; });
                    } else {
                        child.material.side = THREE.DoubleSide;
                    }
                }

                foundMeshes.push(child);
            }
        });

        if (foundMeshes.length > 0) {
            this.customWallMeshes = foundMeshes;
            console.log(`[MazeGame] Detected ${this.customWallMeshes.length} wall mesh(es) for collisions.`);
        }
    }

    public getLoadedCollidersCount(): number {
        return this.customWallMeshes.length;
    }
    // #endregion

    // #region LIFECYCLE & RESET
    public override start(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.isWaitingToStart = true;
        this.stopTimer(); // Paused until player steps into the green start zone
        this.startZone.setVisible(true);
        this.notify('🚩 Walk into the green Start Area around the flag to begin!', 'info');
    }

    public override reset(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.resetPlayerPosition();
        this.isWaitingForPhysicalReturn = false;
        this.isWaitingToStart = true;
        this.resetTimer();
        this.stopTimer();
        this.startZone.setVisible(true);
        this.collectible.reset();
        this.notify('🚩 Walk into the green Start Area around the flag to begin!', 'info');
    }

    public resetPlayerPosition(): void {
        const startPos = this.startZone.getCenterPosition();
        this.playerMesh.position.copy(startPos);
        this.playerSphere.center.set(startPos.x, 0.5, startPos.z);
        this.inputVelocity.set(0, 0);
        this.isCollidingWithWall = false;
        this.wallCollisionTimer = 0;
        this.graceNotifyTimer = 0;
        this.returnNotifyTimer = 0;
        this.setPlayerVisualState('normal');
    }

    /**
     * Restart current trial immediately (called by UI button or after failure reset).
     */
    public restartTrial(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.isCollidingWithWall = false;
        this.wallCollisionTimer = 0;
        this.graceNotifyTimer = 0;
        this.returnNotifyTimer = 0;
        this.resetTimer();
        this.stopTimer();
        this.collectible.reset();

        const check = this.startZone.checkPlayer(this.playerMesh.position);
        if (check.isInside) {
            // Player is already standing inside the start area!
            this.isWaitingToStart = false;
            this.isWaitingForPhysicalReturn = false;
            this.startZone.setVisible(false);
            this.startTimer();
            this.setPlayerVisualState('normal');
            this.notify('🔄 Trial restarted! GO!', 'success');
        } else {
            // Outside start area, prompt to walk to the flag:
            this.isWaitingToStart = true;
            this.isWaitingForPhysicalReturn = false;
            this.startZone.setVisible(true);
            this.setPlayerVisualState('normal');
            this.notify('🚩 Walk into the green Start Area around the flag to begin!', 'info');
        }
    }

    public override notify(message: string, type: import('./BaseMiniGame').NotificationType = 'info'): void {
        super.notify(message, type);
    }
    // #endregion

    // #region MAIN GAME LOOP
    protected onUpdate(deltaTime: number): void {
        // Asynchronous GLTF scan retry if models take a moment to load
        if (this.customWallMeshes.length === 0 && this.rawWallsNode) {
            this.lastMeshScanTime += deltaTime;
            if (this.lastMeshScanTime >= 0.5) {
                this.lastMeshScanTime = 0;
                this.scanWallMeshes();
            }
        }

        // 1. ALWAYS Track Player Position from 6-DOF AR Camera
        if (this.camera && !this.isUsingKeyboard) {
            this.camera.getWorldPosition(this.tempWorldPos);
            this.tempLocalPos.copy(this.tempWorldPos);
            this.container.worldToLocal(this.tempLocalPos);

            this.playerMesh.position.set(this.tempLocalPos.x, 0.05, this.tempLocalPos.z);
            this.playerSphere.center.set(this.tempLocalPos.x, 0.5, this.tempLocalPos.z);
        } else if (this.isUsingKeyboard && this.inputVelocity.lengthSq() > 0.001) {
            const moveDeltaX = this.inputVelocity.x * this.moveSpeed * deltaTime;
            const moveDeltaZ = this.inputVelocity.y * this.moveSpeed * deltaTime;

            this.playerMesh.position.x += moveDeltaX;
            this.playerMesh.position.z += moveDeltaZ;
            this.playerSphere.center.set(this.playerMesh.position.x, 0.5, this.playerMesh.position.z);
        }

        // If the trial has already been won, keep camera tracking active but pause trial collisions
        if (this.isTrialWon) {
            return;
        }

        // 2. Start Area Entrance & Physical Walk-Back Checks
        const startCheck = this.startZone.checkPlayer(this.playerMesh.position);

        if (this.isWaitingToStart) {
            if (this.isWaitingForPhysicalReturn) {
                // Penalty state: counting down distance back to green start area
                this.returnNotifyTimer += deltaTime;
                if (this.returnNotifyTimer >= 0.5) {
                    this.returnNotifyTimer = 0;
                    this.notify(`⛔ TRIAL FAILED: Hit Wall! Walk back to green Start Area (${startCheck.distance.toFixed(1)}m)`, 'error');
                }

                if (startCheck.isInside) {
                    this.isWaitingForPhysicalReturn = false;
                    this.isWaitingToStart = false;
                    this.returnNotifyTimer = 0;
                    this.startZone.setVisible(false); // Disappears once player enters!
                    this.resetTimer();
                    this.startTimer();
                    this.setPlayerVisualState('normal');
                    this.notify('✅ Back at Start Area! Trial restarted. GO!', 'success');
                    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                        try { (navigator as any).vibrate(150); } catch (e) {}
                    }
                }
            } else {
                // Waiting for player to enter start area on initial load or restart
                if (startCheck.isInside) {
                    this.isWaitingToStart = false;
                    this.startZone.setVisible(false); // Disappears once player enters!
                    this.resetTimer();
                    this.startTimer();
                    this.setPlayerVisualState('normal');
                    this.notify('🚀 Entered Start Area! Trial started. GO!', 'success');
                    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                        try { (navigator as any).vibrate(120); } catch (e) {}
                    }
                }
            }
            return; // Outside the maze waiting to start, do not process wall collisions or collectible checks!
        }

        // 3. Wall Collision Proximity Check (360-degree Raycasting)
        let touchingAnyWall = false;

        if (this.customWallMeshes.length > 0) {
            const worldCenter = new THREE.Vector3();
            this.playerMesh.getWorldPosition(worldCenter);
            worldCenter.y += 0.8; // Waist height

            const checkDist = this.collisionDistance;

            for (const dir of this.rayDirections) {
                this.raycaster.set(worldCenter, dir);
                this.raycaster.far = checkDist;
                const hits = this.raycaster.intersectObjects(this.customWallMeshes, true);
                if (hits.length > 0 && hits[0].distance <= checkDist) {
                    touchingAnyWall = true;
                    break;
                }
            }
        }

        // Grace Period & Warning Logic
        if (touchingAnyWall) {
            if (!this.isCollidingWithWall) {
                this.isCollidingWithWall = true;
                this.wallCollisionTimer = 0;
                this.graceNotifyTimer = 0;
                this.setPlayerVisualState('warning');
                this.notify('⚠️ Warning: Wall contact! Step back immediately!', 'warning');
                if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                    try { (navigator as any).vibrate(100); } catch (e) {}
                }
            } else {
                this.wallCollisionTimer += deltaTime;
                this.graceNotifyTimer += deltaTime;

                if (this.graceNotifyTimer >= 0.35) {
                    this.graceNotifyTimer = 0;
                    const remaining = Math.max(0, this.wallGracePeriod - this.wallCollisionTimer);
                    this.notify(`⚠️ Step back from wall! Penalty in ${remaining.toFixed(1)}s`, 'warning');
                }

                if (this.wallCollisionTimer >= this.wallGracePeriod) {
                    this.isWaitingToStart = true;
                    this.isWaitingForPhysicalReturn = true;
                    this.isCollidingWithWall = false;
                    this.wallCollisionTimer = 0;
                    this.graceNotifyTimer = 0;
                    this.stopTimer(); // Halt trial timer on failure!
                    this.startZone.setVisible(true); // Reappears as glowing green ground area!
                    this.setPlayerVisualState('warning');
                    this.notify('⛔ TRIAL FAILED: Hit Wall! Walk back to green Start Area to retry.', 'error');
                    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                        try { (navigator as any).vibrate([250, 100, 250]); } catch (e) {}
                    }
                    return;
                }
            }
        } else {
            if (this.isCollidingWithWall) {
                this.isCollidingWithWall = false;
                this.wallCollisionTimer = 0;
                this.graceNotifyTimer = 0;
                this.setPlayerVisualState('normal');
                this.notify('Safe! You stepped back into the path.', 'info');
            }
        }

        // 4. Update Collectible (Gem Spinning & Proximity Pickup)
        const collectedJustNow = this.collectible.update(deltaTime, this.playerMesh.position);
        if (collectedJustNow) {
            this.onWin();
        }
    }
    // #endregion

    // #region WIN STATE
    public override onWin(): void {
        if (this.isTrialWon) return;
        this.isTrialWon = true;

        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            try { (navigator as any).vibrate([150, 80, 200]); } catch (e) {}
        }

        super.onWin();

        // Keep isActive = true so Three.js camera tracking continues to move the player knob!
        this.isActive = true;

        this.notify('🎉 VICTORY! You collected the Wind Gem! [1/10]', 'success');
    }

    private setPlayerVisualState(state: 'normal' | 'warning'): void {
        if (!this.playerMaterial) return;
        if (state === 'warning') {
            this.playerMaterial.color.setHex(this.warningPlayerColor);
            this.playerMaterial.emissive.setHex(this.warningPlayerColor);
            this.playerMaterial.emissiveIntensity = 0.9;
        } else {
            this.playerMaterial.color.setHex(this.normalPlayerColor);
            this.playerMaterial.emissive.setHex(this.normalPlayerColor);
            this.playerMaterial.emissiveIntensity = 0.6;
        }
    }
    // #endregion

    // #region DESKTOP KEYBOARD CONTROLS
    public setMovementInput(dx: number, dz: number): void {
        this.isUsingKeyboard = true;
        this.inputVelocity.set(dx, dz);
        if (this.inputVelocity.lengthSq() > 1) {
            this.inputVelocity.normalize();
        }
    }

    private setupInputListeners(): void {
        if (typeof window !== 'undefined') {
            const activeKeys: { [key: string]: boolean } = {};

            const updateVelocityFromKeys = () => {
                let dx = 0;
                let dz = 0;
                if (activeKeys['ArrowUp'] || activeKeys['KeyW']) dz -= 1;
                if (activeKeys['ArrowDown'] || activeKeys['KeyS']) dz += 1;
                if (activeKeys['ArrowLeft'] || activeKeys['KeyA']) dx -= 1;
                if (activeKeys['ArrowRight'] || activeKeys['KeyD']) dx += 1;
                this.setMovementInput(dx, dz);
            };

            window.addEventListener('keydown', (e) => {
                activeKeys[e.code] = true;
                updateVelocityFromKeys();
            });

            window.addEventListener('keyup', (e) => {
                activeKeys[e.code] = false;
                updateVelocityFromKeys();
            });
        }
    }
    // #endregion
}
