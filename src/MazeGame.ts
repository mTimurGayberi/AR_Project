import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';

export interface MazeConfig {
    wallGracePeriod?: number; // Duration in seconds (e.g. 2.0s) before penalty reset
    cellSize?: number;        // Size of each grid cell in meters (e.g. 1.6m for walkable AR corridors)
    wallHeight?: number;      // Height of walls in meters (e.g. 1.8m)
    moveSpeed?: number;       // Desktop dev simulation speed
}

/**
 * MazeGame
 * 
 * Game #1 in the 10 mini-game quest.
 * Features:
 * - 1:1 Room-scale walkable AR Maze: The player physically walks in reality with their phone!
 * - Player position is tracked directly via the AR phone camera's 6-DOF world position.
 * - Wall collision grace period (1-3 seconds warning before penalty).
 * - Physical Return-to-Start mechanic: When penalty occurs, player must physically walk back to the Start Pad.
 * - Semi-transparent neon AR walls for real-world safety (player can still see physical room).
 * - Desktop keyboard simulation fallback for easy testing on PC.
 */
export class MazeGame extends BaseMiniGame {
    public wallGracePeriod: number = 2.0;
    public cellSize: number = 1.6; // 1.6 meters wide for real-world walking
    public wallHeight: number = 1.8; // 1.8 meters human-height walls
    public moveSpeed: number = 2.5;

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

    // Collision & Grace Period State
    private isCollidingWithWall: boolean = false;
    private wallCollisionTimer: number = 0;
    private isWaitingForPhysicalReturn: boolean = false;
    private normalPlayerColor: number = 0x00d2ff; // Bright cyan
    private warningPlayerColor: number = 0xff2222; // Glowing red warning

    // Input state for desktop keyboard testing
    private inputVelocity: THREE.Vector2 = new THREE.Vector2();
    private isUsingKeyboard: boolean = false;

