import * as THREE from 'three';
import { gameManager } from './GameManager';

export type NotificationType = 'info' | 'warning' | 'success' | 'error';

/**
 * BaseMiniGame
 * 
 * Abstract base class for all 10 AR mini-games.
 * Enforces standard lifecycle methods, 3D container anchoring,
 * a built-in silent timer, and notification/event dispatching.
 */
export abstract class BaseMiniGame {
    public id: string;
    public name: string;
    public rewardItemId: string;
    public isCompleted: boolean = false;
    public isActive: boolean = false;
    public container: THREE.Group;

    // --- Silent Timer System ---
    // Runs in the background of every game. Ready for future speedrun bonuses / leaderboards.
    protected elapsedTime: number = 0;
    protected isTimerRunning: boolean = false;

    // Optional notification callback for UI / AR HUD
    public onNotification?: (message: string, type: NotificationType) => void;

    constructor(id: string, name: string, rewardItemId: string) {
        this.id = id;
        this.name = name;
        this.rewardItemId = rewardItemId;
        this.container = new THREE.Group();
        this.container.name = `MiniGame_${id}`;
    }

    /**
     * Set up 3D meshes, lights, and event listeners.
     * Attach this.container to the AR parent container (e.g. GroundAnchor or WorldTracker).
     */
    public abstract init(parentContainer: THREE.Group | any): void;

    /**
     * Start or unpause the game.
     * Automatically begins the silent timer and sets isActive to true.
     */
    public start(): void {
        this.isActive = true;
        this.startTimer();
        this.notify(`Started ${this.name}`, 'info');
    }

    /**
     * Called every render frame with delta time in seconds.
     * Advances the silent timer and delegates to game-specific update logic.
     */
    public update(deltaTime: number): void {
        if (!this.isActive) return;

        if (this.isTimerRunning) {
            this.elapsedTime += deltaTime;
        }

        this.onUpdate(deltaTime);
    }

    /**
     * Game-specific per-frame update logic (movement, collision detection, etc.)
     */
    protected abstract onUpdate(deltaTime: number): void;

    /**
     * Reset the game state and player position to the start point.
     */
    public abstract reset(): void;

    /**
     * Triggered when the win condition is met.
     * Stops the silent timer, unlocks the reward item in GameManager, and notifies listeners.
     */
    public onWin(): void {
        this.isActive = false;
        this.stopTimer();
        this.isCompleted = true;

        console.log(`[BaseMiniGame] '${this.name}' WON! Time taken: ${this.elapsedTime.toFixed(2)}s`);
        
        // Award the special item to the player
        gameManager.collectItem(this.rewardItemId);

        this.notify(`Victory! You found ${this.rewardItemId}!`, 'success');
    }

    /**
     * Triggered when a fail condition occurs (e.g. wall collision timeout).
     */
    public onFail(reason: string = 'Game Failed'): void {
        console.log(`[BaseMiniGame] '${this.name}' failed. Reason: ${reason}`);
        this.notify(reason, 'error');
        this.reset();
    }

    /**
     * Clean up 3D meshes, textures, materials, and listeners.
     */
    public destroy(): void {
        this.isActive = false;
        this.stopTimer();

        // Recursively dispose Three.js meshes
        this.container.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((mat) => mat.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });

        if (this.container.parent) {
            this.container.parent.remove(this.container);
        }
    }

    // --- Timer Helpers ---
    public startTimer(): void {
        this.isTimerRunning = true;
    }

    public stopTimer(): void {
        this.isTimerRunning = false;
    }

    public resetTimer(): void {
        this.elapsedTime = 0;
    }

    public getElapsedTime(): number {
        return this.elapsedTime;
    }

    // --- Notification Helper ---
    protected notify(message: string, type: NotificationType = 'info'): void {
        if (this.onNotification) {
            this.onNotification(message, type);
        }
    }
}
