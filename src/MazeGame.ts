import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';
import type { RoomBounds } from './RoomScanner';

export interface MazeConfig {
    wallGracePeriod?: number; // Duration in seconds (e.g. 2.0s) before penalty reset
    wallHeight?: number;      // Fixed height of walls in meters (always human-height, e.g. 1.8m)
    cellSize?: number;        // Optional corridor cell size
    moveSpeed?: number;       // Desktop dev simulation speed
    roomWidth?: number;       // Fixed room width in meters (e.g. 4.0m - 6.0m)
    roomDepth?: number;       // Fixed room depth in meters (e.g. 4.0m - 6.0m)
}

/**
 * MazeGame
 * 
 * Game #1 in the 10 mini-game quest.
 * Features:
 * - 1:1 Fixed Room-Scale AR: Fits the physical campus room at fixed dimensions (default 5.0m x 5.0m).
 * - Vertical wall height (Y) remains strictly fixed at 1.8m so walls never become short toy walls.
 * - Player position is tracked via the phone's 6-DOF AR camera as they physically walk inside.
 * - Open entrance doorway at (0, 1) allows player to physically walk in from outside.
 * - Wall collision grace period (2-second warning before penalty).
 * - Physical Return-to-Start mechanic on wall failure.
 */
export class MazeGame extends BaseMiniGame {
    public wallGracePeriod: number = 2.0;
    public wallHeight: number = 2.2; // 2.2m tall bamboo walls for the high ceiling campus room!
    public moveSpeed: number = 3.0;

    // Room dimensions (X = width: 7.5m, Z = depth: 22.0m)
    public roomWidth: number = 7.5;
    public roomDepth: number = 22.0;
    public cellSizeX: number = 1.5;
    public cellSizeZ: number = 2.2;

    // Camera reference for 1:1 physical AR walking
    private camera: THREE.Camera | null = null;
    private tempWorldPos: THREE.Vector3 = new THREE.Vector3();
    private tempLocalPos: THREE.Vector3 = new THREE.Vector3();

    // Positions in local container coordinates
    private startPoint: THREE.Vector3 = new THREE.Vector3();
    private endPoint: THREE.Vector3 = new THREE.Vector3();

    // 3D Visual Objects
    private playerMesh!: THREE.Mesh;
    private playerMaterial!: THREE.MeshStandardMaterial;
    private playerSphere: THREE.Sphere = new THREE.Sphere(new THREE.Vector3(), 0.35); // 0.35m body radius
    private goalItemMesh!: THREE.Mesh;
    private wallBoundingBoxes: THREE.Box3[] = [];
    private wallMeshes: THREE.Mesh[] = [];
    private floorMesh!: THREE.Mesh;
    private startPad!: THREE.Mesh;
    private endPad!: THREE.Mesh;

    // Collision & Grace Period State
    private isCollidingWithWall: boolean = false;
    private wallCollisionTimer: number = 0;
    private isWaitingForPhysicalReturn: boolean = false;
    private normalPlayerColor: number = 0x00d2ff; // Bright cyan
    private warningPlayerColor: number = 0xff2222; // Glowing red warning

    // Input state for desktop keyboard testing
    private inputVelocity: THREE.Vector2 = new THREE.Vector2();
    private isUsingKeyboard: boolean = false;

    // 5x5 Walkable Maze Grid (Optimal for room-scale walking)
    // (0, 1) Open entrance doorway from room into maze
    // S at (1, 1), E at (3, 3)
    private mazeGrid: number[][] = [
        [1, 0, 1, 1, 1], // (0, 1) Entrance doorway
        [1, 0, 0, 0, 1], // (1, 1) Start corridor & pad
        [1, 0, 1, 0, 1], // Center barrier
        [1, 0, 0, 0, 1], // (3, 3) End corridor & reward gem
        [1, 1, 1, 1, 1],
    ];

