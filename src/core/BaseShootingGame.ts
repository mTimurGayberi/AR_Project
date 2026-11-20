import * as THREE from 'three';
import { BaseMiniGame } from './BaseMiniGame';
import { CollectibleItem, CollectibleConfig } from './CollectibleItem';
import { soundManager } from '../utils/SoundManager';
import { uiManager } from '../ui/UIManager';

export type ShootingMode = 'TAP' | 'HOLD_CHARGE';

export type ShootingGamePhase =
    | 'WAITING_FOR_PLACEMENT'
    | 'ACTIVE_SHOOTING'
    | 'OUT_OF_AMMO_FAILED'
    | 'REWARD_READY'
    | 'WON';

export interface ActiveProjectile {
    mesh: THREE.Object3D;
    velocityLocal: THREE.Vector3;
    age: number;
    maxLifetime: number;
    hitRadius: number;
}

export interface ShootingTargetEntry {
    id: number;
    mesh: THREE.Object3D;
    centerLocalPos: THREE.Vector3;
    hitRadius: number;
    isHit: boolean;
    distanceRing: 'NEAR' | 'MID' | 'FAR';
}

/**
 * BaseShootingGame
 * 
 * Pure 3D Three.js abstract base class for all Column 2 (SHOOTING) mini-games.
 * Delegates all 2D HTML/CSS UI (crosshair, shoot button, charge bar, ammo badge, and notifications)
 * to `uiManager.shootingUI` (`ShootingUIController`).
 */
export abstract class BaseShootingGame extends BaseMiniGame {
    // #region SHARED SHOOTING CONFIGURATION
    public shootingMode: ShootingMode = 'TAP';
    public maxAmmo: number = 12;
    public maxActiveProjectiles: number = 3;    // Max 3 projectiles in scene at the same time
    public fireCooldown: number = 0.45;         // Minimum delay in seconds between shots
    public projectileLifetime: number = 3.0;    // Destroy projectile after 3.0 seconds
    public projectileSpeed: number = 11.0;      // Default speed for TAP mode (m/s)
    public minChargeSpeed: number = 4.0;        // Min speed for HOLD_CHARGE mode (m/s)
    public maxChargeSpeed: number = 14.0;       // Max speed for HOLD_CHARGE mode (m/s)
    public maxChargeTime: number = 1.25;        // Seconds to reach 100% charge
    public gravity: number = 1.8;               // Downward acceleration (m/s^2)
    public projectileRadius: number = 0.07;     // Small red orb placeholder radius (7cm)
    public projectileColor: number = 0xff2222;  // Glowing red orb placeholder color
    // #endregion

    // #region SHARED SHOOTING STATE
    protected phase: ShootingGamePhase = 'WAITING_FOR_PLACEMENT';
    protected remainingAmmo: number = 12;
    protected cooldownTimer: number = 0;
    protected projectiles: ActiveProjectile[] = [];
    protected targets: ShootingTargetEntry[] = [];
    protected hitsCount: number = 0;
    protected isTrialWon: boolean = false;

    protected isCharging: boolean = false;
    protected currentChargeTime: number = 0;
    // #endregion

    // #region AR CAMERA, PLACEMENT & RESTART LIFECYCLE
    public isPlaced: boolean = false;
    public onRestartAvailabilityChanged?: (canRestart: boolean) => void;
    private lastCanRestartState: boolean = false;

    protected camera: THREE.Camera | null = null;
    protected tempWorldPos: THREE.Vector3 = new THREE.Vector3();
    protected tempWorldDir: THREE.Vector3 = new THREE.Vector3();
    protected tempLocalPos: THREE.Vector3 = new THREE.Vector3();
    // #endregion

