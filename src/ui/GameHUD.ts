import type { NotificationType } from '../core/BaseMiniGame';

export interface GameDropdownOption {
    gameNumber: number;
    label: string;
    enabled: boolean;
}

/**
 * GameHUD
 * 
 * Reusable, high-contrast WebAR Heads-Up Display (HUD) for all 10 mini-games.
 * Features:
 * - Highlighted status badges for Items and Timer.
 * - Compact 10-game Dropdown selector for testing any mini-game.
 * - Dynamic notification banner with high-contrast text and glowing borders.
 * - Full-screen red loss vignette on penalties.
 * - Touch-friendly top-right Restart button.
 */
export class GameHUD {
    // #region UI STYLING & HIGHLIGHT CONTROLS
    // =========================================================================
    // Easily tweak colors, badges, and sizes for maximum readability in AR!
    // =========================================================================
    public readonly colors = {
        pillBg: 'rgba(15, 23, 42, 0.92)',
        pillBorder: '1px solid rgba(56, 189, 248, 0.45)',
        itemBadgeColor: '#38bdf8',     // Neon Cyan
        timerBadgeColor: '#fbbf24',    // Bright Gold
        wallBadgeColor: '#34d399',     // Emerald Green
        errorBg: 'rgba(220, 38, 38, 0.96)',
        warningBg: 'rgba(234, 88, 12, 0.96)',
        successBg: 'rgba(16, 185, 129, 0.96)',
        infoBg: 'rgba(15, 23, 42, 0.92)',
        restartBtnBorder: 'rgba(56, 189, 248, 0.55)',
        resetBtnBorder: 'rgba(244, 63, 94, 0.55)',
    };
    // #endregion

    // #region DOM ELEMENTS
    private container: HTMLElement | null = null;
    private topBar: HTMLElement | null = null;
    private counterPill: HTMLElement | null = null;
    private restartBtn: HTMLButtonElement | null = null;
    private gameSwitcherBar: HTMLElement | null = null;
    private gameSelectEl: HTMLSelectElement | null = null;
    private alertBanner: HTMLElement | null = null;
    private failVignette: HTMLElement | null = null;
    private hideBannerTimer: any = null;
    private isLaunched: boolean = false;
    private isPlaced: boolean = false;
    private isRestartAllowed: boolean = false;
    private activeGameNumber: number | null = null;
    private dropdownOptions: GameDropdownOption[] = [
        { gameNumber: 1,  label: '1. 🏮 Simon Lanterns [Memory]',    enabled: true },
        { gameNumber: 2,  label: '2. 🥷 Shuriken Throw [Shooting]',  enabled: true },
        { gameNumber: 3,  label: '3. 🖼️ Paintings [Puzzle]',         enabled: false },
        { gameNumber: 4,  label: '4. 🌉 Glass Bridge [Memory]',      enabled: true },
        { gameNumber: 5,  label: '5. 🕯️ Candle Spark [Shooting]',    enabled: false },
        { gameNumber: 6,  label: '6. 📦 Boxes [Puzzle]',             enabled: false },
        { gameNumber: 7,  label: '7. 🍜 Cooking [Memory]',           enabled: false },
        { gameNumber: 8,  label: '8. 🍙 Feed the Master [Shooting]', enabled: false },
        { gameNumber: 9,  label: '9. 🧩 Puzzle [Puzzle]',            enabled: false },
        { gameNumber: 10, label: '10. 🔥 Test Fireball [Shooting]',  enabled: false },
    ];
    // #endregion

    // Callbacks for action buttons & placement
    public onRestartClicked?: () => void;
    public onResetAllClicked?: () => void;
    public onPlacementChanged?: (placed: boolean) => void;
    public onGameSelected?: (gameNumber: number) => void;