    constructor(config?: MazeConfig) {
        super('game_01_maze', 'Sensei Maze Trial', 'item_01_wind_gem');

        if (config?.wallGracePeriod !== undefined) this.wallGracePeriod = config.wallGracePeriod;
        if (config?.wallHeight !== undefined) this.wallHeight = config.wallHeight;
        if (config?.moveSpeed !== undefined) this.moveSpeed = config.moveSpeed;
        if (config?.roomWidth !== undefined) this.roomWidth = config.roomWidth;
        if (config?.roomDepth !== undefined) this.roomDepth = config.roomDepth;
        if (config?.cellSize !== undefined) {
            const cols = this.mazeGrid[0].length;
            const rows = this.mazeGrid.length;
            this.roomWidth = config.cellSize * cols;
            this.roomDepth = config.cellSize * rows;
        }

        this.calculateCellSizes();
    }

    private calculateCellSizes(): void {
        const rows = this.mazeGrid.length;
        const cols = this.mazeGrid[0].length;
        this.cellSizeX = this.roomWidth / cols;
        this.cellSizeZ = this.roomDepth / rows;
    }

    /**
     * Set fixed room dimensions directly (in meters).
     * Rebuilds the maze grid to match the room while keeping wallHeight fixed at 1.8m.
     */
    public setRoomDimensions(width: number, depth: number): void {
        this.roomWidth = Math.max(width, 2.0);
        this.roomDepth = Math.max(depth, 2.0);
        this.rebuildMaze();
        this.reset();
        this.notify(`Maze set to fixed room: ${this.roomWidth.toFixed(1)}m × ${this.roomDepth.toFixed(1)}m.`, 'info');
    }

    /**
     * Apply calibrated room boundaries from RoomScanner.
     * Scales only X and Z to match room dimensions; wall height (Y) remains strictly fixed at 1.8m!
     */
    public applyRoomBounds(bounds: RoomBounds): void {
        this.roomWidth = bounds.width;
        this.roomDepth = bounds.depth;

        this.container.position.copy(bounds.center);
        this.container.rotation.y = bounds.rotationY;

        console.log(`[MazeGame] Room bounds applied: ${this.roomWidth.toFixed(1)}m × ${this.roomDepth.toFixed(1)}m. Rotation: ${bounds.rotationY.toFixed(2)} rad. Wall height: ${this.wallHeight}m.`);

        this.rebuildMaze();
        this.reset();
        this.notify(`Maze fitted to room: ${this.roomWidth.toFixed(1)}m × ${this.roomDepth.toFixed(1)}m! (Walls: ${this.wallHeight}m tall)`, 'success');
    }

