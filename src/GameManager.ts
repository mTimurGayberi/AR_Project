import { QuestManager } from './QuestManager';
import { SaveManager } from './SaveManager';

class GameManager {
    private static instance: GameManager;
    
    public questManager: QuestManager;
    public saveManager: SaveManager;

    private constructor() {
        this.questManager = new QuestManager();
        this.saveManager = new SaveManager('SenseiGame');
        
        // Attempt to load existing save on startup
        this.loadGame();
    }

    public static getInstance(): GameManager {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    public saveGame() {
        const state = {
            quests: this.questManager.exportState(),
            // You can add more states here later (e.g., player inventory, unlocked scenes)
            // inventory: this.inventoryManager.exportState()
        };
        this.saveManager.saveGame(state);
    }

    public loadGame() {
        const state = this.saveManager.loadGame();
        if (state) {
            if (state.quests) {
                this.questManager.importState(state.quests);
            }
        }
    }
}

// Export a single, global instance to be used across all your Mattercraft scenes
export const gameManager = GameManager.getInstance();
