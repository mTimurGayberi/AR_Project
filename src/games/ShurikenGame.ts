import * as THREE from 'three';
import { BaseShootingGame, ShootingTargetEntry } from '../core/BaseShootingGame';
import { soundManager } from '../utils/SoundManager';
import { uiManager } from '../ui/UIManager';

export interface ShurikenConfig {
    maxAmmo?: number;         // Number of projectiles (default: 12)
    projectileSpeed?: number; // Throw speed in m/s (default: 11.5 m/s)
}

interface DecoySpawnSpec {
    posX: number;
    posY: number;
    posZ: number;
    planeSize: number;
    ring: 'NEAR' | 'MID' | 'FAR';
    colorHex: number;
    phaseOffset: number;
}

/**
 * ShurikenGame
 * 
 * Column 2 (SHOOTING) — Game #2: Sensei Shuriken Throw Trial.
 * Inherits shared crosshair, shoot button, projectile ballistics, and ammo/hit logic from `BaseShootingGame`.
 * 
 * Progressive 3-Wave Shooting Range Gameplay:
 * - Line 1 (`NEAR`, z = -1.45m): 3 static decoys appear first.
 * - Line 2 (`MID`,  z = -2.15m): Appears only after Line 1 is destroyed. Decoys bob UP and DOWN!
 * - Line 3 (`FAR`,  z = -2.85m): Appears only after Line 2 is destroyed. Decoys weave UP/DOWN and LEFT/RIGHT
 *   while facing the player's current position!
 */
export class ShurikenGame extends BaseShootingGame {
    // #region MOVEMENT CONFIGURATION
    public midWaveVerticalAmp: number = 0.24;   // +/- 24cm up & down movement for Line 2
    public midWaveVerticalSpeed: number = 2.1;  // Speed of Line 2 vertical bobbing

    public farWaveHorizontalAmp: number = 0.28; // +/- 28cm left & right movement for Line 3
    public farWaveVerticalAmp: number = 0.22;   // +/- 22cm up & down movement for Line 3
    public farWaveSpeedX: number = 1.85;
    public farWaveSpeedY: number = 2.45;
    // #endregion

    private currentWave: 'NEAR' | 'MID' | 'FAR' = 'NEAR';
    private waveAnimTime: number = 0;
    private playerLocalLookPos: THREE.Vector3 = new THREE.Vector3();

    /**
     * 9 Decoys grouped into 3 Sequential Lines (3 per line).
     */
    private readonly decoySpecs: DecoySpawnSpec[] = [
        // Line 1: Front Row (NEAR — 1.45m ahead, STATIC)
        { posX: -0.52, posY: 0.98, posZ: -1.45, planeSize: 0.36, ring: 'NEAR', colorHex: 0x38bdf8, phaseOffset: 0.0 },
        { posX:  0.00, posY: 0.98, posZ: -1.45, planeSize: 0.36, ring: 'NEAR', colorHex: 0x38bdf8, phaseOffset: 2.1 },
        { posX:  0.52, posY: 0.98, posZ: -1.45, planeSize: 0.36, ring: 'NEAR', colorHex: 0x38bdf8, phaseOffset: 4.2 },

        // Line 2: Middle Row (MID — 2.15m ahead, moves UP & DOWN)
        { posX: -0.56, posY: 1.18, posZ: -2.15, planeSize: 0.34, ring: 'MID',  colorHex: 0xfbbf24, phaseOffset: 0.0 },
        { posX:  0.00, posY: 1.18, posZ: -2.15, planeSize: 0.34, ring: 'MID',  colorHex: 0xfbbf24, phaseOffset: 2.1 },
        { posX:  0.56, posY: 1.18, posZ: -2.15, planeSize: 0.34, ring: 'MID',  colorHex: 0xfbbf24, phaseOffset: 4.2 },

        // Line 3: Back Row (FAR — 2.85m ahead, moves UP/DOWN & LEFT/RIGHT facing player)
        { posX: -0.60, posY: 1.32, posZ: -2.85, planeSize: 0.32, ring: 'FAR',  colorHex: 0xf43f5e, phaseOffset: 0.0 },
        { posX:  0.00, posY: 1.32, posZ: -2.85, planeSize: 0.32, ring: 'FAR',  colorHex: 0xf43f5e, phaseOffset: 2.1 },
        { posX:  0.60, posY: 1.32, posZ: -2.85, planeSize: 0.32, ring: 'FAR',  colorHex: 0xf43f5e, phaseOffset: 4.2 },
    ];

