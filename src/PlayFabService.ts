/**
 * PlayFabService
 * 
 * Cloud service adapter for Microsoft PlayFab SDK.
 * Currently runs in silent / offline-ready mode until a Title ID is provided.
 * Ready for future progression sync, leaderboards, and timer-based bonus rewards.
 */

export interface PlayFabConfig {
    titleId: string;
    isEnabled: boolean;
    debugMode: boolean;
    customIdPrefix: string;
}

export class PlayFabService {
    private static instance: PlayFabService;

    private config: PlayFabConfig = {
        titleId: '', // Set your PlayFab Title ID here when ready (e.g., '1234A')
        isEnabled: false, // Set to true when you want to enable cloud sync
        debugMode: true,
        customIdPrefix: 'Player_'
    };

    private sessionTicket: string | null = null;
    private playFabId: string | null = null;

    private constructor() {}

    public static getInstance(): PlayFabService {
        if (!PlayFabService.instance) {
            PlayFabService.instance = new PlayFabService();
        }
        return PlayFabService.instance;
    }

    /**
     * Initialize PlayFab environment with custom settings
     */
    public initialize(customConfig?: Partial<PlayFabConfig>): void {
        if (customConfig) {
            this.config = { ...this.config, ...customConfig };
        }

        if (this.config.debugMode) {
            console.log(`[PlayFabService] Initialized. Status: ${this.config.isEnabled ? 'Enabled' : 'Offline / Standby'}`);
        }
    }

    /**
     * Authenticate player with a custom device ID or anonymous ID
     */
    public async loginWithCustomId(customId?: string): Promise<boolean> {
        if (!this.config.isEnabled) {
            if (this.config.debugMode) {
                console.log('[PlayFabService] Cloud login bypassed (PlayFab is currently in offline/standby mode).');
            }
            return true;
        }

        const id = customId || this.getOrCreateLocalDeviceId();
        if (this.config.debugMode) {
            console.log(`[PlayFabService] Authenticating with Custom ID: ${id}...`);
        }

        // When PlayFab REST API or SDK is hooked up:
        // POST to https://{titleId}.playfabapi.com/Client/LoginWithCustomID
        try {
            // Simulated successful session for now
            this.sessionTicket = `mock_ticket_${Date.now()}`;
            this.playFabId = `mock_pf_${id}`;
            return true;
        } catch (error) {
            console.error('[PlayFabService] Login failed:', error);
            return false;
        }
    }

    /**
     * Sync collected items and stage progression to the cloud
     */
    public async saveProgression(data: { items: string[]; currentStage: number; extraData?: any }): Promise<boolean> {
        if (!this.config.isEnabled) {
            return false;
        }

        try {
            if (this.config.debugMode) {
                console.log('[PlayFabService] Cloud saving progression:', data);
            }
            // Future implementation: PlayFabClient.UpdateUserData(...)
            return true;
        } catch (error) {
            console.error('[PlayFabService] Failed to save progression to cloud:', error);
            return false;
        }
    }

    /**
     * Load progression data from cloud
     */
    public async loadProgression(): Promise<any | null> {
        if (!this.config.isEnabled) {
            return null;
        }

        try {
            // Future implementation: PlayFabClient.GetUserData(...)
            return null;
        } catch (error) {
            console.error('[PlayFabService] Failed to load progression from cloud:', error);
            return null;
        }
    }

    /**
     * Submit completion time / high score for bonuses & leaderboards
     */
    public async submitScore(statisticName: string, score: number): Promise<boolean> {
        if (!this.config.isEnabled) {
            if (this.config.debugMode) {
                console.log(`[PlayFabService] Stat '${statisticName}' recorded locally: ${score} (Cloud sync disabled)`);
            }
            return true;
        }

        try {
            // Future implementation: PlayFabClient.UpdatePlayerStatistics(...)
            return true;
        } catch (error) {
            console.error(`[PlayFabService] Failed to submit score to ${statisticName}:`, error);
            return false;
        }
    }

    private getOrCreateLocalDeviceId(): string {
        const storageKey = 'PlayFab_Local_Device_ID';
        let deviceId = localStorage.getItem(storageKey);
        if (!deviceId) {
            deviceId = `${this.config.customIdPrefix}${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem(storageKey, deviceId);
        }
        return deviceId;
    }
}

export const playFabService = PlayFabService.getInstance();
