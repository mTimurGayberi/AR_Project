import type { NotificationType } from '../BaseMiniGame';

/**
 * GameHUD
 * 
 * Reusable, high-contrast WebAR Heads-Up Display (HUD) for all 10 mini-games.
 * Features:
 * - Highlighted status badges for Items, Timer, and Walls.
 * - Dynamic notification banner with high-contrast text and glowing borders.
 * - Full-screen red loss vignette on wall penalties.
 * - Touch-friendly action buttons (Restart Trial, Reset Quest).
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
    private counterPill: HTMLElement | null = null;
    private alertBanner: HTMLElement | null = null;
    private failVignette: HTMLElement | null = null;
    private bottomControls: HTMLElement | null = null;
    private hideBannerTimer: any = null;
    // #endregion

    // Callbacks for action buttons
    public onRestartClicked?: () => void;
    public onResetAllClicked?: () => void;

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
        document.body.appendChild(this.failVignette);

        // 2. Top Header Container
        this.container = document.createElement('div');
        this.container.id = 'game-hud';
        this.container.style.position = 'fixed';
        this.container.style.top = '44px'; // Clears iOS Dynamic Island & notch
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.zIndex = '999999';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.pointerEvents = 'none';
        this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.container.style.width = '92%';
        this.container.style.maxWidth = '460px';

        // 3. Status Pill with Highlighted Badges
        this.counterPill = document.createElement('div');
        this.counterPill.id = 'hud-counter';
        this.counterPill.style.background = this.colors.pillBg;
        this.counterPill.style.border = this.colors.pillBorder;
        this.counterPill.style.borderRadius = '24px';
        this.counterPill.style.padding = '8px 18px';
        this.counterPill.style.fontSize = '13px';
        this.counterPill.style.fontWeight = 'bold';
        this.counterPill.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
        this.counterPill.style.textAlign = 'center';
        (this.counterPill.style as any).backdropFilter = 'blur(10px)';
        (this.counterPill.style as any).webkitBackdropFilter = 'blur(10px)';
        this.container.appendChild(this.counterPill);

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

        // 5. Bottom Action Controls (Restart & Reset Quest)
        this.buildBottomControls();
    }

    private buildBottomControls(): void {
        this.bottomControls = document.createElement('div');
        this.bottomControls.id = 'hud-bottom-controls';
        this.bottomControls.style.position = 'fixed';
        this.bottomControls.style.bottom = '24px';
        this.bottomControls.style.left = '50%';
        this.bottomControls.style.transform = 'translateX(-50%)';
        this.bottomControls.style.zIndex = '999999';
        this.bottomControls.style.display = 'flex';
        this.bottomControls.style.gap = '14px';
        this.bottomControls.style.pointerEvents = 'auto';
        this.bottomControls.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        // Button A: Restart Current Trial
        const restartBtn = document.createElement('button');
        restartBtn.innerText = '🔄 Restart Trial';
        restartBtn.style.background = this.colors.pillBg;
        restartBtn.style.color = '#38bdf8';
        restartBtn.style.border = `1.5px solid ${this.colors.restartBtnBorder}`;
        restartBtn.style.borderRadius = '24px';
        restartBtn.style.padding = '11px 20px';
        restartBtn.style.fontSize = '14px';
        restartBtn.style.fontWeight = 'bold';
        restartBtn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
        restartBtn.style.cursor = 'pointer';
        restartBtn.style.outline = 'none';
        (restartBtn.style as any).backdropFilter = 'blur(10px)';
        (restartBtn.style as any).webkitBackdropFilter = 'blur(10px)';
        restartBtn.onclick = () => {
            this.setVignetteVisible(false);
            this.onRestartClicked?.();
        };

        // Button B: Reset Entire Quest
        const resetAllBtn = document.createElement('button');
        resetAllBtn.innerText = '⚙️ Reset Quest';
        resetAllBtn.style.background = this.colors.pillBg;
        resetAllBtn.style.color = '#fda4af';
        resetAllBtn.style.border = `1.5px solid ${this.colors.resetBtnBorder}`;
        resetAllBtn.style.borderRadius = '24px';
        resetAllBtn.style.padding = '11px 20px';
        resetAllBtn.style.fontSize = '14px';
        resetAllBtn.style.fontWeight = 'bold';
        resetAllBtn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
        resetAllBtn.style.cursor = 'pointer';
        resetAllBtn.style.outline = 'none';
        (resetAllBtn.style as any).backdropFilter = 'blur(10px)';
        (resetAllBtn.style as any).webkitBackdropFilter = 'blur(10px)';
        resetAllBtn.onclick = () => {
            const confirmed = window.confirm('Reset ALL quest progress back to 0/10 special items?');
            if (confirmed) {
                this.setVignetteVisible(false);
                this.onResetAllClicked?.();
            }
        };

        // Tactile touch reactions for mobile
        [restartBtn, resetAllBtn].forEach(btn => {
            btn.addEventListener('touchstart', () => { btn.style.transform = 'scale(0.94)'; });
            btn.addEventListener('touchend', () => { btn.style.transform = 'scale(1.0)'; });
        });

        this.bottomControls.appendChild(restartBtn);
        this.bottomControls.appendChild(resetAllBtn);
        document.body.appendChild(this.bottomControls);
    }
    // #endregion

    // #region PUBLIC UPDATE METHODS
    /**
     * Updates top status pill with highlighted badges for Items, Timer, and Walls.
     */
    public updateStatus(collected: number, total: number, elapsedSeconds: number, wallsCount: number): void {
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
            <span style="color: rgba(255,255,255,0.4); margin: 0 8px;">|</span>
            <span style="color: ${this.colors.wallBadgeColor};">🛡️ Walls: <b>${wallsCount}</b></span>
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

