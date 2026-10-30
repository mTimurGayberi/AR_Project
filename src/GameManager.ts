import { QuestManager } from './QuestManager';
import { SaveManager } from './SaveManager';
import { PlayFabService, playFabService } from './PlayFabService';
import type { BaseMiniGame } from './BaseMiniGame';

export class GameManager {
    private static instance: GameManager;
    
    public questManager: QuestManager;
    public saveManager: SaveManager;
    public playFabService: PlayFabService;

    // --- Progression: 10 Special Items ---
    public readonly totalSpecialItems: number = 10;
    private collectedItems: Set<string> = new Set();

    // --- Mini-Games Registry ---
    private games: Map<string, BaseMiniGame> = new Map();
    private activeGameId: string | null = null;

    private constructor() {
        this.questManager = new QuestManager();
        this.saveManager = new SaveManager('SenseiGame');
        this.playFabService = playFabService;
        
        // Initialize PlayFab environment (in silent offline mode until Title ID is added)
        this.playFabService.initialize();

        // Attempt to load existing save on startup
        this.loadGame();
    }

    public static getInstance(): GameManager {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    // --- Mini-Game Registry & Management ---

    public registerGame(game: BaseMiniGame): void {
        this.games.set(game.id, game);
        console.log(`[GameManager] Registered game: ${game.name} (${game.id})`);
    }

    public getGame(id: string): BaseMiniGame | undefined {
        return this.games.get(id);
    }

    public getAllGames(): BaseMiniGame[] {
        return Array.from(this.games.values());
    }

    public setActiveGame(id: string): void {
        const nextGame = this.games.get(id);
        if (!nextGame) {
            console.warn(`[GameManager] Cannot set active game. Game '${id}' not found.`);
            return;
        }

        // Clean up previous active game if needed
        if (this.activeGameId && this.activeGameId !== id) {
            const currentGame = this.games.get(this.activeGameId);
            if (currentGame && currentGame.isActive) {
                currentGame.destroy();
            }
        }

        this.activeGameId = id;
        console.log(`[GameManager] Active game set to: ${nextGame.name}`);
    }

    public getActiveGame(): BaseMiniGame | null {
        if (!this.activeGameId) return null;
        return this.games.get(this.activeGameId) || null;
    }

    public restartActiveGame(): void {
        const game = this.getActiveGame();
        if (game) {
            game.reset();
            game.start();
            console.log(`[GameManager] Restarted active game: ${game.name}`);
        }
    }

    public updateActiveGame(deltaTime: number): void {
        const game = this.getActiveGame();
        if (game && game.isActive) {
            game.update(deltaTime);
        }
    }

    // --- Special Items Progression ---

    /**
     * Collects a special item. Returns true if this completes all 10 items.
     */
    public collectItem(itemId: string): boolean {
        if (!this.collectedItems.has(itemId)) {
            this.collectedItems.add(itemId);
            console.log(`[GameManager] Collected item: '${itemId}'. Total: ${this.collectedItems.size}/${this.totalSpecialItems}`);

            // Automatically save to local storage
            this.saveGame();

            // Attempt cloud sync if PlayFab is enabled
            this.playFabService.saveProgression({
                items: Array.from(this.collectedItems),
                currentStage: this.collectedItems.size
            });

            if (this.isAllItemsCollected()) {
                console.log('[GameManager] ALL 10 SPECIAL ITEMS COLLECTED! Grand Quest Complete!');
                return true;
            }
        }
        return this.isAllItemsCollected();
    }

    public hasItem(itemId: string): boolean {
        return this.collectedItems.has(itemId);
    }

    public getCollectedItems(): string[] {
        return Array.from(this.collectedItems);
    }

    public isAllItemsCollected(): boolean {
        return this.collectedItems.size >= this.totalSpecialItems;
    }

    public getProgression(): { collected: number; total: number; percentage: number } {
        const collected = this.collectedItems.size;
        return {
            collected,
            total: this.totalSpecialItems,
            percentage: Math.round((collected / this.totalSpecialItems) * 100)
        };
    }

    // --- Save & Load ---

    public saveGame(): void {
        const state = {
            quests: this.questManager.exportState(),
            collectedItems: Array.from(this.collectedItems),
            activeGameId: this.activeGameId
        };
        this.saveManager.saveGame(state);
    }

    public loadGame(): void {
        const state = this.saveManager.loadGame();
        if (state) {
            if (state.quests) {
                this.questManager.importState(state.quests);
            }
            if (Array.isArray(state.collectedItems)) {
                this.collectedItems = new Set(state.collectedItems);
            }
            if (state.activeGameId) {
                this.activeGameId = state.activeGameId;
            }
        }
    }

    public resetAllProgress(keepActiveGame: boolean = true): void {
        const prevActiveId = this.activeGameId;
        this.collectedItems.clear();
        this.questManager = new QuestManager();
        this.saveManager.clearSave();
        if (keepActiveGame && prevActiveId) {
            this.setActiveGame(prevActiveId);
            const game = this.getActiveGame();
            if (game) {
                game.reset();
                game.start();
            }
        } else {
            this.activeGameId = null;
        }
        console.log('[GameManager] All progress has been reset to 0/10 items.');
    }
}

// Export a single, global instance to be used across all your Mattercraft scenes
export const gameManager = GameManager.getInstance();
