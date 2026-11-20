import { GameHUD } from './GameHUD';
import { MemoryUIController } from './MemoryUIController';
import { ShootingUIController } from './ShootingUIController';

/**
 * UIManager
 * 
 * Central UI Coordinator (Singleton) for the 10-Mini-Game WebAR Quest.
 * Manages:
 * - `hud`: Global persistent top bar (Items, Timer, Restart, 10-Game Dropdown, Alert Banner, Vignette)
 * - `memoryUI`: Dedicated UI controller for Column 1 (MEMORY) games (`SimonGame`, `GlassBridgeGame`, `CookingGame`)
 * - `shootingUI`: Dedicated UI controller for Column 2 (SHOOTING) games (`ShurikenGame`, `CandleGame`, etc.)
 */
export class UIManager {
    private static instance: UIManager;

    public readonly hud: GameHUD;
    public readonly memoryUI: MemoryUIController;
    public readonly shootingUI: ShootingUIController;

    private constructor() {
        this.hud = new GameHUD();
        this.memoryUI = new MemoryUIController(this.hud);
        this.shootingUI = new ShootingUIController(this.hud);
    }

    public static getInstance(): UIManager {
        if (!UIManager.instance) {
            UIManager.instance = new UIManager();
        }
        return UIManager.instance;
    }

    /**
     * Hides all game-specific sub-controllers when switching games or re-entering placement mode.
     */
    public hideAllSubGameUIs(): void {
        this.memoryUI.setVisible(false);
        this.shootingUI.setVisible(false);
    }
}

export const uiManager = UIManager.getInstance();
