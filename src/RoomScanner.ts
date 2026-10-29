import * as THREE from 'three';

export interface RoomBounds {
    corners: THREE.Vector3[];
    center: THREE.Vector3;
    width: number;
    depth: number;
    rotationY: number; // In radians
}

/**
 * RoomScanner
 * 
 * Reusable AR room scanning service for all mini-games.
 * Features:
 * - 4-Corner boundary scanning: Maps the real-world room polygon and orientation.
 * - Live AR visualization: Drops glowing pins at corners and draws boundary lines on the floor.
 * - Computes exact room width, depth, center, and rotation angle.
 * - Persists room data in localStorage so other mini-games can reuse it without re-scanning.
 */
export class RoomScanner {
    private scene: THREE.Scene;
    private camera: THREE.Camera | null = null;

    // Floor placement reticle
    private reticle: THREE.Mesh;
    private reticleVisible: boolean = false;

    // Boundary visualization (Pins and Lines)
    private cornerMarkers: THREE.Mesh[] = [];
    private boundaryLine: THREE.Line | null = null;
    private recordedCorners: THREE.Vector3[] = [];
    private maxCorners: number = 4; // 4 corners for full room boundary

    // UI elements
    private promptBanner: HTMLDivElement | null = null;
    private actionButton: HTMLButtonElement | null = null;
    private skipButton: HTMLDivElement | null = null;
    private onScanComplete?: (bounds: RoomBounds) => void;