    // #region 3D GROUPS & REWARD GEM
    public collectible: CollectibleItem;
    protected gemWrapper: THREE.Group = new THREE.Group();
    protected projectilesGroup: THREE.Group = new THREE.Group();
    protected targetsGroup: THREE.Group = new THREE.Group();
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
            pickupRadius: 1.35,
            spinSpeedY: 1.8,
            spinSpeedX: 0,
            enableFloating: true,
            floatAmplitude: 0.08,
            ...collectibleConfig
        });

        this.projectilesGroup.name = `${id}_Projectiles`;
        this.targetsGroup.name = `${id}_Targets`;
        this.container.add(this.targetsGroup);
        this.container.add(this.projectilesGroup);
    }

    // #region UI CONTROLLER BINDING
    protected bindShootingUIListeners(): void {
        uiManager.shootingUI.onShootButtonDown = () => {
            if (this.isActive && this.container.visible) {
                this.handleShootButtonDown();
            }
        };
        uiManager.shootingUI.onShootButtonUp = () => {
            if (this.isActive && this.container.visible) {
                this.handleShootButtonUp();
            }
        };
    }

    public updateShootingUIVisibility(): void {
        const shouldShow = this.isActive && this.isPlaced && this.container.visible && this.phase === 'ACTIVE_SHOOTING';
        uiManager.shootingUI.setVisible(shouldShow, this.shootingMode === 'HOLD_CHARGE');
        if (shouldShow) {
            this.refreshAmmoBadgeText();
            this.refreshShootButtonVisualState();
        }
    }

    protected refreshAmmoBadgeText(): void {
        uiManager.shootingUI.updateAmmoAndTargets(
            this.remainingAmmo,
            this.maxAmmo,
            this.hitsCount,
            this.targets.length
        );
    }

    protected refreshShootButtonVisualState(): void {
        uiManager.shootingUI.setShootButtonReady(this.canFireNow());
    }
    // #endregion

    // #region SHOOTING MECHANICS (TAP & HOLD-TO-CHARGE)
    protected canFireNow(): boolean {
        if (this.phase !== 'ACTIVE_SHOOTING' || this.remainingAmmo <= 0) return false;
        if (this.cooldownTimer > 0) return false;
        if (this.projectiles.length >= this.maxActiveProjectiles) return false;
        return true;
    }

    private handleShootButtonDown(): void {
        if (!this.canFireNow()) return;

        if (this.shootingMode === 'TAP') {
            this.fireProjectile(this.projectileSpeed);
        } else {
            this.isCharging = true;
            this.currentChargeTime = 0;
        }
    }

    private handleShootButtonUp(): void {
        if (this.shootingMode === 'HOLD_CHARGE' && this.isCharging) {
            this.isCharging = false;
            const ratio = Math.min(1, this.currentChargeTime / this.maxChargeTime);
            const launchSpeed = this.minChargeSpeed + ratio * (this.maxChargeSpeed - this.minChargeSpeed);
            uiManager.shootingUI.setChargePercent(0);
            if (this.canFireNow()) {
                this.fireProjectile(launchSpeed);
            }
        }
    }

    protected fireProjectile(speed: number): void {
        if (!this.camera || !this.canFireNow()) return;

        this.remainingAmmo--;
        this.cooldownTimer = this.fireCooldown;
        this.refreshAmmoBadgeText();
        this.refreshShootButtonVisualState();

        this.container.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);

        this.camera.getWorldPosition(this.tempWorldPos);
        this.camera.getWorldDirection(this.tempWorldDir);
        this.tempWorldDir.normalize();

        const spawnWorld = this.tempWorldPos.clone().addScaledVector(this.tempWorldDir, 0.25);
        const targetWorld = spawnWorld.clone().addScaledVector(this.tempWorldDir, speed);

        const spawnLocal = this.container.worldToLocal(spawnWorld);
        const targetLocal = this.container.worldToLocal(targetWorld);
        const velocityLocal = targetLocal.sub(spawnLocal);

        const mesh = this.createProjectileMesh();
        mesh.position.copy(spawnLocal);
        this.projectilesGroup.add(mesh);

        this.projectiles.push({
            mesh,
            velocityLocal,
            age: 0,
            maxLifetime: this.projectileLifetime,
            hitRadius: this.projectileRadius
        });

        soundManager.playSimonTone(2, false);
        this.vibrate(30);
    }

    protected createProjectileMesh(): THREE.Object3D {
        const geo = new THREE.SphereGeometry(this.projectileRadius, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: this.projectileColor,
            emissive: this.projectileColor,
            emissiveIntensity: 0.9,
            roughness: 0.2
        });
        return new THREE.Mesh(geo, mat);
    }

    protected destroyProjectileAtIndex(index: number): void {
        const proj = this.projectiles[index];
        if (!proj) return;
        this.projectilesGroup.remove(proj.mesh);
        proj.mesh.traverse((child: any) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach((m: any) => m.dispose());
                } else if (child.material) {
                    child.material.dispose();
                }
            }
        });
        this.projectiles.splice(index, 1);
    }

    protected clearActiveProjectiles(): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.destroyProjectileAtIndex(i);
        }
        this.projectiles = [];
        this.cooldownTimer = 0;
        this.refreshShootButtonVisualState();
    }
    // #endregion

    // #region SHARED PHYSICS & TARGET HIT DETECTION LOOP
    protected onUpdate(deltaTime: number): void {
        if (!this.isPlaced) return;

        if (this.cooldownTimer > 0) {
            this.cooldownTimer = Math.max(0, this.cooldownTimer - deltaTime);
            if (this.cooldownTimer === 0) {
                this.refreshShootButtonVisualState();
            }
        }

        if (this.shootingMode === 'HOLD_CHARGE' && this.isCharging && this.phase === 'ACTIVE_SHOOTING') {
            this.currentChargeTime = Math.min(this.maxChargeTime, this.currentChargeTime + deltaTime);
            const pct = (this.currentChargeTime / this.maxChargeTime) * 100;
            uiManager.shootingUI.setChargePercent(pct);
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.age += deltaTime;

            proj.velocityLocal.y -= this.gravity * deltaTime;

            proj.mesh.position.x += proj.velocityLocal.x * deltaTime;
            proj.mesh.position.y += proj.velocityLocal.y * deltaTime;
            proj.mesh.position.z += proj.velocityLocal.z * deltaTime;

            let hitAnyTarget = false;
            for (let t = 0; t < this.targets.length; t++) {
                const target = this.targets[t];
                if (target.isHit || !target.mesh.visible) continue;

                const dist = proj.mesh.position.distanceTo(target.centerLocalPos);
                if (dist <= target.hitRadius + proj.hitRadius) {
                    hitAnyTarget = true;
                    this.handleTargetHit(target);
                    break;
                }
            }

            if (hitAnyTarget || proj.age >= proj.maxLifetime || proj.mesh.position.y < -0.5) {
                this.destroyProjectileAtIndex(i);
                this.refreshShootButtonVisualState();
            }
        }

        if (
            this.phase === 'ACTIVE_SHOOTING' &&
            this.remainingAmmo <= 0 &&
            this.projectiles.length === 0 &&
            this.hitsCount < this.targets.length
        ) {
            this.handleOutOfAmmoFailure();
        }

        if (this.phase === 'REWARD_READY' && !this.isTrialWon && this.gemWrapper.visible) {
            if (this.camera) {
                this.container.updateMatrixWorld(true);
                this.camera.getWorldPosition(this.tempWorldPos);
                this.tempLocalPos.copy(this.tempWorldPos);
                this.container.worldToLocal(this.tempLocalPos);
            }
            const collected = this.collectible.update(deltaTime, this.tempLocalPos, this.camera);
            if (collected) {
                this.onWin();
            }
        }

        this.onShootingUpdate(deltaTime);
    }

    protected onShootingUpdate(_deltaTime: number): void {}

    protected handleTargetHit(target: ShootingTargetEntry): void {
        target.isHit = true;
        target.mesh.visible = false;
        this.hitsCount++;
        this.refreshAmmoBadgeText();

        soundManager.playSimonTone(this.hitsCount % 4, false);
        this.vibrate(60);

        if (this.hitsCount >= this.targets.length) {
            this.clearActiveProjectiles();
            this.phase = 'REWARD_READY';
            this.updateShootingUIVisibility();
            this.gemWrapper.visible = true;
            soundManager.startOrbLoop();
            this.vibrate([120, 60, 160]);
            uiManager.shootingUI.showAllTargetsCleared(this.targets.length);
        } else {
            uiManager.shootingUI.showTargetHit(this.hitsCount, this.targets.length);
        }
    }

    protected handleOutOfAmmoFailure(): void {
        this.phase = 'OUT_OF_AMMO_FAILED';
        this.stopTimer();
        this.updateShootingUIVisibility();
        soundManager.playWallCollision();
        this.vibrate([250, 80, 250]);
        this.syncRestartAvailability(true);
        uiManager.shootingUI.showOutOfAmmo(this.hitsCount, this.targets.length);
    }
    // #endregion

    // #region SHARED CAMERA, PLACEMENT & GEM HELPERS
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    public canRestart(): boolean {
        if (!this.isPlaced) return false;
        if (this.isTrialWon || this.isCompleted) return true;
        return this.phase !== 'WAITING_FOR_PLACEMENT';
    }

    protected syncRestartAvailability(force: boolean = false): void {
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
            this.clearActiveProjectiles();
            this.phase = 'WAITING_FOR_PLACEMENT';
            this.gemWrapper.visible = false;
            this.updateShootingUIVisibility();
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
        this.bindShootingUIListeners();
        if (this.isPlaced) {
            this.restartTrial();
        } else {
            this.phase = 'WAITING_FOR_PLACEMENT';
            this.stopTimer();
            this.updateShootingUIVisibility();
            this.syncRestartAvailability(true);
        }
    }

    public override reset(): void {
        this.restartTrial();
    }

    public abstract restartTrial(): void;

    protected buildRewardGemNode(localPosition: THREE.Vector3): void {
        this.gemWrapper.name = `${this.id}_RewardGem`;
        this.gemWrapper.position.copy(localPosition);
        this.gemWrapper.visible = false;

        const geo = new THREE.IcosahedronGeometry(0.22, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffc800,
            emissive: 0xb45309,
            emissiveIntensity: 0.4,
            roughness: 0.15,
            metalness: 0.6
        });
        const gemMesh = new THREE.Mesh(geo, mat);
        this.gemWrapper.add(gemMesh);
        this.container.add(this.gemWrapper);

        this.collectible.bindModel(this.gemWrapper);
        this.gemWrapper.visible = false;

        if (typeof window !== 'undefined') {
            const raycaster = new THREE.Raycaster();
            const pointerNDC = new THREE.Vector2();
            window.addEventListener('pointerdown', (e: PointerEvent) => {
                if (!this.isActive || !this.isPlaced || !this.container.visible) return;
                if (this.phase !== 'REWARD_READY' || !this.gemWrapper.visible || !this.camera) return;
                const targetEl = e.target as HTMLElement | null;
                if (targetEl && targetEl.closest && targetEl.closest('#game-hud, #shooting-ui-overlay, .zcomponent-zappar-three-place-ui-button')) {
                    return;
                }
                pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
                pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(pointerNDC, this.camera);
                const hits = raycaster.intersectObject(this.gemWrapper, true);
                if (hits.length > 0) {
                    this.collectible.collect();
                    this.onWin();
                }
            });
        }
    }

    public override onWin(): void {
        if (this.isTrialWon) return;
        this.isTrialWon = true;
        this.phase = 'WON';
        this.updateShootingUIVisibility();

        soundManager.stopOrbLoop();
        soundManager.playLevelFinish();
        this.vibrate([140, 70, 180]);

        super.onWin();
        this.isActive = true;
        this.syncRestartAvailability(true);
    }

    protected vibrate(pattern: number | number[]): void {
        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
            try { (navigator as any).vibrate(pattern); } catch (e) {}
        }
    }
    // #endregion
}
