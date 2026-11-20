import * as THREE from 'three';
import { BaseMemoryGame } from '../core/BaseMemoryGame';
import { soundManager } from '../utils/SoundManager';
import { uiManager } from '../ui/UIManager';

export interface SimonConfig {
    totalRounds?: number;            // Number of rounds to win (default: 3)
    startingSequenceLength?: number; // Sequence length in Round 1 (default: 3 -> 4 -> 5)
    flashDuration?: number;          // Seconds a lamp stays lit during sequence playback
    flashGap?: number;               // Seconds between lamp flashes in sequence playback
}

interface SimonLampSlot {
    index: number;
    name: string;
    offGlassColor: number;
    glowColor: number;
    rootGroup: THREE.Group;
    glassMaterials: (THREE.MeshBasicMaterial | THREE.MeshStandardMaterial)[];
    innerGlowCore: THREE.Mesh;
    innerCoreMat: THREE.MeshBasicMaterial;
    pointLight: THREE.PointLight;
    baseScale: THREE.Vector3;
}

interface SimonTableButton {
    index: number;
    name: string;
    baseColor: number;
    glowColor: number;
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    baseLocalY: number;
    flashTimer: number;
}

/**
 * SimonGame
 * 
 * Column 1 (MEMORY) — Game #1: Sensei Lantern & Button Table Trial.
 * Inherits shared memory sequence generation, step validation, camera tracking,
 * and reward gem management from `BaseMemoryGame`.
 */
export class SimonGame extends BaseMemoryGame {
    // #region CONFIGURATION & SIMON CONTROLS
    public totalRounds: number = 3;
    public startingSequenceLength: number = 3; // Round 1 = 3, Round 2 = 4, Round 3 = 5
    public flashDuration: number = 1.50;       // 1.5s per lamp flash so player has plenty of time to look around!
    public flashGap: number = 0.50;            // 0.5s pause between lamp flashes
    public lampHeightY: number = 1.45;         // Hang lanterns high in the air ABOVE the button table!

    public tableDistanceZ: number = -1.15;
    public tableHeightY: number = 0.80;
    // #endregion

    // #region 3D OBJECTS & STATE
    private lampsGroup: THREE.Group = new THREE.Group();
    private tableGroup: THREE.Group = new THREE.Group();
    private lampSlots: SimonLampSlot[] = [];
    private tableButtons: SimonTableButton[] = [];
    private buttonRaycastTargets: THREE.Object3D[] = [];

    private rawTemplateLanternNode: any = null;
    private isCustomLanternApplied: boolean = false;
    private lanternScanTimer: number = 0;

    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();

    private currentRound: number = 1;
    private playbackIndex: number = 0;
    private phaseTimer: number = 0;
    private isCurrentlyLit: boolean = false;
    private activeLitIndex: number = -1;
    private hasStartedAnyRound: boolean = false;
    // #endregion

    private readonly colorDefs = [
        {
            name: 'Red',
            buttonBaseColor: 0x991b1b,
            glowColor: 0xff1a1a,
            lampX: -1.35, lampZ: -0.85, lampRotY: 0.70,   // Left Hanging Lamp (above table)
            btnX: -0.15, btnZ: -0.12                      // Top-Left Table Button
        },
        {
            name: 'Blue',
            buttonBaseColor: 0x075985,
            glowColor: 0x00e1ff,
            lampX: -0.52, lampZ: -1.65, lampRotY: 0.25,   // Front-Left Hanging Lamp (above table)
            btnX:  0.15, btnZ: -0.12                      // Top-Right Table Button
        },
        {
            name: 'Green',
            buttonBaseColor: 0x065f46,
            glowColor: 0x00ff66,
            lampX:  0.52, lampZ: -1.65, lampRotY: -0.25,  // Front-Right Hanging Lamp (above table)
            btnX: -0.15, btnZ:  0.12                      // Bottom-Left Table Button
        },
        {
            name: 'Yellow',
            buttonBaseColor: 0x92400e,
            glowColor: 0xffe600,
            lampX:  1.35, lampZ: -0.85, lampRotY: -0.70,  // Right Hanging Lamp (above table)
            btnX:  0.15, btnZ:  0.12                      // Bottom-Right Table Button
        },
    ];