    /**
     * Calibrate the maze to fit the player's scanned room (2-corner fallback).
     * Scales only X and Z to match room dimensions; wall height (Y) remains fixed at 1.8m!
     */
    public calibrateRoom(corner1: THREE.Vector3, corner2: THREE.Vector3): void {
        const measuredWidth = Math.abs(corner2.x - corner1.x);
        const measuredDepth = Math.abs(corner2.z - corner1.z);

        this.roomWidth = Math.max(measuredWidth, 2.5);
        this.roomDepth = Math.max(measuredDepth, 2.5);

        const centerX = (corner1.x + corner2.x) / 2;
        const centerZ = (corner1.z + corner2.z) / 2;
        const floorY = Math.min(corner1.y, corner2.y);

        this.container.position.set(centerX, floorY, centerZ);

        console.log(`[MazeGame] Room calibrated: ${this.roomWidth.toFixed(1)}m × ${this.roomDepth.toFixed(1)}m. Wall height strictly fixed at ${this.wallHeight}m.`);

        this.rebuildMaze();
        this.reset();
        this.notify(`Room mapped: ${this.roomWidth.toFixed(1)}m × ${this.roomDepth.toFixed(1)}m! Maze generated.`, 'success');
    }

    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Bind custom visual scene nodes created in Mattercraft by the 3D artist / level designer.
     * Automatically extracts wall collision bounding boxes from all child meshes in the 'Walls' group,
     * and sets custom start/end pad locations.
     */
    public bindCustomSceneNodes(nodes: {
        wallsGroup?: THREE.Group | THREE.Object3D | any;
        startPad?: THREE.Object3D | any;
        endPad?: THREE.Object3D | any;
        goalItem?: THREE.Object3D | any;
    }): void {
        const wallsObj = nodes.wallsGroup?.element || nodes.wallsGroup;
        const startPadObj = nodes.startPad?.element || nodes.startPad;
        const endPadObj = nodes.endPad?.element || nodes.endPad;
        const goalObj = nodes.goalItem?.element || nodes.goalItem;

        if (wallsObj) {
            // Remove procedural walls so the artist's custom walls take over
            for (const wall of this.wallMeshes) {
                this.container.remove(wall);
                if (wall.geometry) wall.geometry.dispose();
            }
            this.wallMeshes = [];
            this.wallBoundingBoxes = [];

            // Compute local bounding boxes for every mesh inside the artist's Walls group
            wallsObj.updateMatrixWorld(true);
            this.container.updateMatrixWorld(true);

            wallsObj.traverse((child: any) => {
                if (child.isMesh && child.geometry) {
                    child.geometry.computeBoundingBox();
                    const worldBox = new THREE.Box3().setFromObject(child);

                    // Convert world coordinates to local container coordinates
                    const minLocal = this.container.worldToLocal(worldBox.min.clone());
                    const maxLocal = this.container.worldToLocal(worldBox.max.clone());
                    const localBox = new THREE.Box3();
                    localBox.setFromPoints([minLocal, maxLocal]);

                    // Ensure vertical range covers the full wall height for collision
                    localBox.min.y = -0.5;
                    localBox.max.y = this.wallHeight + 0.5;

                    this.wallBoundingBoxes.push(localBox);
                }
            });

            console.log(`[MazeGame] Loaded ${this.wallBoundingBoxes.length} custom wall colliders from artist's scene!`);
        }

        if (startPadObj) {
            const worldPos = new THREE.Vector3();
            startPadObj.getWorldPosition(worldPos);
            this.container.worldToLocal(worldPos);
            this.startPoint.set(worldPos.x, 0, worldPos.z);
            if (this.startPad) {
                this.startPad.position.set(this.startPoint.x, 0.02, this.startPoint.z);
            }
            this.resetPlayerPosition();
            console.log(`[MazeGame] Start pad bound to (${this.startPoint.x.toFixed(2)}, ${this.startPoint.z.toFixed(2)})`);
        }

        if (endPadObj) {
            const worldPos = new THREE.Vector3();
            endPadObj.getWorldPosition(worldPos);
            this.container.worldToLocal(worldPos);
            this.endPoint.set(worldPos.x, 0, worldPos.z);
            if (this.endPad) {
                this.endPad.position.set(this.endPoint.x, 0.05, this.endPoint.z);
            }
            if (this.goalItemMesh) {
                this.goalItemMesh.position.set(this.endPoint.x, 1.3, this.endPoint.z);
            }
            console.log(`[MazeGame] End pad bound to (${this.endPoint.x.toFixed(2)}, ${this.endPoint.z.toFixed(2)})`);
        }

        if (goalObj && goalObj.isMesh) {
            this.goalItemMesh = goalObj;
        }
    }

    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.buildMaze();
        this.createStartAndEndPads();
        this.createPlayer();
        this.setupInputListeners();

        // Attach to Three.js Scene or parent container
        if (parentContainer && typeof parentContainer.add === 'function') {
            parentContainer.add(this.container);
        } else if (parentContainer?.element && typeof parentContainer.element.add === 'function') {
            parentContainer.element.add(this.container);
        }

