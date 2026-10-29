import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';

export interface MazeConfig {
    wallGracePeriod?: number; // Duration in seconds (e.g. 2.0s) before penalty reset
    cellSize?: number;        // Size of each grid cell in 3D world units
    moveSpeed?: number;       // Units per second
}

/**
 * MazeGame
 * 
 * Game #1 in the 10 mini-game quest.
 * Features:
 * - 3D procedural maze with start pad and end pedestal
 * - Player pawn (glowing sphere)
 * - Wall collision grace period (1-3 seconds warning before reset)
 * - Touch / drag & keyboard controls
 * - Special Item collection on reaching the goal
 */
export class MazeGame extends BaseMiniGame {
    public wallGracePeriod: number = 2.0;
    public cellSize: number = 1.0;
    public moveSpeed: number = 2.5;

    // Positions in local container coordinates
    private startPoint: THREE.Vector3 = new THREE.Vector3();
    private endPoint: THREE.Vector3 = new THREE.Vector3();

    // 3D Visual Objects
    private playerMesh!: THREE.Mesh;
    private playerMaterial!: THREE.MeshStandardMaterial;
    private playerSphere: THREE.Sphere = new THREE.Sphere(new THREE.Vector3(), 0.25);
    private goalItemMesh!: THREE.Mesh;
    private wallBoundingBoxes: THREE.Box3[] = [];

    // Collision & Grace Period State
    private isCollidingWithWall: boolean = false;
    private wallCollisionTimer: number = 0;
    private normalPlayerColor: number = 0x00d2ff; // Bright cyan
    private warningPlayerColor: number = 0xff2222; // Glowing red warning

    // Input state
    private inputVelocity: THREE.Vector2 = new THREE.Vector2();