    // 7x7 Walkable Maze Grid (1 = Wall, 0 = Open Path)
    // S at (1, 1), E at (5, 5)
    private mazeGrid: number[][] = [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 1, 0, 0, 1], // (1, 1) is Start
        [1, 1, 0, 1, 0, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 1], // (5, 5) is End Goal
        [1, 1, 1, 1, 1, 1, 1],
    ];

    constructor(config?: MazeConfig) {
        super('game_01_maze', 'Sensei Maze Trial', 'item_01_wind_gem');

        if (config?.wallGracePeriod !== undefined) this.wallGracePeriod = config.wallGracePeriod;
        if (config?.cellSize !== undefined) this.cellSize = config.cellSize;
        if (config?.wallHeight !== undefined) this.wallHeight = config.wallHeight;
        if (config?.moveSpeed !== undefined) this.moveSpeed = config.moveSpeed;
    }

    /**
     * Link the AR phone camera to track physical real-world player walking
     */
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
        console.log('[MazeGame] AR Camera linked for 1:1 physical walking tracking.');
    }

    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.buildMaze();
        this.createStartAndEndPads();
        this.createPlayer();
        this.setupInputListeners();

        // Attach to Three.js Scene, Object3D, or ZComponent element
        if (parentContainer && typeof parentContainer.add === 'function') {
            parentContainer.add(this.container);
        } else if (parentContainer?.element && typeof parentContainer.element.add === 'function') {
            parentContainer.element.add(this.container);
        }

        console.log(`[MazeGame] Initialized human-scale walkable maze (${this.cellSize}m corridors).`);
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

    private buildMaze(): void {
        const rows = this.mazeGrid.length;
        const cols = this.mazeGrid[0].length;
        const offsetX = (cols * this.cellSize) / 2;
        const offsetZ = (rows * this.cellSize) / 2;

        const wallGeometry = new THREE.BoxGeometry(this.cellSize, this.wallHeight, this.cellSize);
        
        // Semi-transparent AR holographic walls so player can see real-world room obstacles
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.5,
            roughness: 0.2,
            metalness: 0.3,
            transparent: true,
            opacity: 0.75
        });

        // Floor guidelines
        const floorGeo = new THREE.PlaneGeometry(cols * this.cellSize, rows * this.cellSize);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            transparent: true,
            opacity: 0.4
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(0, 0, 0);
        this.container.add(floorMesh);

        // Build walls and bounding boxes
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posX = c * this.cellSize - offsetX + this.cellSize / 2;
                const posZ = r * this.cellSize - offsetZ + this.cellSize / 2;

                if (this.mazeGrid[r][c] === 1) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(posX, this.wallHeight / 2, posZ);
                    this.container.add(wall);

                    // Add bounding box for collision detection with player's body
                    const box = new THREE.Box3();
                    box.setFromCenterAndSize(
                        wall.position,
                        new THREE.Vector3(this.cellSize, this.wallHeight * 2, this.cellSize)
                    );
                    this.wallBoundingBoxes.push(box);
                } else if (r === 1 && c === 1) {
                    // Start position on the floor
                    this.startPoint.set(posX, 0, posZ);
                } else if (r === 5 && c === 5) {
                    // End position on the floor
                    this.endPoint.set(posX, 0, posZ);
                }
            }
        }
    }

    private createStartAndEndPads(): void {
        // Start pad (Green glowing floor ring)
        const startPadGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 32);
        const startPadMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.7
        });
        const startPad = new THREE.Mesh(startPadGeo, startPadMat);
        startPad.position.set(this.startPoint.x, 0.02, this.startPoint.z);
        this.container.add(startPad);

        // End pad / Pedestal (Gold cylinder)
        const endPadGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 32);
        const endPadMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff8800,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        const endPad = new THREE.Mesh(endPadGeo, endPadMat);
        endPad.position.set(this.endPoint.x, 0.05, this.endPoint.z);
        this.container.add(endPad);

        // Special Item 3D Mesh floating at eye height (~1.4m) over end pad
        const itemGeo = new THREE.OctahedronGeometry(0.35, 0);
        const itemMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8,
            roughness: 0.1
        });
        this.goalItemMesh = new THREE.Mesh(itemGeo, itemMat);
        this.goalItemMesh.position.set(this.endPoint.x, 1.4, this.endPoint.z);
        this.container.add(this.goalItemMesh);
    }

    private createPlayer(): void {
        // Visual pawn representation (visible on floor as player body footprint)
        const radius = 0.35; // 0.35m radius representing human body
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
        this.notify('Ready at Start Pad! Navigate through the maze corridors.', 'info');
    }

    public setMovementInput(dx: number, dz: number): void {
        this.isUsingKeyboard = true;
        this.inputVelocity.set(dx, dz);
        if (this.inputVelocity.lengthSq() > 1) {
            this.inputVelocity.normalize();
        }
    }

    protected onUpdate(deltaTime: number): void {
        // 1. Animate floating special item
        if (this.goalItemMesh) {
            this.goalItemMesh.rotation.y += deltaTime * 1.5;
            this.goalItemMesh.rotation.x += deltaTime * 0.5;
        }

        // 2. Track Player Position:
        // Physical Real-World Walking: Use AR Camera position
        if (this.camera && !this.isUsingKeyboard) {
            this.camera.getWorldPosition(this.tempWorldPos);
            this.tempLocalPos.copy(this.tempWorldPos);
            this.container.worldToLocal(this.tempLocalPos);

            // Project camera's X, Z position to the floor
            this.playerMesh.position.set(this.tempLocalPos.x, 0.05, this.tempLocalPos.z);
            this.playerSphere.center.set(this.tempLocalPos.x, 0.5, this.tempLocalPos.z);
        } else if (this.isUsingKeyboard && this.inputVelocity.lengthSq() > 0.001) {
            // Desktop fallback simulation
            const moveDeltaX = this.inputVelocity.x * this.moveSpeed * deltaTime;
            const moveDeltaZ = this.inputVelocity.y * this.moveSpeed * deltaTime;

            this.playerMesh.position.x += moveDeltaX;
            this.playerMesh.position.z += moveDeltaZ;
            this.playerSphere.center.set(this.playerMesh.position.x, 0.5, this.playerMesh.position.z);
        }

        // 3. Physical Return-to-Start Check:
        // If the player failed by staying inside a wall, they must physically walk back to Start
        if (this.isWaitingForPhysicalReturn) {
            const distToStart = new THREE.Vector2(this.playerSphere.center.x - this.startPoint.x, this.playerSphere.center.z - this.startPoint.z).length();
            if (distToStart < 1.0) {
                this.isWaitingForPhysicalReturn = false;
                this.reset();
                this.notify('✅ Returned to Start Pad! Maze restarted.', 'success');
            }
            return;
        }

        // 4. Wall Collision Check:
        let touchingAnyWall = false;
        for (const wallBox of this.wallBoundingBoxes) {
            if (wallBox.intersectsSphere(this.playerSphere)) {
                touchingAnyWall = true;
                break;
            }
        }

        // 5. Grace Period & Warning Logic
        if (touchingAnyWall) {
            if (!this.isCollidingWithWall) {
                // First instant entering the wall
                this.isCollidingWithWall = true;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('warning');
                this.notify('⚠️ Warning: You cannot walk through walls! Step back immediately!', 'warning');
            } else {
                // Increment timer while inside the wall
                this.wallCollisionTimer += deltaTime;

                if (this.wallCollisionTimer >= this.wallGracePeriod) {
                    // FAILED: Player stayed in the wall too long
                    this.isWaitingForPhysicalReturn = true;
                    this.isCollidingWithWall = false;
                    this.wallCollisionTimer = 0;
                    this.setPlayerVisualState('warning');
                    this.notify('⛔ Wall penalty! Turn around and physically walk back to the green Start Pad.', 'error');
                    return;
                }
            }
        } else {
            // Player is safely in the open corridor
            if (this.isCollidingWithWall) {
                // Stepped back in time!
                this.isCollidingWithWall = false;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('normal');
                this.notify('Safe! You stepped back into the path.', 'info');
            }
        }

        // 6. Win Condition: Physically reached the End Pad
        const distToEnd = new THREE.Vector2(this.playerSphere.center.x - this.endPoint.x, this.playerSphere.center.z - this.endPoint.z).length();
        if (distToEnd < 1.1) {
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
