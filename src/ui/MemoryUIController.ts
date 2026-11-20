import { GameHUD } from './GameHUD';

/**
 * MemoryUIController
 * 
 * Dedicated 2D UI Controller for all Column 1 (MEMORY) games:
 * - Game 1: Simon Lanterns (`SimonGame`)
 * - Game 4: Glass Bridge (`GlassBridgeGame`)
 * - Game 7: Cooking Recipe (`CookingGame`)
 * 
 * Centralizes all UI banners, countdown prompts, and progress status badges for
 * Memory games so `SimonGame.ts` and `GlassBridge.ts` stay 100% pure 3D gameplay logic.
 */
export class MemoryUIController {
    private hud: GameHUD;
    private progressBadgeEl: HTMLElement | null = null;

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

    private buildDOM(): void {
        if (typeof document === 'undefined' || this.progressBadgeEl) return;

        this.progressBadgeEl = document.createElement('div');
        this.progressBadgeEl.id = 'memory-ui-progress-badge';
        this.progressBadgeEl.style.position = 'fixed';
        this.progressBadgeEl.style.top = '78%';
        this.progressBadgeEl.style.left = '50%';
        this.progressBadgeEl.style.transform = 'translate3d(-50%, -50%, 0)';
        (this.progressBadgeEl.style as any).webkitTransform = 'translate3d(-50%, -50%, 0)';
        this.progressBadgeEl.style.zIndex = '999994';
        this.progressBadgeEl.style.pointerEvents = 'none';
        this.progressBadgeEl.style.display = 'none';
        this.progressBadgeEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        this.progressBadgeEl.style.background = 'rgba(15, 23, 42, 0.92)';
        this.progressBadgeEl.style.color = '#f8fafc';
        this.progressBadgeEl.style.border = '1px solid rgba(56, 189, 248, 0.45)';
        this.progressBadgeEl.style.borderRadius = '18px';
        this.progressBadgeEl.style.padding = '6px 16px';
        this.progressBadgeEl.style.fontSize = '13px';
        this.progressBadgeEl.style.fontWeight = '700';
        this.progressBadgeEl.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)';
        document.body.appendChild(this.progressBadgeEl);
    }

    public setVisible(visible: boolean): void {
        if (!this.progressBadgeEl) return;
        this.progressBadgeEl.style.display = visible ? 'block' : 'none';
    }

    public updateProgressBadge(htmlText: string): void {
        if (!this.progressBadgeEl) return;
        this.progressBadgeEl.style.display = 'block';
        this.progressBadgeEl.innerHTML = htmlText;
    }

    // #region SIMON LANTERNS UI PROMPTS
    public showSimonStart(totalRounds: number): void {
        this.updateProgressBadge(`🏮 Round: <b>1 / ${totalRounds}</b> &nbsp;|&nbsp; 👀 Watch Lamps`);
        this.hud.notify(`🏮 Round 1/${totalRounds}: Look around at the 4 Lamps, then press the matching buttons on the Table!`, 'info');
    }

    public showSimonPlayerTurn(round: number, totalRounds: number, sequenceLength: number, currentStep: number): void {
        this.updateProgressBadge(`🏮 Round: <b>${round} / ${totalRounds}</b> &nbsp;|&nbsp; 👆 Input: <b>${currentStep} / ${sequenceLength}</b>`);
        if (currentStep === 0) {
            this.hud.notify(`👆 Your Turn! Press the ${sequenceLength} matching color buttons on the Table (Round ${round}/${totalRounds})`, 'info');
        }
    }

    public showSimonRoundCleared(clearedRound: number, totalRounds: number): void {
        this.updateProgressBadge(`🏮 Round: <b>${clearedRound + 1} / ${totalRounds}</b> &nbsp;|&nbsp; 👀 Watch Lamps`);
        this.hud.notify(`✅ Round ${clearedRound}/${totalRounds} Cleared! Look at the Lamps for Round ${clearedRound + 1}...`, 'success');
    }

    public showSimonWrongColor(round: number, totalRounds: number): void {
        this.updateProgressBadge(`🏮 Round: <b>${round} / ${totalRounds}</b> &nbsp;|&nbsp; ❌ Replay`);
        this.hud.notify(`❌ Wrong color! Look at the Lamps and watch Round ${round}/${totalRounds} again...`, 'error');
    }

    public showSimonRewardReady(): void {
        this.updateProgressBadge(`🌟 All Rounds Cleared! &nbsp;|&nbsp; 🔮 Collect Gem`);
        this.hud.notify('🌟 Sequence Mastered! Tap or walk up to the golden Memory Gem above the table!', 'success');
    }

    public showSimonVictory(): void {
        this.setVisible(false);
        this.hud.notify('🎉 VICTORY! You collected the Memory Gem! [Game 1 Complete]', 'success');
    }
    // #endregion

    // #region GLASS BRIDGE UI PROMPTS
    public showBridgeWaitAtStart(): void {
        this.updateProgressBadge(`🌉 Glass Bridge &nbsp;|&nbsp; 🚩 Walk to Green Start Area`);
        this.hud.notify('🚩 Walk into the green Start Area to reveal the safe Glass Bridge path for 3s!', 'info');
    }

    public showBridgeRevealCountdown(secondsLeftText: string, totalRows: number): void {
        this.updateProgressBadge(`👀 Memorize Path! &nbsp;|&nbsp; ⏱️ Hiding in <b>${secondsLeftText}s</b> (0/${totalRows} Rows)`);
        this.hud.notify(`👀 Memorize the green path! Tiles hide in ${secondsLeftText}s...`, 'info');
    }

    public showBridgeGo(totalRows: number): void {
        this.updateProgressBadge(`🌉 Row: <b>0 / ${totalRows}</b> &nbsp;|&nbsp; 👣 Step on Row 1`);
        this.hud.notify('🌉 GO! Step only on the safe glass tiles in order (Row 1 → 6) to reach the Gem!', 'success');
    }

    public showBridgeSafeStep(clearedRowNumber: number, totalRows: number): void {
        if (clearedRowNumber >= totalRows) {
            this.updateProgressBadge(`🌟 Rows: <b>${totalRows} / ${totalRows}</b> &nbsp;|&nbsp; 🔮 Claim Bridge Gem!`);
            this.hud.notify(`🌟 All ${totalRows} Rows Cleared! Step forward to claim the Bridge Gem!`, 'success');
        } else {
            this.updateProgressBadge(`🌉 Row: <b>${clearedRowNumber} / ${totalRows}</b> &nbsp;|&nbsp; 👣 Next: Row ${clearedRowNumber + 1}`);
            this.hud.notify(`✅ Safe Tile! (Row ${clearedRowNumber}/${totalRows} Complete)`, 'success');
        }
    }

    public showBridgeShattered(): void {
        this.updateProgressBadge(`💥 Glass Shattered! &nbsp;|&nbsp; 🚩 Return to Start Area`);
        this.hud.notify('💥 GLASS SHATTERED! Gem vanished! Walk back to the green Start Area to retry.', 'error');
    }

    public showBridgeRowSkipped(expectedRowNumber: number, totalRows: number): void {
        this.updateProgressBadge(`💥 Skipped Row ${expectedRowNumber}! &nbsp;|&nbsp; 🚩 Return to Start Area`);
        this.hud.notify(
            `💥 SKIPPED ROW ${expectedRowNumber}! You must step on rows in order (1 → ${totalRows}). Walk back to Start Area!`,
            'error'
        );
    }

    public showBridgeBypassed(missedRowNumber: number, totalRows: number): void {
        this.updateProgressBadge(`💥 Missed Row ${missedRowNumber}! &nbsp;|&nbsp; 🚩 Return to Start Area`);
        this.hud.notify(
            `💥 Missed Row ${missedRowNumber}/${totalRows}! You cannot walk around the bridge. Return to Start Area!`,
            'error'
        );
    }

    public showBridgeReturnDistance(distanceMeters: number): void {
        this.hud.notify(
            `💥 Wrong Tile! Gem vanished! Walk back to green Start Area (${distanceMeters.toFixed(1)}m)`,
            'error'
        );
    }

    public showBridgeVictory(): void {
        this.setVisible(false);
        this.hud.notify('🎉 VICTORY! You crossed the Glass Bridge and claimed the Bridge Gem!', 'success');
    }
    // #endregion
}