    // Maze Grid (1 = Wall, 0 = Path, S = Start, E = End)
    // 9x9 layout with multiple paths
    private mazeGrid: number[][] = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 1, 0, 0, 0, 0, 1], // (1, 1) is Start
        [1, 1, 0, 1, 0, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 1],
        [1, 0, 1, 1, 0, 1, 0, 1, 1],
        [1, 0, 0, 1, 0, 0, 0, 0, 1],
        [1, 1, 0, 1, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 1, 0, 1], // (7, 7) is End
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    constructor(config?: MazeConfig) {
        super('game_01_maze', 'Sensei Maze Trial', 'item_01_wind_gem');

        if (config?.wallGracePeriod !== undefined) this.wallGracePeriod = config.wallGracePeriod;
        if (config?.cellSize !== undefined) this.cellSize = config.cellSize;
        if (config?.moveSpeed !== undefined) this.moveSpeed = config.moveSpeed;
    }

    public init(parentContainer: THREE.Group | any): void {
        this.buildMaze();
        this.createStartAndEndPads();
        this.createPlayer();
        this.setupInputListeners();

        // Attach this mini-game's 3D container to the AR world / ground anchor
        if (parentContainer && parentContainer.add) {
            parentContainer.add(this.container);
        }

        console.log(`[MazeGame] Initialized. Wall grace period: ${this.wallGracePeriod}s`);
    }

    private buildMaze(): void {
        const rows = this.mazeGrid.length;
        const cols = this.mazeGrid[0].length;
        const offsetX = (cols * this.cellSize) / 2;
        const offsetZ = (rows * this.cellSize) / 2;

        const wallHeight = 0.8;
        const wallGeometry = new THREE.BoxGeometry(this.cellSize, wallHeight, this.cellSize);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x243b55,
            roughness: 0.4,
            metalness: 0.6
        });

        // Floor plane
        const floorGeo = new THREE.PlaneGeometry(cols * this.cellSize, rows * this.cellSize);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.8
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(0, 0, 0);
        this.container.add(floorMesh);

        // Instantiate walls and bounding boxes
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posX = c * this.cellSize - offsetX + this.cellSize / 2;
                const posZ = r * this.cellSize - offsetZ + this.cellSize / 2;

                if (this.mazeGrid[r][c] === 1) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(posX, wallHeight / 2, posZ);
                    this.container.add(wall);

                    // Add bounding box for collision
                    const box = new THREE.Box3();
                    box.setFromCenterAndSize(
                        wall.position,
                        new THREE.Vector3(this.cellSize, wallHeight * 2, this.cellSize)
                    );
                    this.wallBoundingBoxes.push(box);
                } else if (r === 1 && c === 1) {
                    // Start position
                    this.startPoint.set(posX, 0.25, posZ);
                } else if (r === 7 && c === 7) {
                    // End position
                    this.endPoint.set(posX, 0.25, posZ);
                }
            }
        }
    }

    private createStartAndEndPads(): void {
        // Start pad (Green circle)
        const startPadGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16);
        const startPadMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const startPad = new THREE.Mesh(startPadGeo, startPadMat);
        startPad.position.set(this.startPoint.x, 0.02, this.startPoint.z);
        this.container.add(startPad);

        // End pad / Pedestal (Gold cylinder)
        const endPadGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16);
        const endPadMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8, roughness: 0.2 });
        const endPad = new THREE.Mesh(endPadGeo, endPadMat);
        endPad.position.set(this.endPoint.x, 0.05, this.endPoint.z);
        this.container.add(endPad);

        // Special Item 3D Mesh floating and rotating over end pad
        const itemGeo = new THREE.OctahedronGeometry(0.25, 0);
        const itemMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xff9900,
            emissiveIntensity: 0.6,
            roughness: 0.1
        });
        this.goalItemMesh = new THREE.Mesh(itemGeo, itemMat);
        this.goalItemMesh.position.set(this.endPoint.x, 0.5, this.endPoint.z);
        this.container.add(this.goalItemMesh);
    }

    private createPlayer(): void {
        const radius = 0.2;
        const playerGeo = new THREE.SphereGeometry(radius, 24, 24);
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: this.normalPlayerColor,
            emissive: this.normalPlayerColor,
            emissiveIntensity: 0.4,
            roughness: 0.2
        });
        this.playerMesh = new THREE.Mesh(playerGeo, this.playerMaterial);
        this.playerSphere.radius = radius;
        this.resetPlayerPosition();
        this.container.add(this.playerMesh);
    }

    public resetPlayerPosition(): void {
        this.playerMesh.position.copy(this.startPoint);
        this.playerSphere.center.copy(this.playerMesh.position);
        this.inputVelocity.set(0, 0);
        this.isCollidingWithWall = false;
        this.wallCollisionTimer = 0;
        this.setPlayerVisualState('normal');
    }

    public override reset(): void {
        this.resetPlayerPosition();
        this.notify('Returned to start point.', 'info');
    }

    /**
     * Input method for mobile screen drag or virtual joystick
     */
    public setMovementInput(dx: number, dz: number): void {
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

        // Apply movement velocity
        if (this.inputVelocity.lengthSq() > 0.001) {
            const moveDeltaX = this.inputVelocity.x * this.moveSpeed * deltaTime;
            const moveDeltaZ = this.inputVelocity.y * this.moveSpeed * deltaTime;

            this.playerMesh.position.x += moveDeltaX;
            this.playerMesh.position.z += moveDeltaZ;
            this.playerSphere.center.copy(this.playerMesh.position);
        }

        // 1. Collision detection with walls
        let touchingAnyWall = false;
        for (const wallBox of this.wallBoundingBoxes) {
            if (wallBox.intersectsSphere(this.playerSphere)) {
                touchingAnyWall = true;
                break;
            }
        }

        // 2. Wall Warning & Grace Period Management
        if (touchingAnyWall) {
            if (!this.isCollidingWithWall) {
                // First instant of wall collision
                this.isCollidingWithWall = true;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('warning');
                this.notify('Warning: You cannot pass through walls! Step back immediately!', 'warning');
            } else {
                // Still inside wall - increment timer
                this.wallCollisionTimer += deltaTime;
                const timeLeft = Math.max(0, this.wallGracePeriod - this.wallCollisionTimer);

                // If player failed to step back within the grace period:
                if (this.wallCollisionTimer >= this.wallGracePeriod) {
                    this.onFail(`Wall penalty! You did not step back in time (${this.wallGracePeriod}s).`);
                    return;
                }
            }
        } else {
            // Player is free of walls
            if (this.isCollidingWithWall) {
                // Player stepped back safely in time!
                this.isCollidingWithWall = false;
                this.wallCollisionTimer = 0;
                this.setPlayerVisualState('normal');
                this.notify('Safe! You stepped back in time.', 'info');
            }
        }

        // 3. Win Condition: Reached the goal pad
        const distanceToGoal = this.playerMesh.position.distanceTo(this.endPoint);
        if (distanceToGoal < 0.4) {
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
            this.playerMaterial.emissiveIntensity = 0.4;
        }
    }

    private setupInputListeners(): void {
        // Desktop keyboard controls for easy development / testing
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

            // Touch / Drag controls for mobile screens
            let touchStartX = 0;
            let touchStartY = 0;
            let isTouching = false;

            window.addEventListener('touchstart', (e) => {
                if (e.touches.length > 0) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    isTouching = true;
                }
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                if (isTouching && e.touches.length > 0) {
                    const deltaX = (e.touches[0].clientX - touchStartX) / 50;
                    const deltaY = (e.touches[0].clientY - touchStartY) / 50;
                    this.setMovementInput(deltaX, deltaY);
                }
            }, { passive: true });

            window.addEventListener('touchend', () => {
                isTouching = false;
                this.setMovementInput(0, 0);
            });
        }
    }
}
