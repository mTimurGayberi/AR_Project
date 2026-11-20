import { GameHUD } from './GameHUD';

/**
 * ShootingUIController
 * 
 * Dedicated 2D UI Controller for all Column 2 (SHOOTING) games:
 * - Shuriken Throw (Game 2)
 * - Candle Spark (Game 5)
 * - Feed the Master (Game 8)
 * - Test Fireball (Game 10)
 * 
 * Separates all HTML/CSS DOM creation (crosshair, shoot button, charge bar, ammo badge)
 * and all UI notification texts from the 3D Three.js gameplay classes.
 */
export class ShootingUIController {
    private hud: GameHUD;
    private rootEl: HTMLElement | null = null;
    private crosshairEl: HTMLElement | null = null;
    private shootBtnEl: HTMLButtonElement | null = null;
    private ammoBadgeEl: HTMLElement | null = null;
    private chargeBarContainer: HTMLElement | null = null;
    private chargeBarFill: HTMLElement | null = null;

    // Input callbacks wired to active BaseShootingGame
    public onShootButtonDown?: () => void;
    public onShootButtonUp?: () => void;

    constructor(hud: GameHUD) {
        this.hud = hud;
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.buildDOM());
            } else {
                this.buildDOM();
            }
        }
    }

    // #region DOM CONSTRUCTION
    private buildDOM(): void {
        if (typeof document === 'undefined' || this.rootEl) return;

        this.rootEl = document.createElement('div');
        this.rootEl.id = 'shooting-ui-overlay';
        this.rootEl.style.position = 'fixed';
        this.rootEl.style.inset = '0';
        this.rootEl.style.pointerEvents = 'none';
        this.rootEl.style.zIndex = '999995';
        this.rootEl.style.display = 'none';
        this.rootEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        // 1. Center Aim Reticle (Crosshair)
        this.crosshairEl = document.createElement('div');
        this.crosshairEl.style.position = 'fixed';
        this.crosshairEl.style.top = '50%';
        this.crosshairEl.style.left = '50%';
        this.crosshairEl.style.width = '32px';
        this.crosshairEl.style.height = '32px';
        this.crosshairEl.style.transform = 'translate3d(-50%, -50%, 0)';
        (this.crosshairEl.style as any).webkitTransform = 'translate3d(-50%, -50%, 0)';
        this.crosshairEl.style.border = '2px solid rgba(56, 189, 248, 0.85)';
        this.crosshairEl.style.borderRadius = '50%';
        this.crosshairEl.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.6)';
        this.crosshairEl.style.display = 'flex';
        this.crosshairEl.style.alignItems = 'center';
        this.crosshairEl.style.justifyContent = 'center';

        const centerDot = document.createElement('div');
        centerDot.style.width = '6px';
        centerDot.style.height = '6px';
        centerDot.style.borderRadius = '50%';
        centerDot.style.background = '#ef4444';
        centerDot.style.boxShadow = '0 0 6px #ef4444';
        this.crosshairEl.appendChild(centerDot);
        this.rootEl.appendChild(this.crosshairEl);

        // 2. Thumb Control Wrapper (positioned at top: 76% to clear iOS bottom bars & Zapworks re-place icon)
        const controlWrap = document.createElement('div');
        controlWrap.style.position = 'fixed';
        controlWrap.style.top = '76%';
        controlWrap.style.left = '50%';
        controlWrap.style.transform = 'translate3d(-50%, -50%, 0)';
        (controlWrap.style as any).webkitTransform = 'translate3d(-50%, -50%, 0)';
        controlWrap.style.display = 'flex';
        controlWrap.style.flexDirection = 'column';
        controlWrap.style.alignItems = 'center';
        controlWrap.style.gap = '8px';
        controlWrap.style.pointerEvents = 'none';

        // Charge Power Bar (for HOLD_CHARGE games)
        this.chargeBarContainer = document.createElement('div');
        this.chargeBarContainer.style.width = '150px';
        this.chargeBarContainer.style.height = '10px';
        this.chargeBarContainer.style.background = 'rgba(15, 23, 42, 0.9)';
        this.chargeBarContainer.style.border = '1.5px solid rgba(251, 191, 36, 0.7)';
        this.chargeBarContainer.style.borderRadius = '8px';
        this.chargeBarContainer.style.overflow = 'hidden';
        this.chargeBarContainer.style.display = 'none';

        this.chargeBarFill = document.createElement('div');
        this.chargeBarFill.style.width = '0%';
        this.chargeBarFill.style.height = '100%';
        this.chargeBarFill.style.background = 'linear-gradient(90deg, #fbbf24, #ef4444)';
        this.chargeBarContainer.appendChild(this.chargeBarFill);
        controlWrap.appendChild(this.chargeBarContainer);

        // Ammo & Targets Counter Badge
        this.ammoBadgeEl = document.createElement('div');
        this.ammoBadgeEl.style.background = 'rgba(15, 23, 42, 0.92)';
        this.ammoBadgeEl.style.color = '#f8fafc';
        this.ammoBadgeEl.style.border = '1px solid rgba(56, 189, 248, 0.45)';
        this.ammoBadgeEl.style.borderRadius = '16px';
        this.ammoBadgeEl.style.padding = '5px 14px';
        this.ammoBadgeEl.style.fontSize = '13px';
        this.ammoBadgeEl.style.fontWeight = '700';
        this.ammoBadgeEl.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)';
        controlWrap.appendChild(this.ammoBadgeEl);

        // Thumb Shoot Button
        this.shootBtnEl = document.createElement('button');
        this.shootBtnEl.type = 'button';
        this.shootBtnEl.innerText = '🎯 SHOOT';
        this.shootBtnEl.style.pointerEvents = 'auto';
        this.shootBtnEl.style.touchAction = 'manipulation';
        this.shootBtnEl.style.userSelect = 'none';
        (this.shootBtnEl.style as any).webkitUserSelect = 'none';
        (this.shootBtnEl.style as any).webkitTapHighlightColor = 'transparent';
        this.shootBtnEl.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
        this.shootBtnEl.style.color = '#ffffff';
        this.shootBtnEl.style.border = '2px solid #fca5a5';
        this.shootBtnEl.style.borderRadius = '32px';
        this.shootBtnEl.style.padding = '14px 34px';
        this.shootBtnEl.style.fontSize = '16px';
        this.shootBtnEl.style.fontWeight = '800';
        this.shootBtnEl.style.letterSpacing = '0.5px';
        this.shootBtnEl.style.boxShadow = '0 6px 22px rgba(239, 68, 68, 0.65)';
        this.shootBtnEl.style.cursor = 'pointer';
        this.shootBtnEl.style.outline = 'none';

        this.shootBtnEl.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this.shootBtnEl) this.shootBtnEl.style.transform = 'scale(0.93)';
            this.onShootButtonDown?.();
        });

        const onRelease = (e: Event) => {
            e.stopPropagation();
            if (this.shootBtnEl) this.shootBtnEl.style.transform = 'scale(1.0)';
            this.onShootButtonUp?.();
        };

        this.shootBtnEl.addEventListener('pointerup', onRelease);
        this.shootBtnEl.addEventListener('pointercancel', onRelease);
        this.shootBtnEl.addEventListener('pointerleave', onRelease);

        controlWrap.appendChild(this.shootBtnEl);
        this.rootEl.appendChild(controlWrap);
        document.body.appendChild(this.rootEl);
    }
    // #endregion

    // #region UI STATE CONTROLS
    public setVisible(visible: boolean, showChargeBar: boolean = false): void {
        if (!this.rootEl) return;
        this.rootEl.style.display = visible ? 'block' : 'none';
        if (this.chargeBarContainer) {
            this.chargeBarContainer.style.display = (visible && showChargeBar) ? 'block' : 'none';
        }
    }

    public updateAmmoAndTargets(remainingAmmo: number, maxAmmo: number, hitsCount: number, totalTargets: number): void {
        if (!this.ammoBadgeEl) return;
        this.ammoBadgeEl.innerHTML = `🔴 Projectiles: <b>${remainingAmmo} / ${maxAmmo}</b> &nbsp;|&nbsp; 🎯 Decoys: <b>${hitsCount} / ${totalTargets}</b>`;
    }

    public setShootButtonReady(ready: boolean): void {
        if (!this.shootBtnEl) return;
        this.shootBtnEl.style.opacity = ready ? '1.0' : '0.55';
    }

    public setChargePercent(percent: number): void {
        if (!this.chargeBarFill) return;
        const clamped = Math.max(0, Math.min(100, Math.round(percent)));
        this.chargeBarFill.style.width = `${clamped}%`;
    }
    // #endregion

    // #region CENTRALIZED SHOOTING NOTIFICATIONS
    public showShurikenStart(maxAmmo: number): void {
        this.hud.notify(`🥷 Line 1/3: Destroy the 3 front decoys to unlock the next line! (${maxAmmo} shots)`, 'info');
    }

    public showTargetHit(hitsCount: number, totalTargets: number): void {
        this.hud.notify(`🎯 Hit Decoy! (${hitsCount}/${totalTargets} destroyed)`, 'success');
    }

    public showWave2Unlocked(): void {
        this.hud.notify('⚡ Line 1 Cleared! Line 2 appeared further back (moving UP & DOWN)!', 'info');
    }

    public showWave3Unlocked(): void {
        this.hud.notify('🔥 Line 2 Cleared! Final Line 3 appeared (moving UP/DOWN & LEFT/RIGHT)!', 'info');
    }

    public showAllTargetsCleared(totalTargets: number): void {
        this.hud.notify(`🌟 All ${totalTargets} Decoys Destroyed! Walk up to or tap the Gem to collect it!`, 'success');
    }

    public showOutOfAmmo(hitsCount: number, totalTargets: number): void {
        this.hud.notify(`❌ Out of projectiles! (${hitsCount}/${totalTargets} decoys hit). Tap ⚙️ Restart to try again!`, 'error');
    }

    public showShurikenVictory(): void {
        this.hud.notify('🎉 VICTORY! You cleared all 3 Decoy Lines and claimed the Shuriken Gem!', 'success');
    }
    // #endregion
}