    constructor(config?: SimonConfig) {
        super('game_02_simon', 'Sensei Lantern Trial', 'item_02_memory_gem', 'Memory Gem', {
            pickupRadius: 1.35
        });

        if (config?.totalRounds !== undefined) this.totalRounds = config.totalRounds;
        if (config?.startingSequenceLength !== undefined) this.startingSequenceLength = config.startingSequenceLength;
        if (config?.flashDuration !== undefined) this.flashDuration = config.flashDuration;
        if (config?.flashGap !== undefined) this.flashGap = config.flashGap;
    }

    // #region INITIALIZATION, 4 SURROUNDING LAMPS & BUTTON TABLE BUILDER
    public init(parentContainer: THREE.Group | THREE.Scene | any): void {
        this.addLighting();
        this.buildSurroundingLamps();
        this.buildButtonTable();
        this.buildRewardGemNode(new THREE.Vector3(0, this.tableHeightY + 0.45, this.tableDistanceZ), false);
        this.setupTouchListeners();

        const targetParent = parentContainer?.element || parentContainer;
        if (targetParent && typeof targetParent.add === 'function') {
            targetParent.add(this.container);
        }

        console.log('[SimonGame] Initialized 4 Surrounding Lamps + 4-Button Table (extends BaseMemoryGame).');
    }

    private addLighting(): void {
        const ambient = new THREE.AmbientLight(0xffffff, 1.3);
        this.container.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
        keyLight.position.set(2, 5, 3);
        this.container.add(keyLight);
    }