    constructor() {
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.buildHUD());
            } else {
                this.buildHUD();
            }
        }
    }

    // #region BUILD HUD
    private buildHUD(): void {
        // 1. Full-screen Red Failure Vignette
        this.failVignette = document.createElement('div');
        this.failVignette.id = 'hud-vignette';
        this.failVignette.style.position = 'fixed';
        this.failVignette.style.inset = '0';
        this.failVignette.style.pointerEvents = 'none';
        this.failVignette.style.zIndex = '999990';
        this.failVignette.style.opacity = '0';
        this.failVignette.style.transition = 'opacity 0.3s ease';
        this.failVignette.style.boxShadow = 'inset 0 0 65px 25px rgba(239, 68, 68, 0.8)';
        this.failVignette.style.transform = 'translate3d(0, 0, 0)';
        (this.failVignette.style as any).webkitTransform = 'translate3d(0, 0, 0)';
        document.body.appendChild(this.failVignette);

        // 2. Top Header Container
        this.container = document.createElement('div');
        this.container.id = 'game-hud';
        this.container.style.position = 'fixed';
        this.container.style.top = '46px'; // Clears iOS Dynamic Island & notch
        this.container.style.left = '50%';
        this.container.style.transform = 'translate3d(-50%, 0, 0)';
        (this.container.style as any).webkitTransform = 'translate3d(-50%, 0, 0)';
        this.container.style.zIndex = '999999';
        this.container.style.display = 'none'; // Hidden until [Launch] is tapped!
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.pointerEvents = 'none';
        this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.container.style.width = '94%';
        this.container.style.maxWidth = '460px';

        // 3. Top Row: Status Pill (Items + Time) & Top-Right Cog Restart Button
        this.topBar = document.createElement('div');
        this.topBar.id = 'hud-top-bar';
        this.topBar.style.display = 'flex';
        this.topBar.style.alignItems = 'center';
        this.topBar.style.justifyContent = 'center';
        this.topBar.style.width = '100%';
        this.topBar.style.gap = '8px';
        this.topBar.style.pointerEvents = 'none';

        this.counterPill = document.createElement('div');
        this.counterPill.id = 'hud-counter';
        this.counterPill.style.display = 'none'; // Hidden until maze is placed in room!
        this.counterPill.style.margin = '0 auto';
        this.counterPill.style.background = this.colors.pillBg;
        this.counterPill.style.border = this.colors.pillBorder;
        this.counterPill.style.borderRadius = '24px';
        this.counterPill.style.padding = '8px 14px';
        this.counterPill.style.fontSize = '13px';
        this.counterPill.style.fontWeight = 'bold';
        this.counterPill.style.lineHeight = '1.2';
        this.counterPill.style.whiteSpace = 'nowrap';
        this.counterPill.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
        this.counterPill.style.textAlign = 'center';
        (this.counterPill.style as any).backdropFilter = 'blur(10px)';
        (this.counterPill.style as any).webkitBackdropFilter = 'blur(10px)';
        this.topBar.appendChild(this.counterPill);

        // Top-Right Restart Button with Small Cog Icon (inside proven top #game-hud!)
        this.restartBtn = document.createElement('button');
        this.restartBtn.type = 'button';
        this.restartBtn.id = 'hud-restart-btn';
        this.restartBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Restart</span>
        `;
        this.restartBtn.style.display = 'none'; // Hidden until trial starts or item collected!
        this.restartBtn.style.alignItems = 'center';
        this.restartBtn.style.justifyContent = 'center';
        this.restartBtn.style.gap = '5px';
        this.restartBtn.style.flexShrink = '0';
        this.restartBtn.style.whiteSpace = 'nowrap';
        this.restartBtn.style.pointerEvents = 'auto';
        this.restartBtn.style.touchAction = 'manipulation';
        this.restartBtn.style.background = this.colors.pillBg;
        this.restartBtn.style.color = '#38bdf8';
        this.restartBtn.style.border = `1.5px solid ${this.colors.restartBtnBorder}`;
        this.restartBtn.style.borderRadius = '24px';
        this.restartBtn.style.padding = '8px 12px';
        this.restartBtn.style.fontSize = '13px';
        this.restartBtn.style.fontWeight = 'bold';
        this.restartBtn.style.lineHeight = '1.2';
        this.restartBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
        this.restartBtn.style.cursor = 'pointer';
        this.restartBtn.style.outline = 'none';
        (this.restartBtn.style as any).webkitTapHighlightColor = 'transparent';
        (this.restartBtn.style as any).backdropFilter = 'blur(10px)';
        (this.restartBtn.style as any).webkitBackdropFilter = 'blur(10px)';
        this.restartBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.restartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setVignetteVisible(false);
            this.onRestartClicked?.();
        });
        this.restartBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (this.restartBtn) this.restartBtn.style.transform = 'scale(0.94)';
        }, { passive: true });
        this.restartBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (this.restartBtn) this.restartBtn.style.transform = 'scale(1.0)';
        }, { passive: true });
        this.topBar.appendChild(this.restartBtn);

        this.container.appendChild(this.topBar);

        // 3.5 Compact 10-Game Dropdown Selector
        this.gameSwitcherBar = document.createElement('div');
        this.gameSwitcherBar.id = 'hud-game-switcher';
        this.gameSwitcherBar.style.display = 'none'; // Shown as soon as [Launch] is tapped
        this.gameSwitcherBar.style.alignItems = 'center';
        this.gameSwitcherBar.style.justifyContent = 'center';
        this.gameSwitcherBar.style.marginTop = '7px';
        this.gameSwitcherBar.style.pointerEvents = 'none';
        this.gameSwitcherBar.style.width = '100%';

        this.gameSelectEl = document.createElement('select');
        this.gameSelectEl.id = 'hud-game-select';
        this.gameSelectEl.style.pointerEvents = 'auto';
        this.gameSelectEl.style.touchAction = 'manipulation';
        this.gameSelectEl.style.background = this.colors.pillBg;
        this.gameSelectEl.style.color = '#f8fafc';
        this.gameSelectEl.style.border = '1.5px solid #38bdf8';
        this.gameSelectEl.style.borderRadius = '20px';
        this.gameSelectEl.style.padding = '7px 14px';
        this.gameSelectEl.style.fontSize = '13px';
        this.gameSelectEl.style.fontWeight = '700';
        this.gameSelectEl.style.lineHeight = '1.2';
        this.gameSelectEl.style.cursor = 'pointer';
        this.gameSelectEl.style.outline = 'none';
        this.gameSelectEl.style.maxWidth = '290px';
        this.gameSelectEl.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
        (this.gameSelectEl.style as any).webkitTapHighlightColor = 'transparent';
        (this.gameSelectEl.style as any).backdropFilter = 'blur(10px)';
        (this.gameSelectEl.style as any).webkitBackdropFilter = 'blur(10px)';

        this.populateDropdownOptions();

        this.gameSelectEl.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.gameSelectEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        this.gameSelectEl.addEventListener('click', (e) => e.stopPropagation());
        this.gameSelectEl.addEventListener('change', (e) => {
            e.stopPropagation();
            const val = parseInt(this.gameSelectEl?.value || '', 10);
            if (!isNaN(val) && val >= 1) {
                this.setVignetteVisible(false);
                this.setActiveGameNumber(val);
                this.onGameSelected?.(val);
            }
        });

        this.gameSwitcherBar.appendChild(this.gameSelectEl);
        this.container.appendChild(this.gameSwitcherBar);

        // 4. Alert Banner with Glowing Border
        this.alertBanner = document.createElement('div');
        this.alertBanner.id = 'hud-banner';
        this.alertBanner.style.marginTop = '10px';
        this.alertBanner.style.padding = '10px 20px';
        this.alertBanner.style.borderRadius = '12px';
        this.alertBanner.style.fontSize = '14px';
        this.alertBanner.style.fontWeight = '700';
        this.alertBanner.style.display = 'none';
        this.alertBanner.style.textAlign = 'center';
        this.alertBanner.style.transition = 'all 0.25s ease';
        this.alertBanner.style.pointerEvents = 'none';
        (this.alertBanner.style as any).backdropFilter = 'blur(8px)';
        (this.alertBanner.style as any).webkitBackdropFilter = 'blur(8px)';
        this.container.appendChild(this.alertBanner);

        document.body.appendChild(this.container);

        // 5. Auto-detect placement state
        this.setupPlacementObserver();
    }

    /**
     * Ensures HUD elements stay at the very end of `document.body` (strictly AFTER WebGL `<canvas>`
     * and `#zcomponent-overlay`) so touch events and GPU layering always work on iOS.
     */
    private ensureTopLayerOrder(): void {
        if (typeof document === 'undefined' || !document.body || !this.container) return;
        if (document.body.lastElementChild !== this.container) {
            if (this.failVignette) document.body.appendChild(this.failVignette);
            document.body.appendChild(this.container);
        }
    }

    private setupPlacementObserver(): void {
        const updateVisibility = () => {
            // Auto-detect if app has been launched from splash screen
            if (!this.isLaunched) {
                const splash = document.querySelector('.splash') as HTMLElement;
                const isSplashHidden = !splash || splash.style.display === 'none' || window.getComputedStyle(splash).display === 'none';
                const hasLaunchedClass = document.body.classList.contains('zcomponent-launched');
                if (isSplashHidden || hasLaunchedClass) {
                    this.onLaunched();
                } else {
                    return; // Still on splash screen, stay completely hidden!
                }
            }

            this.ensureTopLayerOrder();

            // Check if Zapworks "Place" checkmark button (center) is visible on screen
            const placeCenterUI = document.querySelector('.zcomponent-zappar-three-place-ui-horizontal-center');
            const isPlacing = !!(placeCenterUI && window.getComputedStyle(placeCenterUI).display !== 'none');

            if (isPlacing) {
                if (this.isPlaced) {
                    this.setPlaced(false);
                }
                return;
            }

            // Check if Zapworks "Restart Placement" (re-place maze) button is on screen (bottom-left)
            const restartPlacementUI = document.querySelector('.zcomponent-zappar-three-place-ui-horizontal-left');
            const hasPlaced = !!restartPlacementUI;

            if (hasPlaced && !this.isPlaced) {
                this.setPlaced(true);
            }
        };

        if (typeof MutationObserver !== 'undefined' && document.body) {
            const observer = new MutationObserver(updateVisibility);
            observer.observe(document.body, { childList: true, subtree: true });
        }
        setInterval(updateVisibility, 250);
    }

    /**
     * Called when the user clicks [Launch] on the splash screen.
     */
    public onLaunched(): void {
        this.isLaunched = true;
        this.ensureTopLayerOrder();
        if (this.container) {
            this.container.style.display = 'flex';
        }
        // Always show game selector once launched so the tester can choose which game folder to turn ON!
        if (this.gameSwitcherBar) {
            this.gameSwitcherBar.style.display = 'inline-flex';
        }
        if (this.activeGameNumber === null) {
            if (this.counterPill) this.counterPill.style.display = 'none';
            this.notify('🎮 Choose a Mini-Game from the dropdown above to begin!', 'info');
        } else if (!this.isPlaced) {
            if (this.counterPill) this.counterPill.style.display = 'none';
            this.notify('🎯 Aim at floor and tap ✓ to place game', 'info');
        } else {
            if (this.counterPill) this.counterPill.style.display = 'block';
        }
        this.refreshRestartButton();
    }

    /**
     * Updates visibility once the anchor has been placed or when re-entering placement mode.
     */
    public setPlaced(placed: boolean): void {
        const changed = this.isPlaced !== placed;
        this.isPlaced = placed;
        if (!placed) {
            this.isRestartAllowed = false;
            this.setVignetteVisible(false);
        }

        if (!this.isLaunched) {
            if (this.container) this.container.style.display = 'none';
            if (this.counterPill) this.counterPill.style.display = 'none';
            if (this.gameSwitcherBar) this.gameSwitcherBar.style.display = 'none';
            if (this.restartBtn) this.restartBtn.style.display = 'none';
            return;
        }

        this.ensureTopLayerOrder();

        if (this.container) {
            this.container.style.display = 'flex';
        }
        if (this.gameSwitcherBar) {
            this.gameSwitcherBar.style.display = 'inline-flex';
        }

        if (this.activeGameNumber === null) {
            if (this.counterPill) this.counterPill.style.display = 'none';
            this.notify('🎮 Choose a Mini-Game from the dropdown above to begin!', 'info');
        } else if (placed) {
            if (this.counterPill) this.counterPill.style.display = 'block';
        } else {
            if (this.counterPill) this.counterPill.style.display = 'none';
            this.notify('🎯 Aim at floor and tap ✓ to place game', 'info');
        }

        if (changed) {
            this.onPlacementChanged?.(placed);
        }

        this.refreshRestartButton();
    }

    /**
     * Configures the 10-game dropdown options dynamically from the entry point (`index.ts`).
     */
    public setGameOptions(options: GameDropdownOption[]): void {
        this.dropdownOptions = options;
        this.populateDropdownOptions();
    }

    private populateDropdownOptions(): void {
        if (!this.gameSelectEl) return;
        this.gameSelectEl.innerHTML = '';

        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.innerText = '🎮 Select Mini-Game (1–10)...';
        placeholderOpt.disabled = true;
        placeholderOpt.selected = this.activeGameNumber === null;
        placeholderOpt.style.background = '#0f172a';
        placeholderOpt.style.color = '#94a3b8';
        this.gameSelectEl.appendChild(placeholderOpt);

        for (const opt of this.dropdownOptions) {
            const optionEl = document.createElement('option');
            optionEl.value = String(opt.gameNumber);
            optionEl.innerText = opt.enabled ? opt.label : `${opt.label} (Soon)`;
            optionEl.disabled = !opt.enabled;
            optionEl.selected = this.activeGameNumber === opt.gameNumber;
            optionEl.style.background = '#0f172a';
            optionEl.style.color = opt.enabled ? '#f8fafc' : '#64748b';
            this.gameSelectEl.appendChild(optionEl);
        }
    }

    /**
     * Updates the selected game in the HUD dropdown.
     */
    public setActiveGameNumber(gameNumber: number): void {
        this.activeGameNumber = gameNumber;
        if (this.gameSelectEl && this.gameSelectEl.value !== String(gameNumber)) {
            this.gameSelectEl.value = String(gameNumber);
        }
        if (this.isLaunched) {
            if (this.isPlaced) {
                if (this.counterPill) this.counterPill.style.display = 'block';
            } else {
                if (this.counterPill) this.counterPill.style.display = 'none';
                this.notify('🎯 Aim at floor and tap ✓ to place game', 'info');
            }
        }
        this.refreshRestartButton();
    }

    /**
     * Controls whether the [⚙️ Restart] button is allowed to show (once trial started or item collected).
     */
    public setRestartVisible(visible: boolean): void {
        this.isRestartAllowed = visible;
        this.refreshRestartButton();
    }

    private refreshRestartButton(): void {
        if (!this.restartBtn) return;
        const shouldShow = this.isLaunched && this.isPlaced && this.activeGameNumber !== null && this.isRestartAllowed;
        const targetDisplay = shouldShow ? 'inline-flex' : 'none';
        if (this.restartBtn.style.display !== targetDisplay) {
            this.restartBtn.style.display = targetDisplay;
        }
    }
    // #endregion

    // #region PUBLIC UPDATE METHODS
    /**
     * Updates top status pill with highlighted badges for Items and Timer (Walls removed).
     */
    public updateStatus(collected: number, total: number, elapsedSeconds: number, _wallsCount?: number): void {
        if (elapsedSeconds > 0 && !this.isRestartAllowed) {
            this.setRestartVisible(true);
        }
        if (!this.counterPill) return;

        const mins = Math.floor(elapsedSeconds / 60);
        const secs = Math.floor(elapsedSeconds % 60);
        const mStr = mins < 10 ? '0' + mins : '' + mins;
        const sStr = secs < 10 ? '0' + secs : '' + secs;
        const timeStr = `${mStr}:${sStr}`;

        this.counterPill.innerHTML = `
            <span style="color: ${this.colors.itemBadgeColor};">🔮 Items: <b>${collected} / ${total}</b></span>
            <span style="color: rgba(255,255,255,0.4); margin: 0 8px;">|</span>
            <span style="color: ${this.colors.timerBadgeColor};">⏱️ <b>${timeStr}</b></span>
        `;
    }

    /**
     * Shows a banner notification with high-contrast text and glowing border.
     */
    public notify(message: string, type: NotificationType): void {
        if (!this.alertBanner) return;

        if (this.hideBannerTimer) {
            clearTimeout(this.hideBannerTimer);
            this.hideBannerTimer = null;
        }

        this.alertBanner.innerText = message;
        this.alertBanner.style.display = 'block';

        if (type === 'error') {
            this.alertBanner.style.background = this.colors.errorBg;
            this.alertBanner.style.color = '#ffffff';
            this.alertBanner.style.border = '1.5px solid rgba(254, 202, 202, 0.7)';
            this.alertBanner.style.boxShadow = '0 0 25px rgba(220, 38, 38, 0.9)';
            this.setVignetteVisible(true);
            // Sticky error: No auto-hide! Must physically return or tap restart.
        } else if (type === 'warning') {
            this.alertBanner.style.background = this.colors.warningBg;
            this.alertBanner.style.color = '#ffffff';
            this.alertBanner.style.border = '1.5px solid rgba(253, 186, 116, 0.7)';
            this.alertBanner.style.boxShadow = '0 0 20px rgba(234, 88, 12, 0.8)';
            this.setVignetteOpacity(0.35);
        } else if (type === 'success') {
            this.alertBanner.style.background = this.colors.successBg;
            this.alertBanner.style.color = '#ffffff';
            this.alertBanner.style.border = '1.5px solid rgba(167, 243, 208, 0.7)';
            this.alertBanner.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.85)';
            this.setVignetteVisible(false);
            this.hideBannerTimer = setTimeout(() => {
                if (this.alertBanner) this.alertBanner.style.display = 'none';
            }, 3500);
        } else {
            this.alertBanner.style.background = this.colors.infoBg;
            this.alertBanner.style.color = '#f1f5f9';
            this.alertBanner.style.border = '1px solid rgba(56, 189, 248, 0.45)';
            this.alertBanner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
            this.setVignetteVisible(false);
            this.hideBannerTimer = setTimeout(() => {
                if (this.alertBanner) this.alertBanner.style.display = 'none';
            }, 3500);
        }
    }

    public setVignetteVisible(visible: boolean): void {
        if (this.failVignette) {
            this.failVignette.style.opacity = visible ? '1' : '0';
        }
    }

    public setVignetteOpacity(opacity: number): void {
        if (this.failVignette) {
            this.failVignette.style.opacity = opacity.toString();
        }
    }
    // #endregion
}