    constructor(config?: ShurikenConfig) {
        super('game_02_shuriken', 'Shuriken Throw Trial', 'item_02_shuriken_gem', 'Shuriken Gem');

        this.shootingMode = 'TAP';
        this.maxAmmo = config?.maxAmmo ?? 12;
        this.maxActiveProjectiles = 3;   // Max 3 projectiles in scene at once
        this.fireCooldown = 0.45;        // 0.45s delay between shots
        this.projectileLifetime = 3.0;   // Auto-destroy projectiles after 3.0s
        this.projectileSpeed = config?.projectileSpeed ?? 11.5;
        this.gravity = 0.9;
    }

    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.buildNineDecoyPlanes();
        this.buildRewardGemNode(new THREE.Vector3(0, 1.05, -1.35));

        const targetParent = parentContainer?.element || parentContainer;
        if (targetParent && typeof targetParent.add === 'function') {
            targetParent.add(this.container);
        }

        console.log('[ShurikenGame] Initialized 3-Wave Progressive Shooting Range (Near -> Mid -> Far).');
    }

    private addLighting(): void {
        const ambient = new THREE.AmbientLight(0xffffff, 1.4);
        this.container.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
        dirLight.position.set(2, 6, 4);
        this.container.add(dirLight);
    }

    private buildNineDecoyPlanes(): void {
        this.targets = [];

        for (let i = 0; i < this.decoySpecs.length; i++) {
            const spec = this.decoySpecs[i];
            const posX = spec.posX;
            const posY = spec.posY;
            const posZ = spec.posZ;

            const decoyGroup = new THREE.Group();
            decoyGroup.name = `ShurikenDecoy_${i}_${spec.ring}`;
            decoyGroup.position.set(posX, posY, posZ);
            decoyGroup.lookAt(0, posY, 0);

            const planeGeo = new THREE.PlaneGeometry(spec.planeSize, spec.planeSize);
            const planeMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                emissive: spec.colorHex,
                emissiveIntensity: 0.25,
                roughness: 0.4,
                side: THREE.DoubleSide
            });
            const planeMesh = new THREE.Mesh(planeGeo, planeMat);
            decoyGroup.add(planeMesh);

            const edgeGeo = new THREE.EdgesGeometry(planeGeo);
            const edgeMat = new THREE.MeshBasicMaterial({ color: spec.colorHex });
            const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
            decoyGroup.add(edgeLines);

            const bullseyeGeo = new THREE.PlaneGeometry(spec.planeSize * 0.38, spec.planeSize * 0.38);
            const bullseyeMat = new THREE.MeshBasicMaterial({
                color: spec.colorHex,
                side: THREE.DoubleSide
            });
            const bullseyeMesh = new THREE.Mesh(bullseyeGeo, bullseyeMat);
            bullseyeMesh.position.z = 0.005;
            decoyGroup.add(bullseyeMesh);

            // Only show Line 1 (NEAR) initially!
            decoyGroup.visible = spec.ring === 'NEAR';

            this.targetsGroup.add(decoyGroup);

            const entry: ShootingTargetEntry = {
                id: i,
                mesh: decoyGroup,
                centerLocalPos: new THREE.Vector3(posX, posY, posZ),
                hitRadius: spec.planeSize * 0.62,
                isHit: false,
                distanceRing: spec.ring
            };
            this.targets.push(entry);
        }
    }

    /**
     * Activates a specific wave ('NEAR', 'MID', or 'FAR') and hides inactive waves.
     */
    private activateWave(wave: 'NEAR' | 'MID' | 'FAR'): void {
        this.currentWave = wave;
        this.waveAnimTime = 0;

        for (let i = 0; i < this.targets.length; i++) {
            const target = this.targets[i];
            const spec = this.decoySpecs[i];
            target.mesh.position.set(spec.posX, spec.posY, spec.posZ);
            target.centerLocalPos.set(spec.posX, spec.posY, spec.posZ);
            target.mesh.visible = (!target.isHit && target.distanceRing === wave);
        }
    }

    /**
     * Override target hit to advance from Line 1 (NEAR) -> Line 2 (MID) -> Line 3 (FAR)!
     */
    protected override handleTargetHit(target: ShootingTargetEntry): void {
        super.handleTargetHit(target);

        if (this.hitsCount >= this.targets.length) {
            return; // All 9 destroyed -> BaseShootingGame already spawned Reward Gem
        }

        // Check if all 3 decoys in the current wave have been destroyed
        let currentWaveRemaining = 0;
        for (let i = 0; i < this.targets.length; i++) {
            if (this.targets[i].distanceRing === this.currentWave && !this.targets[i].isHit) {
                currentWaveRemaining++;
            }
        }

        if (currentWaveRemaining === 0) {
            if (this.currentWave === 'NEAR') {
                this.activateWave('MID');
                uiManager.shootingUI.showWave2Unlocked();
            } else if (this.currentWave === 'MID') {
                this.activateWave('FAR');
                uiManager.shootingUI.showWave3Unlocked();
            }
        }
    }

    /**
     * Animates the active wave's decoys and keeps them oriented toward the player's position.
     */
    protected override onShootingUpdate(deltaTime: number): void {
        if (this.phase !== 'ACTIVE_SHOOTING') return;

        this.waveAnimTime += deltaTime;

        // Track player's current local position so moving decoys face the player
        if (this.camera) {
            this.container.updateMatrixWorld(true);
            this.camera.getWorldPosition(this.tempWorldPos);
            this.playerLocalLookPos.copy(this.tempWorldPos);
            this.container.worldToLocal(this.playerLocalLookPos);
        } else {
            this.playerLocalLookPos.set(0, 1.2, 0);
        }

        for (let i = 0; i < this.targets.length; i++) {
            const target = this.targets[i];
            if (target.isHit || !target.mesh.visible) continue;

            const spec = this.decoySpecs[i];

            if (target.distanceRing === 'MID') {
                // Line 2: Move UP and DOWN
                const newY = spec.posY + Math.sin(this.waveAnimTime * this.midWaveVerticalSpeed + spec.phaseOffset) * this.midWaveVerticalAmp;
                target.mesh.position.set(spec.posX, newY, spec.posZ);
                target.centerLocalPos.copy(target.mesh.position);
                target.mesh.lookAt(this.playerLocalLookPos.x, newY, this.playerLocalLookPos.z);
            } else if (target.distanceRing === 'FAR') {
                // Line 3: Move UP/DOWN and LEFT/RIGHT relative to player position
                const offsetX = Math.cos(this.waveAnimTime * this.farWaveSpeedX + spec.phaseOffset) * this.farWaveHorizontalAmp;
                const offsetY = Math.sin(this.waveAnimTime * this.farWaveSpeedY + spec.phaseOffset) * this.farWaveVerticalAmp;
                const newX = spec.posX + offsetX;
                const newY = spec.posY + offsetY;

                target.mesh.position.set(newX, newY, spec.posZ);
                target.centerLocalPos.copy(target.mesh.position);
                // Orient decoy plane toward the player's current position in the room
                target.mesh.lookAt(this.playerLocalLookPos.x, this.playerLocalLookPos.y, this.playerLocalLookPos.z);
            }
        }
    }

    public override setPlaced(placed: boolean): void {
        super.setPlaced(placed);
        if (!placed) {
            this.updateShootingUIVisibility();
        }
    }

    public override restartTrial(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.remainingAmmo = this.maxAmmo;
        this.hitsCount = 0;

        this.clearActiveProjectiles();
        this.collectible.reset();
        this.gemWrapper.visible = false;

        for (let i = 0; i < this.targets.length; i++) {
            this.targets[i].isHit = false;
        }

        // Start with only Line 1 (NEAR) visible!
        this.activateWave('NEAR');

        this.resetTimer();
        this.startTimer();
        soundManager.stopOrbLoop();
        if (this.isPlaced && this.container.visible) {
            soundManager.playLevelStart();
        }

        this.phase = 'ACTIVE_SHOOTING';
        this.bindShootingUIListeners();
        this.updateShootingUIVisibility();
        this.syncRestartAvailability(true);

        uiManager.shootingUI.showShurikenStart(this.maxAmmo);
    }

    public override onWin(): void {
        super.onWin();
        uiManager.shootingUI.showShurikenVictory();
    }
}