    private isScanning: boolean = false;
    private forwardVec: THREE.Vector3 = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Create 3D Floor Reticle Ring
        const reticleGeo = new THREE.RingGeometry(0.35, 0.42, 32);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0x00d2ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.reticle.rotation.x = -Math.PI / 2;
        this.reticle.visible = false;
        this.scene.add(this.reticle);
    }

    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Start the 4-corner room scan sequence
     */
    public startScan(onComplete: (bounds: RoomBounds) => void): void {
        this.onScanComplete = onComplete;
        this.recordedCorners = [];
        this.clearMarkers();
        this.isScanning = true;
        this.reticleVisible = true;

        this.createOrShowUI();
        this.updateStepUI();
    }

    public isScanActive(): boolean {
        return this.isScanning;
    }

    /**
     * Per-frame update for reticle tracking and live line drawing
     */
    public update(): void {
        if (!this.isScanning || !this.camera) return;

        // Project reticle ~2.2m ahead on the floor
        this.camera.getWorldDirection(this.forwardVec);
        const camPos = this.camera.getWorldPosition(new THREE.Vector3());

        const targetX = camPos.x + this.forwardVec.x * 2.2;
        const targetZ = camPos.z + this.forwardVec.z * 2.2;
        const floorY = camPos.y - 1.2;

        this.reticle.position.set(targetX, floorY, targetZ);
        this.reticle.visible = this.reticleVisible;
    }

    private recordCorner(): void {
        const cornerPos = this.reticle.position.clone();
        this.recordedCorners.push(cornerPos);

        // Add 3D visual pin on the floor
        const pinGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24);
        const pinMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.copy(cornerPos);
        this.scene.add(pin);
        this.cornerMarkers.push(pin);

        // Update boundary lines connecting corners
        this.updateBoundaryLines();

        if (this.recordedCorners.length >= this.maxCorners) {
            this.finishScan();
        } else {
            this.updateStepUI();
        }
    }

    private updateBoundaryLines(): void {
        if (this.boundaryLine) {
            this.scene.remove(this.boundaryLine);
            if (this.boundaryLine.geometry) this.boundaryLine.geometry.dispose();
            this.boundaryLine = null;
        }

        if (this.recordedCorners.length < 2) return;

        const points = [...this.recordedCorners];
        if (this.recordedCorners.length === this.maxCorners) {
            points.push(this.recordedCorners[0]); // Close polygon
        }

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
        this.boundaryLine = new THREE.Line(lineGeo, lineMat);
        this.scene.add(this.boundaryLine);
    }

    private finishScan(): void {
        this.isScanning = false;
        this.reticleVisible = false;
        this.reticle.visible = false;
        this.hideUI();

        const bounds = this.calculateRoomBounds(this.recordedCorners);

        // Persist room bounds in localStorage for other mini-games to reuse
        this.saveRoomBounds(bounds);

        if (this.onScanComplete) {
            this.onScanComplete(bounds);
        }
    }

    private calculateRoomBounds(corners: THREE.Vector3[]): RoomBounds {
        // Calculate center of room polygon
        const center = new THREE.Vector3();
        for (const c of corners) {
            center.add(c);
        }
        center.divideScalar(corners.length);

        // Calculate width (distance between corner 1 and 2) and depth (corner 2 and 3)
        let width = 4.0;
        let depth = 4.0;
        let rotationY = 0;

        if (corners.length >= 2) {
            width = corners[0].distanceTo(corners[1]);
            // Calculate orientation angle of the first wall
            rotationY = Math.atan2(corners[1].z - corners[0].z, corners[1].x - corners[0].x);
        }
        if (corners.length >= 3) {
            depth = corners[1].distanceTo(corners[2]);
        } else if (corners.length === 2) {
            // Fallback for 2 corners
            width = Math.max(Math.abs(corners[1].x - corners[0].x), 2.5);
            depth = Math.max(Math.abs(corners[1].z - corners[0].z), 2.5);
        }

        // Enforce safe minimums
        width = Math.max(width, 2.5);
        depth = Math.max(depth, 2.5);

        return {
            corners,
            center,
            width,
            depth,
            rotationY
        };
    }

    private createOrShowUI(): void {
        if (!this.promptBanner) {
            this.promptBanner = document.createElement('div');
            this.promptBanner.id = 'room-scan-prompt';
            this.promptBanner.style.position = 'fixed';
            this.promptBanner.style.top = '105px';
            this.promptBanner.style.left = '50%';
            this.promptBanner.style.transform = 'translateX(-50%)';
            this.promptBanner.style.background = 'rgba(15, 23, 42, 0.92)';
            this.promptBanner.style.border = '1px solid rgba(56, 189, 248, 0.4)';
            this.promptBanner.style.borderRadius = '12px';
            this.promptBanner.style.padding = '10px 18px';
            this.promptBanner.style.color = '#38bdf8';
            this.promptBanner.style.fontSize = '14px';
            this.promptBanner.style.fontWeight = '600';
            this.promptBanner.style.textAlign = 'center';
            this.promptBanner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
            this.promptBanner.style.zIndex = '2000';
            this.promptBanner.style.pointerEvents = 'none';
            (this.promptBanner.style as any).backdropFilter = 'blur(6px)';
            document.body.appendChild(this.promptBanner);
        }
        this.promptBanner.style.display = 'block';

        if (!this.actionButton) {
            this.actionButton = document.createElement('button');
            this.actionButton.id = 'room-scan-btn';
            this.actionButton.style.position = 'fixed';
            this.actionButton.style.bottom = '40px';
            this.actionButton.style.left = '50%';
            this.actionButton.style.transform = 'translateX(-50%)';
            this.actionButton.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
            this.actionButton.style.color = '#ffffff';
            this.actionButton.style.border = 'none';
            this.actionButton.style.borderRadius = '28px';
            this.actionButton.style.padding = '16px 36px';
            this.actionButton.style.fontSize = '17px';
            this.actionButton.style.fontWeight = 'bold';
            this.actionButton.style.boxShadow = '0 10px 25px rgba(2, 132, 199, 0.5)';
            this.actionButton.style.cursor = 'pointer';
            this.actionButton.style.zIndex = '2000';
            this.actionButton.style.letterSpacing = '0.5px';
            this.actionButton.onclick = () => this.recordCorner();
            document.body.appendChild(this.actionButton);
        }
        this.actionButton.style.display = 'block';

        if (!this.skipButton) {
            this.skipButton = document.createElement('div');
            this.skipButton.id = 'room-scan-skip';
            this.skipButton.innerText = 'Quick Start (4m × 4m room default)';
            this.skipButton.style.position = 'fixed';
            this.skipButton.style.bottom = '12px';
            this.skipButton.style.left = '50%';
            this.skipButton.style.transform = 'translateX(-50%)';
            this.skipButton.style.color = '#94a3b8';
            this.skipButton.style.fontSize = '12px';
            this.skipButton.style.cursor = 'pointer';
            this.skipButton.style.zIndex = '2000';
            this.skipButton.style.textDecoration = 'underline';
            this.skipButton.onclick = () => {
                const defaultCenter = this.reticle.position.clone();
                const defaultBounds: RoomBounds = {
                    corners: [],
                    center: defaultCenter,
                    width: 4.0,
                    depth: 4.0,
                    rotationY: 0
                };
                this.finishScanWithBounds(defaultBounds);
            };
            document.body.appendChild(this.skipButton);
        }
        this.skipButton.style.display = 'block';
    }

    private updateStepUI(): void {
        const step = this.recordedCorners.length + 1;
        if (this.promptBanner) {
            this.promptBanner.innerText = `📐 Step ${step}/${this.maxCorners}: Aim circle at Corner ${step} & tap`;
        }
        if (this.actionButton) {
            this.actionButton.innerText = `📍 Set Corner ${step}`;
            if (step === this.maxCorners) {
                this.actionButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                this.actionButton.innerText = `📍 Set Corner ${step} (Finish Scan)`;
            } else {
                this.actionButton.style.background = 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)';
            }
        }
    }

    private hideUI(): void {
        if (this.promptBanner) this.promptBanner.style.display = 'none';
        if (this.actionButton) this.actionButton.style.display = 'none';
        if (this.skipButton) this.skipButton.style.display = 'none';
    }

    public clearMarkers(): void {
        for (const marker of this.cornerMarkers) {
            this.scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
        }
        this.cornerMarkers = [];

        if (this.boundaryLine) {
            this.scene.remove(this.boundaryLine);
            if (this.boundaryLine.geometry) this.boundaryLine.geometry.dispose();
            this.boundaryLine = null;
        }
    }

    private finishScanWithBounds(bounds: RoomBounds): void {
        this.isScanning = false;
        this.reticleVisible = false;
        this.reticle.visible = false;
        this.hideUI();
        this.clearMarkers();
        this.saveRoomBounds(bounds);

        if (this.onScanComplete) {
            this.onScanComplete(bounds);
        }
    }

    private saveRoomBounds(bounds: RoomBounds): void {
        try {
            const data = {
                width: bounds.width,
                depth: bounds.depth,
                rotationY: bounds.rotationY
            };
            localStorage.setItem('AR_Room_Calibrated_Bounds', JSON.stringify(data));
        } catch (e) {
            console.warn('[RoomScanner] Failed to save room bounds:', e);
        }
    }

    public static getSavedRoomBounds(): { width: number; depth: number; rotationY: number } | null {
        try {
            const raw = localStorage.getItem('AR_Room_Calibrated_Bounds');
            if (raw) return JSON.parse(raw);
        } catch (e) {
            return null;
        }
        return null;
    }
}