    private buildSurroundingLamps(): void {
        this.lampsGroup.name = 'SimonSurroundingLamps';
        this.container.add(this.lampsGroup);
        this.lampSlots = [];

        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x261710,
            roughness: 0.85,
            metalness: 0.05
        });

        const offGlassHex = 0x2b2520;

        this.colorDefs.forEach((def, idx) => {
            const rootGroup = new THREE.Group();
            rootGroup.name = `SimonLamp_${idx}_${def.name}`;
            rootGroup.position.set(def.lampX, this.lampHeightY, def.lampZ);
            rootGroup.rotation.y = def.lampRotY;

            const fallbackGroup = new THREE.Group();
            fallbackGroup.name = 'ProceduralLanternFallback';

            const baseGeo = new THREE.BoxGeometry(0.34, 0.08, 0.34);
            const baseMesh = new THREE.Mesh(baseGeo, woodMat);
            baseMesh.position.y = 0.04;
            fallbackGroup.add(baseMesh);

            const glassMat = new THREE.MeshBasicMaterial({
                color: offGlassHex
            });
            const glassGeo = new THREE.BoxGeometry(0.26, 0.56, 0.26);
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.name = 'glass';
            glassMesh.position.y = 0.36;
            fallbackGroup.add(glassMesh);

            const roofGeo = new THREE.ConeGeometry(0.28, 0.18, 4);
            roofGeo.rotateY(Math.PI / 4);
            const roofMesh = new THREE.Mesh(roofGeo, woodMat);
            roofMesh.position.y = 0.72;
            fallbackGroup.add(roofMesh);

            rootGroup.add(fallbackGroup);

            const innerCoreMat = new THREE.MeshBasicMaterial({
                color: def.glowColor,
                transparent: true,
                opacity: 0.92
            });
            const innerCoreGeo = new THREE.SphereGeometry(0.22, 20, 20);
            const innerGlowCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
            innerGlowCore.position.set(0, 0.35, 0);
            innerGlowCore.visible = false;
            rootGroup.add(innerGlowCore);

            const pointLight = new THREE.PointLight(def.glowColor, 0, 3.5);
            pointLight.position.set(0, 0.35, 0);
            rootGroup.add(pointLight);

            this.lampsGroup.add(rootGroup);

            this.lampSlots.push({
                index: idx,
                name: def.name,
                offGlassColor: offGlassHex,
                glowColor: def.glowColor,
                rootGroup,
                glassMaterials: [glassMat],
                innerGlowCore,
                innerCoreMat,
                pointLight,
                baseScale: new THREE.Vector3(1, 1, 1)
            });
        });
    }

    private buildButtonTable(): void {
        this.tableGroup.name = 'SimonButtonTable';
        this.tableGroup.position.set(0, this.tableHeightY, this.tableDistanceZ);
        this.tableGroup.rotation.x = 0.38;
        this.container.add(this.tableGroup);

        const topGeo = new THREE.BoxGeometry(0.68, 0.06, 0.52);
        const topMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.4,
            metalness: 0.4
        });
        const tableTop = new THREE.Mesh(topGeo, topMat);
        tableTop.position.set(0, -0.03, 0);
        this.tableGroup.add(tableTop);

        const rimGeo = new THREE.BoxGeometry(0.72, 0.04, 0.56);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.35,
            roughness: 0.3
        });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.position.set(0, -0.04, 0);
        this.tableGroup.add(rimMesh);

        const pillarGeo = new THREE.CylinderGeometry(0.09, 0.16, this.tableHeightY, 16);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.6,
            metalness: 0.3
        });
        const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
        pillarMesh.position.set(0, -this.tableHeightY * 0.5, -0.1);
        pillarMesh.rotation.x = -0.38;
        this.tableGroup.add(pillarMesh);

        this.tableButtons = [];
        this.buttonRaycastTargets = [];

        const btnGeo = new THREE.CylinderGeometry(0.095, 0.11, 0.055, 32);

        this.colorDefs.forEach((def, idx) => {
            const mat = new THREE.MeshStandardMaterial({
                color: def.buttonBaseColor,
                emissive: def.buttonBaseColor,
                emissiveIntensity: 0.35,
                roughness: 0.25,
                metalness: 0.15
            });

            const btnMesh = new THREE.Mesh(btnGeo, mat);
            btnMesh.name = `SimonTableButton_${idx}_${def.name}`;
            btnMesh.position.set(def.btnX, 0.028, def.btnZ);
            btnMesh.userData.simonButtonIndex = idx;

            this.tableGroup.add(btnMesh);

            this.tableButtons.push({
                index: idx,
                name: def.name,
                baseColor: def.buttonBaseColor,
                glowColor: def.glowColor,
                mesh: btnMesh,
                material: mat,
                baseLocalY: 0.028,
                flashTimer: 0
            });

            this.buttonRaycastTargets.push(btnMesh);
        });
    }

    public bindCustomSceneNodes(nodes: {
        lanternTemplate?: THREE.Object3D | any;
        game2Folder?: THREE.Object3D | any;
        goalItem?: THREE.Object3D | any;
    }): void {
        this.rawTemplateLanternNode = nodes.lanternTemplate || null;
        this.tryApplyCustomLanternModel();

        if (nodes.lanternTemplate?.loaded && typeof nodes.lanternTemplate.loaded.then === 'function') {
            nodes.lanternTemplate.loaded.then(() => {
                this.tryApplyCustomLanternModel();
            });
        }
    }

    private tryApplyCustomLanternModel(): void {
        if (this.isCustomLanternApplied || !this.rawTemplateLanternNode) return;

        const templateObj: THREE.Object3D = this.rawTemplateLanternNode?.element || this.rawTemplateLanternNode;
        if (!templateObj) return;

        let hasMeshes = false;
        templateObj.traverse((child: any) => {
            if (child.isMesh) {
                hasMeshes = true;
            }
        });

        if (!hasMeshes) return;

        this.isCustomLanternApplied = true;

        const templateScale = templateObj.scale.clone();
        if (templateScale.lengthSq() < 0.0001) {
            templateScale.set(0.5, 0.5, 0.5);
        }

        templateObj.visible = false;
        if (this.rawTemplateLanternNode?.visible && typeof this.rawTemplateLanternNode.visible === 'object') {
            this.rawTemplateLanternNode.visible.value = false;
        }

        this.lampSlots.forEach((slot, idx) => {
            const fallback = slot.rootGroup.getObjectByName('ProceduralLanternFallback');
            if (fallback) {
                slot.rootGroup.remove(fallback);
            }

            const clone = templateObj.clone(true);
            clone.visible = true;
            clone.position.set(0, 0, 0);
            clone.rotation.set(0, -Math.PI / 2, 0);
            clone.scale.copy(templateScale);

            const glassMats: THREE.MeshBasicMaterial[] = [];
            const nonWoodMats: THREE.MeshBasicMaterial[] = [];

            clone.traverse((child: any) => {
                child.visible = true;
                if (child.isMesh) {
                    const meshName = (child.name || '').toLowerCase();
                    const parentName = (child.parent?.name || '').toLowerCase();
                    const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
                    const matName = (origMat?.name || '').toLowerCase();

                    const isGlass = meshName.includes('glass') || parentName.includes('glass') || matName.includes('glass');
                    const isWood = meshName.includes('wood') || parentName.includes('wood') || matName.includes('wood');

                    if (isGlass || !isWood) {
                        const brightGlassMat = new THREE.MeshBasicMaterial({
                            color: slot.offGlassColor,
                            side: THREE.DoubleSide
                        });
                        child.material = brightGlassMat;
                        if (isGlass) {
                            glassMats.push(brightGlassMat);
                        } else {
                            nonWoodMats.push(brightGlassMat);
                        }
                    } else if (origMat) {
                        child.material = origMat.clone();
                    }
                }
            });

            slot.glassMaterials = glassMats.length > 0 ? glassMats : nonWoodMats;
            slot.rootGroup.add(clone);
            this.setLampLit(idx, false);
        });

        console.log('[SimonGame] Applied custom lantern.glb to all 4 surrounding Lamps (targeting glass mesh)!');
    }
    // #endregion

    // #region LIFECYCLE & PLACEMENT
    public override canRestart(): boolean {
        if (!this.isPlaced) return false;
        return this.hasStartedAnyRound || this.isTrialWon || this.isCompleted;
    }

    public override setPlaced(placed: boolean): void {
        this.isPlaced = placed;

        if (!placed) {
            this.stopTimer();
            soundManager.stopOrbLoop();
            uiManager.memoryUI.setVisible(false);
            this.phase = 'WAITING_TO_START';
            this.hasStartedAnyRound = false;
            this.gemWrapper.visible = false;
            this.resetAllVisuals();
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
        this.tryApplyCustomLanternModel();

        if (this.isPlaced) {
            this.restartTrial();
        } else {
            this.phase = 'WAITING_TO_START';
            this.stopTimer();
            this.syncRestartAvailability(true);
        }
    }

    public override reset(): void {
        this.restartTrial();
    }

    public override restartTrial(): void {
        this.isActive = true;
        this.isCompleted = false;
        this.isTrialWon = false;
        this.currentRound = 1;
        this.memorySequence = [];
        this.playbackIndex = 0;
        this.currentStepIndex = 0;
        this.hasStartedAnyRound = true;

        this.resetTimer();
        this.startTimer();

        soundManager.stopOrbLoop();
        this.triggerMemoryStartFeedback();

        this.collectible.reset();
        this.gemWrapper.visible = false;
        this.resetAllVisuals();

        this.generateSequenceForCurrentRound();
        this.phase = 'ROUND_TRANSITION';
        this.phaseTimer = 1.2;

        this.syncRestartAvailability(true);
        uiManager.memoryUI.showSimonStart(this.totalRounds);
    }
    // #endregion

    // #region LAMP GLOW & TABLE BUTTON VISUALS
    private generateSequenceForCurrentRound(): void {
        const targetLength = this.startingSequenceLength + (this.currentRound - 1);
        // Uses BaseMemoryGame.generateMemorySequence with appendOnly = true!
        this.generateMemorySequence(targetLength, 4, true);
    }

    private setLampLit(index: number, lit: boolean, customColorHex?: number): void {
        const slot = this.lampSlots[index];
        if (!slot) return;

        const targetColor = customColorHex !== undefined ? customColorHex : (lit ? slot.glowColor : slot.offGlassColor);

        for (const mat of slot.glassMaterials) {
            mat.color.setHex(targetColor);
            mat.needsUpdate = true;
        }

        slot.innerCoreMat.color.setHex(targetColor);
        slot.innerGlowCore.visible = lit;

        slot.pointLight.color.setHex(targetColor);
        slot.pointLight.intensity = lit ? 3.5 : 0;

        const scaleBoost = lit ? 1.14 : 1.0;
        slot.rootGroup.scale.set(
            slot.baseScale.x * scaleBoost,
            slot.baseScale.y * scaleBoost,
            slot.baseScale.z * scaleBoost
        );
    }

    private setTableButtonPressed(index: number, pressed: boolean, customColorHex?: number): void {
        const btn = this.tableButtons[index];
        if (!btn) return;

        const targetColor = customColorHex !== undefined ? customColorHex : (pressed ? btn.glowColor : btn.baseColor);
        const intensity = pressed ? 1.25 : 0.35;

        btn.material.color.setHex(targetColor);
        btn.material.emissive.setHex(targetColor);
        btn.material.emissiveIntensity = intensity;

        btn.mesh.position.y = btn.baseLocalY + (pressed ? -0.018 : 0);
    }

    private resetAllVisuals(): void {
        this.isCurrentlyLit = false;
        this.activeLitIndex = -1;
        for (let i = 0; i < 4; i++) {
            this.setLampLit(i, false);
            if (this.tableButtons[i]) {
                this.tableButtons[i].flashTimer = 0;
                this.setTableButtonPressed(i, false);
            }
        }
    }

    private triggerPlayerTablePressVisual(index: number, isError: boolean = false): void {
        const btn = this.tableButtons[index];
        if (!btn) return;
        const errColor = isError ? 0xff0000 : undefined;
        this.setTableButtonPressed(index, true, errColor);
        this.setLampLit(index, true, errColor);
        btn.flashTimer = isError ? 0.5 : 0.3;
    }
    // #endregion

    // #region DIRECT SCREEN TAP ON TABLE BUTTONS
    private setupTouchListeners(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('pointerdown', (e: PointerEvent) => {
            if (!this.isActive || !this.isPlaced || !this.container.visible) return;

            const targetEl = e.target as HTMLElement | null;
            if (targetEl && targetEl.closest && targetEl.closest('#game-hud, .zcomponent-zappar-three-place-ui-button, .splash')) {
                return;
            }

            if (!this.camera) return;

            this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.pointerNDC, this.camera);

            if (this.phase === 'REWARD_READY' && this.gemWrapper.visible) {
                const gemHits = this.raycaster.intersectObject(this.gemWrapper, true);
                if (gemHits.length > 0) {
                    this.collectible.collect();
                    this.onWin();
                    return;
                }
            }

            if (this.phase !== 'PLAYER_MEMORY_INPUT') return;

            const hits = this.raycaster.intersectObjects(this.buttonRaycastTargets, true);
            if (hits.length > 0) {
                let hitObj: THREE.Object3D | null = hits[0].object;
                while (hitObj && hitObj.userData.simonButtonIndex === undefined) {
                    hitObj = hitObj.parent;
                }
                if (hitObj && typeof hitObj.userData.simonButtonIndex === 'number') {
                    this.handlePlayerButtonPress(hitObj.userData.simonButtonIndex);
                }
            }
        });
    }

    private handlePlayerButtonPress(buttonIndex: number): void {
        if (this.phase !== 'PLAYER_MEMORY_INPUT') return;

        // Validate using BaseMemoryGame.validateMemoryStep!
        if (this.validateMemoryStep(this.currentStepIndex, buttonIndex)) {
            this.triggerPlayerTablePressVisual(buttonIndex, false);
            this.triggerCorrectStepFeedback(buttonIndex);

            this.currentStepIndex++;
            uiManager.memoryUI.showSimonPlayerTurn(this.currentRound, this.totalRounds, this.memorySequence.length, this.currentStepIndex);

            if (this.currentStepIndex >= this.memorySequence.length) {
                if (this.currentRound < this.totalRounds) {
                    const cleared = this.currentRound;
                    this.currentRound++;
                    this.generateSequenceForCurrentRound();
                    this.phase = 'ROUND_TRANSITION';
                    this.phaseTimer = 1.25;
                    uiManager.memoryUI.showSimonRoundCleared(cleared, this.totalRounds);
                } else {
                    this.phase = 'REWARD_READY';
                    this.gemWrapper.visible = true;
                    soundManager.startOrbLoop();
                    this.vibrate([120, 60, 160]);
                    uiManager.memoryUI.showSimonRewardReady();
                }
            }
        } else {
            this.triggerPlayerTablePressVisual(buttonIndex, true);
            this.triggerWrongStepFeedback();
            this.currentStepIndex = 0;
            this.phase = 'ROUND_TRANSITION';
            this.phaseTimer = 1.5;
            uiManager.memoryUI.showSimonWrongColor(this.currentRound, this.totalRounds);
        }
    }
    // #endregion

    // #region MAIN UPDATE LOOP
    protected onUpdate(deltaTime: number): void {
        if (!this.isCustomLanternApplied && this.rawTemplateLanternNode) {
            this.lanternScanTimer += deltaTime;
            if (this.lanternScanTimer >= 0.3) {
                this.lanternScanTimer = 0;
                this.tryApplyCustomLanternModel();
            }
        }

        if (!this.isPlaced) return;

        for (let i = 0; i < this.tableButtons.length; i++) {
            const btn = this.tableButtons[i];
            if (btn.flashTimer > 0) {
                btn.flashTimer -= deltaTime;
                if (btn.flashTimer <= 0) {
                    btn.flashTimer = 0;
                    this.setTableButtonPressed(i, false);
                    this.setLampLit(i, false);
                }
            }
        }

        if (this.phase === 'ROUND_TRANSITION') {
            this.phaseTimer -= deltaTime;
            if (this.phaseTimer <= 0) {
                this.phase = 'SHOWING_MEMORY_CUE';
                this.playbackIndex = 0;
                this.isCurrentlyLit = false;
                this.phaseTimer = 0.25;
            }
            return;
        }

        if (this.phase === 'SHOWING_MEMORY_CUE') {
            this.phaseTimer -= deltaTime;
            if (this.phaseTimer <= 0) {
                if (!this.isCurrentlyLit) {
                    if (this.playbackIndex < this.memorySequence.length) {
                        const idx = this.memorySequence[this.playbackIndex];
                        this.activeLitIndex = idx;
                        this.setLampLit(idx, true);
                        soundManager.playSimonTone(idx, false);
                        this.isCurrentlyLit = true;
                        this.phaseTimer = this.flashDuration;
                    } else {
                        this.phase = 'PLAYER_MEMORY_INPUT';
                        this.currentStepIndex = 0;
                        uiManager.memoryUI.showSimonPlayerTurn(this.currentRound, this.totalRounds, this.memorySequence.length, 0);
                    }
                } else {
                    if (this.activeLitIndex >= 0) {
                        this.setLampLit(this.activeLitIndex, false);
                        this.activeLitIndex = -1;
                    }
                    this.isCurrentlyLit = false;
                    this.playbackIndex++;
                    this.phaseTimer = this.flashGap;
                }
            }
            return;
        }

        if (this.phase === 'REWARD_READY' && !this.isTrialWon) {
            const localPos = this.updatePlayerLocalPosFromCamera();
            const collected = this.collectible.update(deltaTime, localPos, this.camera);
            if (collected) {
                this.onWin();
            }
        }
    }

    public override onWin(): void {
        super.onWin();
        uiManager.memoryUI.showSimonVictory();
    }
    // #endregion
}