        console.log(`[MazeGame] Initialized. Wall height: ${this.wallHeight}m.`);
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

    private rebuildMaze(): void {
        // Remove existing walls
        for (const wall of this.wallMeshes) {
            this.container.remove(wall);
            if (wall.geometry) wall.geometry.dispose();
        }
        this.wallMeshes = [];
        this.wallBoundingBoxes = [];

        if (this.floorMesh) {
            this.container.remove(this.floorMesh);
            if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
        }

        // Recompute cell sizes and build
        this.calculateCellSizes();
        this.buildMaze();

        // Reposition pads
        if (this.startPad) this.startPad.position.set(this.startPoint.x, 0.02, this.startPoint.z);
        if (this.endPad) this.endPad.position.set(this.endPoint.x, 0.05, this.endPoint.z);
        if (this.goalItemMesh) this.goalItemMesh.position.set(this.endPoint.x, 1.3, this.endPoint.z);
    }

    private buildMaze(): void {
        const rows = this.mazeGrid.length;
        const cols = this.mazeGrid[0].length;
        const offsetX = (cols * this.cellSizeX) / 2;
        const offsetZ = (rows * this.cellSizeZ) / 2;

        // Wall geometry: X and Z scale to the room; Y (height) is FIXED at this.wallHeight!
        const wallGeometry = new THREE.BoxGeometry(this.cellSizeX, this.wallHeight, this.cellSizeZ);
        
        // Semi-transparent bamboo green walls (safe for indoor walking)
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2e7d32, // Bamboo green
            emissive: 0x1b5e20,
            emissiveIntensity: 0.4,
            roughness: 0.4,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
        });

        // Floor guidelines
        const floorGeo = new THREE.PlaneGeometry(cols * this.cellSizeX, rows * this.cellSizeZ);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            transparent: true,
            opacity: 0.4
        });
        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.set(0, 0, 0);
        this.container.add(this.floorMesh);

        // Build walls and bounding boxes
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posX = c * this.cellSizeX - offsetX + this.cellSizeX / 2;
                const posZ = r * this.cellSizeZ - offsetZ + this.cellSizeZ / 2;

                if (this.mazeGrid[r][c] === 1) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(posX, this.wallHeight / 2, posZ);
                    this.container.add(wall);
                    this.wallMeshes.push(wall);

                    // Add bounding box for collision detection with player's body
                    const box = new THREE.Box3();
                    box.setFromCenterAndSize(
                        wall.position,
                        new THREE.Vector3(this.cellSizeX, this.wallHeight * 2, this.cellSizeZ)
                    );
                    this.wallBoundingBoxes.push(box);
                } else if (r === 1 && c === 1) {
                    this.startPoint.set(posX, 0, posZ);
                } else if (r === 3 && c === 3) {
                    this.endPoint.set(posX, 0, posZ);
                }
            }
        }
    }

    private createStartAndEndPads(): void {
        const padRadius = Math.min(this.cellSizeX, this.cellSizeZ) * 0.4;

        // Start pad (Green glowing floor ring)
        const startPadGeo = new THREE.CylinderGeometry(padRadius, padRadius, 0.05, 32);
        const startPadMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.7
        });
        this.startPad = new THREE.Mesh(startPadGeo, startPadMat);
        this.startPad.position.set(this.startPoint.x, 0.02, this.startPoint.z);
        this.container.add(this.startPad);

        // End pad (Gold cylinder)
        const endPadGeo = new THREE.CylinderGeometry(padRadius, padRadius, 0.1, 32);
        const endPadMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff8800,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        this.endPad = new THREE.Mesh(endPadGeo, endPadMat);
        this.endPad.position.set(this.endPoint.x, 0.05, this.endPoint.z);
        this.container.add(this.endPad);

        // Special Item floating at eye height (~1.3m) over end pad
        const itemGeo = new THREE.OctahedronGeometry(0.3, 0);
        const itemMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8,
            roughness: 0.1
        });
        this.goalItemMesh = new THREE.Mesh(itemGeo, itemMat);
        this.goalItemMesh.position.set(this.endPoint.x, 1.3, this.endPoint.z);
        this.container.add(this.goalItemMesh);
    }

    private createPlayer(): void {
        const radius = 0.3; // 0.3m radius representing player footprint
        const playerGeo = new THREE.CylinderGeometry(radius, radius, 0.1, 24);
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: this.normalPlayerColor,
            emissive: this.normalPlayerColor,
            emissiveIntensity: 0.6
        });
        this.playerMesh = new THREE.Mesh(playerGeo, this.playerMaterial);
        this.playerSphere.radius = radius;
        this.resetPlayerPosition();
        this.container.add(this.playerMesh);
    }

    public resetPlayerPosition(): void {
        this.playerMesh.position.copy(this.startPoint);
        this.playerSphere.center.set(this.startPoint.x, 0.5, this.startPoint.z);
        this.inputVelocity.set(0, 0);
        this.isCollidingWithWall = false;
        this.wallCollisionTimer = 0;
        this.setPlayerVisualState('normal');
    }

    public override reset(): void {
        this.resetPlayerPosition();
        this.isWaitingForPhysicalReturn = false;
        this.notify('Ready at Start Pad! Navigate through the corridors.', 'info');
    }

    public setMovementInput(dx: number, dz: number): void {
        this.isUsingKeyboard = true;
        this.inputVelocity.set(dx, dz);
        if (this.inputVelocity.lengthSq() > 1) {
            this.inputVelocity.normalize();
        }
    }

    protected onUpdate(deltaTime: number): void {
        // Animate floating special item
        if (this.goalItemMesh) {
            this.goalItemMesh.rotation.y += deltaTime * 1.5;
            this.goalItemMesh.rotation.x += deltaTime * 0.5;
        }

        // Track Player Position
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

        // Physical Return-to-Start Check
        if (this.isWaitingForPhysicalReturn) {
            const distToStart = new THREE.Vector2(this.playerSphere.center.x - this.startPoint.x, this.playerSphere.center.z - this.startPoint.z).length();
            if (distToStart < 0.9) {
                this.isWaitingForPhysicalReturn = false;
                this.reset();
                this.notify('✅ Returned to Start Pad! Maze restarted.', 'success');
            }
            return;
        }

        // Wall Collision Check
        let touchingAnyWall = false;
        for (const wallBox of this.wallBoundingBoxes) {
            if (wallBox.intersectsSphere(this.playerSphere)) {
                touchingAnyWall = true;
                break;
            }
        }

        // Grace Period & Warning Logic
        if (touchingAnyWall) {
            if (!this.isCollidingWithWall) {
                this.isCollidingWithWall = true;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('warning');
                this.notify('⚠️ Warning: You cannot walk through walls! Step back immediately!', 'warning');
            } else {
                this.wallCollisionTimer += deltaTime;

                if (this.wallCollisionTimer >= this.wallGracePeriod) {
                    this.isWaitingForPhysicalReturn = true;
                    this.isCollidingWithWall = false;
                    this.wallCollisionTimer = 0;
                    this.setPlayerVisualState('warning');
                    this.notify('⛔ Wall penalty! Turn around and physically walk back to the green Start Pad.', 'error');
                    return;
                }
            }
        } else {
            if (this.isCollidingWithWall) {
                this.isCollidingWithWall = false;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('normal');
                this.notify('Safe! You stepped back into the path.', 'info');
            }
        }

        // Win Condition
        const distToEnd = new THREE.Vector2(this.playerSphere.center.x - this.endPoint.x, this.playerSphere.center.z - this.endPoint.z).length();
        const goalThreshold = Math.min(this.cellSizeX, this.cellSizeZ) * 0.6;
        if (distToEnd < goalThreshold) {
            this.onWin();
        }
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
}
